import { randomInt } from "node:crypto";
import { Op } from "sequelize";
import { Asistencia, CierreCaja, DiaNoLaboralSemana, Feriado, FrancoSabado, HorarioCodigo, HorarioConfiguracion, Role, User } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

const ROLES_EMPLEADOS = ["repartidor", "operador"];

const sumarDias = (fecha, dias) => {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + dias, 12));
  return date.toISOString().slice(0, 10);
};

const diaSemana = (fecha) => {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
};

const fechaValida = (fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return false;
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString().slice(0, 10) === fecha;
};

const obtenerCalendarioNoLaborable = async (desde, hasta) => {
  const [dias, feriados] = await Promise.all([
    DiaNoLaboralSemana.findAll({ attributes: ["dia_semana"] }),
    Feriado.findAll({ where: { fecha: { [Op.between]: [desde, hasta] } } }),
  ]);
  return {
    diasSemana: new Set(dias.map(({ dia_semana }) => Number(dia_semana))),
    feriados: new Map(feriados.map((feriado) => [feriado.fecha, feriado])),
  };
};

const motivoNoLaborable = (fecha, calendario) => {
  // Los sábados se rigen por el sorteo de francos, no por el calendario general.
  if (diaSemana(fecha) === 6) return null;
  const feriado = calendario.feriados.get(fecha);
  if (feriado) return { estado: "feriado", nombre: feriado.nombre };
  if (diaSemana(fecha) === 0 || calendario.diasSemana.has(diaSemana(fecha))) return { estado: "no_laborable" };
  return null;
};

const sabadoProximo = (fecha) => {
  const dia = diaSemana(fecha);
  return sumarDias(fecha, dia === 6 ? 0 : (6 - dia + 7) % 7);
};

const rangoLaboral = (sabado) => ({ desde: sumarDias(sabado, -5), hasta: sumarDias(sabado, -1) });

const obtenerConfiguracion = async () => {
  const [config] = await HorarioConfiguracion.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, max_minutos_tarde: 0 },
  });
  return config;
};

const generarCodigo = async (fecha) => {
  const existente = await HorarioCodigo.findOne({ where: { fecha } });
  if (existente) return existente;

  for (let intento = 0; intento < 20; intento += 1) {
    const codigo = String(randomInt(100000, 1000000));
    try {
      return await HorarioCodigo.create({ fecha, codigo });
    } catch (error) {
      const creadoEnParalelo = await HorarioCodigo.findOne({ where: { fecha } });
      if (creadoEnParalelo) return creadoEnParalelo;
      if (error.name !== "SequelizeUniqueConstraintError") throw error;
    }
  }
  throw new Error("No se pudo generar un código diario disponible");
};

const buscarEmpleados = () => User.findAll({
  where: { activo: true },
  attributes: ["id", "nombre"],
  include: [{
    model: Role,
    attributes: ["nombre"],
    where: { nombre: { [Op.in]: ROLES_EMPLEADOS } },
    required: true,
  }],
  order: [["nombre", "ASC"]],
});

const barajar = (lista) => {
  const resultado = [...lista];
  for (let i = resultado.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
};

const obtenerResumenSemana = async (empleados, sabado) => {
  const { desde, hasta } = rangoLaboral(sabado);
  const sabadoAnterior = sumarDias(sabado, -7);
  const [asistencias, calendario] = await Promise.all([
    Asistencia.findAll({
      where: { userId: { [Op.in]: empleados.map(({ id }) => id) }, fecha: { [Op.between]: [sabadoAnterior, hasta] } },
    }),
    obtenerCalendarioNoLaborable(sabadoAnterior, hasta),
  ]);
  const porUsuario = new Map();
  for (const asistencia of asistencias) {
    const resumen = porUsuario.get(asistencia.userId) || { faltas: 0, minutosTarde: 0 };
    if (asistencia.estado === "ausente" && (asistencia.fecha === sabadoAnterior || !motivoNoLaborable(asistencia.fecha, calendario))) resumen.faltas += 1;
    if (asistencia.estado === "tarde" && asistencia.fecha !== sabadoAnterior) resumen.minutosTarde += Number(asistencia.minutos_tarde) || 0;
    porUsuario.set(asistencia.userId, resumen);
  }
  return { desde, hasta, porUsuario };
};

const obtenerOSortearFrancos = async (sabado, empleados, maxMinutosTarde) => {
  let existentes = await FrancoSabado.findAll({
    where: { fecha: sabado },
    include: [{ model: User, as: "empleado", attributes: ["id", "nombre"] }],
    order: [["id", "ASC"]],
  });
  if (existentes.length >= 3) return existentes.slice(0, 3);

  const sabadoAnterior = sumarDias(sabado, -7);
  const francosAnteriores = await FrancoSabado.findAll({ where: { fecha: sabadoAnterior }, attributes: ["userId"] });
  const idsAnteriores = new Set(francosAnteriores.map(({ userId }) => userId));
  const { porUsuario } = await obtenerResumenSemana(empleados, sabado);
  const candidatos = empleados
    .filter((empleado) => !existentes.some((franco) => franco.userId === empleado.id) && !idsAnteriores.has(empleado.id))
    .map((empleado) => {
      const resumen = porUsuario.get(empleado.id) || { faltas: 0, minutosTarde: 0 };
      const cumplioRegla = resumen.faltas === 0 && resumen.minutosTarde <= maxMinutosTarde;
      return { empleado, cumplioRegla };
    });
  const verdes = barajar(candidatos.filter(({ cumplioRegla }) => cumplioRegla));
  const rojos = barajar(candidatos.filter(({ cumplioRegla }) => !cumplioRegla));
  const seleccionados = [...verdes, ...rojos].slice(0, 3);
  if (existentes.length + seleccionados.length < 3) {
    return { error: "No hay tres empleados disponibles sin repetir el sorteo del sábado anterior.", francos: existentes };
  }

  try {
    const nuevos = await FrancoSabado.bulkCreate(seleccionados.map(({ empleado, cumplioRegla }) => ({
      fecha: sabado,
      userId: empleado.id,
      cumplio_regla: cumplioRegla,
    })));
    existentes = [...existentes, ...nuevos];
  } catch (error) {
    const filasActuales = await FrancoSabado.findAll({
      where: { fecha: sabado },
      include: [{ model: User, as: "empleado", attributes: ["id", "nombre"] }],
      order: [["id", "ASC"]],
    });
    if (filasActuales.length < 3) throw error;
    existentes = filasActuales;
  }

  if (existentes.some((franco) => !franco.empleado)) {
    existentes = await FrancoSabado.findAll({
      where: { fecha: sabado },
      include: [{ model: User, as: "empleado", attributes: ["id", "nombre"] }],
      order: [["id", "ASC"]],
    });
  }
  return existentes.slice(0, 3);
};

export const getCodigoHoy = async (_req, res) => {
  try {
    const codigo = await generarCodigo(getFechaLocal());
    res.json({ fecha: codigo.fecha, codigo: codigo.codigo });
  } catch (error) {
    res.status(500).json({ message: "No se pudo obtener el código del día", error: error.message });
  }
};

export const getMiAsistenciaHoy = async (req, res) => {
  try {
    const fecha = getFechaLocal();
    const calendario = await obtenerCalendarioNoLaborable(fecha, fecha);
    const motivo = motivoNoLaborable(fecha, calendario);
    const franco = await FrancoSabado.findOne({ where: { fecha, userId: req.user.id } });
    if (franco) return res.json({ fecha, asistencia: { estado: "franco", fecha } });

    const [asistencia, cierre] = await Promise.all([
      Asistencia.findOne({ where: { fecha, userId: req.user.id } }),
      CierreCaja.findOne({ where: { fecha }, attributes: ["id"] }),
    ]);
    if (asistencia && asistencia.estado !== "ausente") return res.json({ fecha, asistencia });
    if (motivo) return res.json({ fecha, asistencia: { ...motivo, fecha } });
    if (asistencia?.estado === "ausente" && !cierre) return res.json({ fecha, asistencia: null });
    res.json({ fecha, asistencia });
  } catch (error) {
    res.status(500).json({ message: "No se pudo consultar el ingreso de hoy", error: error.message });
  }
};

export const marcarIngreso = async (req, res) => {
  try {
    const fecha = getFechaLocal();
    const codigoIngresado = String(req.body?.codigo || "").trim();
    if (!/^\d{6}$/.test(codigoIngresado)) return res.status(400).json({ message: "Ingresa el código de 6 dígitos que informó el administrador" });

    const franco = await FrancoSabado.findOne({ where: { fecha, userId: req.user.id } });
    if (franco) return res.status(409).json({ message: "Hoy tienes franco; no necesitas registrar ingreso" });
    const calendario = await obtenerCalendarioNoLaborable(fecha, fecha);
    if (motivoNoLaborable(fecha, calendario)) return res.status(409).json({ message: "Hoy no es un día laborable; no necesitas registrar ingreso" });
    const cierre = await CierreCaja.findOne({ where: { fecha }, attributes: ["id"] });
    if (cierre) return res.status(409).json({ message: "La caja ya se cerró y el registro de ingreso de hoy está finalizado" });

    const codigoDelDia = await HorarioCodigo.findOne({ where: { fecha, codigo: codigoIngresado } });
    if (!codigoDelDia) return res.status(400).json({ message: "El código no corresponde al día de hoy" });

    const existente = await Asistencia.findOne({ where: { fecha, userId: req.user.id } });
    if (existente && existente.estado !== "ausente") {
      return res.status(409).json({ message: "Ya registraste tu ingreso de hoy" });
    }

    const ahora = new Date();
    const partesHora = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(ahora);
    const partes = Object.fromEntries(partesHora.map(({ type, value }) => [type, value]));
    const minutosDia = Number(partes.hour) * 60 + Number(partes.minute);
    const minutosTarde = Math.max(0, minutosDia - (6 * 60 + 20));
    const datos = {
      fecha,
      userId: req.user.id,
      hora_ingreso: `${partes.hour}:${partes.minute}:${partes.second}`,
      estado: minutosTarde > 0 ? "tarde" : "puntual",
      minutos_tarde: minutosTarde,
    };
    let asistencia;
    try {
      asistencia = existente ? await existente.update(datos) : await Asistencia.create(datos);
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Ya registraste tu ingreso de hoy" });
      throw error;
    }
    res.status(201).json({ message: "Ingreso registrado", asistencia });
  } catch (error) {
    res.status(500).json({ message: "No se pudo registrar el ingreso", error: error.message });
  }
};

export const getResumenHorarios = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();
    if (!fechaValida(fecha)) return res.status(400).json({ message: "Fecha inválida" });
    const hoy = getFechaLocal();
    const sabado = sabadoProximo(fecha);
    const [empleados, config] = await Promise.all([buscarEmpleados(), obtenerConfiguracion()]);
    const { desde, hasta, porUsuario } = await obtenerResumenSemana(empleados, sabado);
    const francosDia = await FrancoSabado.findAll({ where: { fecha } });
    const empleadosDeFranco = new Set(francosDia.map(({ userId }) => userId));
    const asistenciasDia = await Asistencia.findAll({ where: { fecha } });
    const porDia = new Map(asistenciasDia.map((asistencia) => [asistencia.userId, asistencia]));
    const motivoDiaNoLaborable = motivoNoLaborable(fecha, await obtenerCalendarioNoLaborable(fecha, fecha));

    let francosSabado = await FrancoSabado.findAll({
      where: { fecha: sabado },
      include: [{ model: User, as: "empleado", attributes: ["id", "nombre"] }],
      order: [["id", "ASC"]],
    });
    let avisoSorteo = "";
    const hoyEsViernesOSabado = [5, 6].includes(diaSemana(hoy));
    const motivoSabadoNoLaborable = motivoNoLaborable(sabado, await obtenerCalendarioNoLaborable(sabado, sabado));
    if (motivoSabadoNoLaborable) {
      francosSabado = [];
      if (fecha === hoy && diaSemana(hoy) === 5) {
        avisoSorteo = `El sábado ${sabado} es ${motivoSabadoNoLaborable.estado === "feriado" ? `feriado (${motivoSabadoNoLaborable.nombre})` : "no laborable"}; no habrá sorteo de francos.`;
      }
    } else if (fecha === hoy && hoyEsViernesOSabado && francosSabado.length < 3) {
      const cierreViernes = await CierreCaja.findOne({ where: { fecha: hasta }, attributes: ["id"] });
      if (!cierreViernes) {
        avisoSorteo = "El sorteo se realizará después del cierre de caja del viernes, cuando estén confirmadas las asistencias de la semana.";
      } else {
        const resultado = await obtenerOSortearFrancos(sabado, empleados, config.max_minutos_tarde);
        if (Array.isArray(resultado)) francosSabado = resultado;
        else {
          francosSabado = resultado.francos;
          avisoSorteo = resultado.error;
        }
      }
    }

    const listado = empleados.map((empleado) => {
      const resumen = porUsuario.get(empleado.id) || { faltas: 0, minutosTarde: 0 };
      const asistenciaDia = porDia.get(empleado.id);
      const francoHoy = empleadosDeFranco.has(empleado.id);
      const elegible = resumen.faltas === 0 && resumen.minutosTarde <= config.max_minutos_tarde;
      return {
        id: empleado.id,
        nombre: empleado.nombre,
        rol: empleado.Role?.nombre || "-",
        asistencia: francoHoy ? { estado: "franco" } : motivoDiaNoLaborable && asistenciaDia?.estado === "ausente" ? motivoDiaNoLaborable : asistenciaDia || (motivoDiaNoLaborable ? motivoDiaNoLaborable : null),
        faltasSemana: resumen.faltas,
        minutosTardeSemana: resumen.minutosTarde,
        elegible,
      };
    });

    res.json({
      fecha,
      semana: { desde, hasta },
      fechaSabado: sabado,
      max_minutos_tarde: config.max_minutos_tarde,
      empleados: listado,
      francosSabado: francosSabado.map((franco) => ({
        userId: franco.userId,
        nombre: franco.empleado?.nombre || "Empleado",
        cumplio_regla: franco.cumplio_regla,
      })),
      avisoSorteo,
      mostrarAvisoViernes: fecha === hoy && diaSemana(hoy) === 5,
      motivoDiaNoLaborable,
      motivoSabadoNoLaborable,
    });
  } catch (error) {
    res.status(500).json({ message: "No se pudo cargar el horario", error: error.message });
  }
};

export const getDiasNoLaborables = async (_req, res) => {
  try {
    const [dias, feriados] = await Promise.all([
      DiaNoLaboralSemana.findAll({ where: { dia_semana: { [Op.between]: [0, 5] } }, order: [["dia_semana", "ASC"]] }),
      Feriado.findAll({ order: [["fecha", "ASC"]] }),
    ]);
    res.json({ diasSemana: dias.map(({ dia_semana }) => Number(dia_semana)), feriados });
  } catch (error) {
    res.status(500).json({ message: "No se pudo cargar el calendario laboral", error: error.message });
  }
};

export const actualizarDiasNoLaborables = async (req, res) => {
  const dias = req.body?.diasSemana;
  if (!Array.isArray(dias) || dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 5)) {
    return res.status(400).json({ message: "Selecciona días válidos de domingo a viernes; el sábado se rige por los francos asignados" });
  }
  try {
    await DiaNoLaboralSemana.sequelize.transaction(async (transaction) => {
      await DiaNoLaboralSemana.destroy({ where: {}, transaction });
      if (dias.length) {
        await DiaNoLaboralSemana.bulkCreate([...new Set(dias)].map((dia_semana) => ({ dia_semana })), { transaction });
      }
    });
    res.json({ diasSemana: [...new Set(dias)].sort((a, b) => a - b) });
  } catch (error) {
    res.status(500).json({ message: "No se pudieron guardar los días no laborables", error: error.message });
  }
};

export const crearFeriado = async (req, res) => {
  const fecha = String(req.body?.fecha || "");
  const nombre = String(req.body?.nombre || "").trim();
  if (!fechaValida(fecha)) return res.status(400).json({ message: "Fecha de feriado inválida" });
  if (!nombre || nombre.length > 120) return res.status(400).json({ message: "El nombre debe tener entre 1 y 120 caracteres" });
  try {
    const [feriado, creado] = await Feriado.findOrCreate({ where: { fecha }, defaults: { fecha, nombre } });
    if (!creado) return res.status(409).json({ message: "Ya existe un feriado cargado para esa fecha" });
    res.status(201).json(feriado);
  } catch (error) {
    res.status(500).json({ message: "No se pudo guardar el feriado", error: error.message });
  }
};

export const eliminarFeriado = async (req, res) => {
  try {
    const eliminados = await Feriado.destroy({ where: { id: req.params.id } });
    if (!eliminados) return res.status(404).json({ message: "No se encontró el feriado" });
    res.json({ message: "Feriado eliminado" });
  } catch (error) {
    res.status(500).json({ message: "No se pudo eliminar el feriado", error: error.message });
  }
};

export const actualizarConfiguracionHorarios = async (req, res) => {
  const maxMinutos = Number(req.body?.max_minutos_tarde);
  if (!Number.isInteger(maxMinutos) || maxMinutos < 0 || maxMinutos > 6000) {
    return res.status(400).json({ message: "El máximo debe ser un número entero entre 0 y 6000 minutos" });
  }
  try {
    const config = await obtenerConfiguracion();
    await config.update({ max_minutos_tarde: maxMinutos });
    const hoy = getFechaLocal();
    let avisoSorteo = "";
    if (diaSemana(hoy) === 5) {
      const sabado = sumarDias(hoy, 1);
      const motivoSabado = motivoNoLaborable(sabado, await obtenerCalendarioNoLaborable(sabado, sabado));
      const cierreHoy = motivoSabado ? null : await CierreCaja.findOne({ where: { fecha: hoy }, attributes: ["id"] });
      if (motivoSabado) {
        avisoSorteo = `El sábado ${sabado} es día no laborable; no se generará el sorteo de francos.`;
      } else if (cierreHoy) {
        await FrancoSabado.destroy({ where: { fecha: sabado } });
        const empleados = await buscarEmpleados();
        const resultado = await obtenerOSortearFrancos(sabado, empleados, config.max_minutos_tarde);
        if (!Array.isArray(resultado)) avisoSorteo = resultado.error;
      }
    }
    res.json({ max_minutos_tarde: config.max_minutos_tarde, avisoSorteo });
  } catch (error) {
    res.status(500).json({ message: "No se pudo guardar la tolerancia", error: error.message });
  }
};
