import { CierreCaja, SalidaCamion, SalidaCamionItem, Producto, Venta, VentaItem, VentaPago, Cliente, ClientePago, User, Role, Proveedor, GastoDia, PagoEmpleado, ProveedorMovimiento } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";
import { Op } from "sequelize";

const normalizarMonto = (valor) => {
  const monto = Number(valor);
  return Number.isFinite(monto) && monto >= 0 ? monto : 0;
};

const checkDayClosed = async (fecha) => {
  const cierre = await CierreCaja.findOne({ where: { fecha } });
  return !!cierre;
};

const agruparGastosPorZona = (salidas) => {
  const gastos = {};
  for (const salida of salidas) {
    const zona = String(salida.destino || "Sin zona").trim() || "Sin zona";
    if (!gastos[zona]) gastos[zona] = { zona, combustible: 0, otros: 0 };
    gastos[zona].combustible += parseFloat(salida.gastos_combustible) || 0;
    gastos[zona].otros += parseFloat(salida.gastos_otros) || 0;
  }
  return Object.values(gastos).map((gasto) => ({ ...gasto, total: gasto.combustible + gasto.otros }));
};

export const getResumenDelDia = async (req, res) => {
  try {
    const today = getFechaLocal();
    const fecha = req.query.fecha || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    const salidasHoy = await SalidaCamion.findAll({
      where: { fecha, estado: { [Op.ne]: "cancelado" } },
      include: [
        {
          model: SalidaCamionItem,
            include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "kg_por_caja"] }],
        },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
        { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
      ],
    });

    let mercaderia_enviada = 0;
    let mercaderia_devuelta = 0;
    const detalle_enviadas = [];
    const detalle_devueltas = [];

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        const valor = normalizarMonto(item.precio_unitario) * normalizarMonto(item.cantidad);
        mercaderia_enviada += valor;
        detalle_enviadas.push({
          producto: item.Producto?.nombre || "Desconocido",
          cantidad: item.cantidad,
          precio_unitario: normalizarMonto(item.precio_unitario),
          subtotal: valor,
          camion: salida.camion,
          salida_id: salida.id,
          repartidor: salida.repartidor_asignado?.nombre || "Sin asignar",
        });
        if (item.cantidad_devuelta && item.cantidad_devuelta > 0) {
          const valorDevuelto = normalizarMonto(item.precio_unitario) * normalizarMonto(item.cantidad_devuelta);
          mercaderia_devuelta += valorDevuelto;
          detalle_devueltas.push({
            producto: item.Producto?.nombre || "Desconocido",
            cantidad: item.cantidad_devuelta,
            precio_unitario: normalizarMonto(item.precio_unitario),
            subtotal: valorDevuelto,
            camion: salida.camion,
            salida_id: salida.id,
            repartidor: salida.repartidor_asignado?.nombre || "Sin asignar",
          });
        }
      }
    }

    const ventasHoy = await Venta.findAll({
      where: { fecha, estado: "completada" },
      include: [
        {
          model: VentaItem,
           include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "kg_por_caja"] }],
        },
      ],
    });

    let localMonto = 0;
    let localCount = 0;
    let repartoMonto = 0;
    let repartoCount = 0;

    for (const venta of ventasHoy) {
      const monto = normalizarMonto(venta.total);
      if (venta.tipo_venta === "local") {
        localMonto += monto;
        localCount++;
      } else {
        repartoMonto += monto;
        repartoCount++;
      }
    }

    const totalGeneral = localMonto + repartoMonto;
    const ventas_netas = mercaderia_enviada - mercaderia_devuelta;
    const gastosPorZona = agruparGastosPorZona(salidasHoy);

    const cierreExistente = await CierreCaja.findOne({ where: { fecha } });

    res.json({
      fecha,
      salidas_count: salidasHoy.length,
      mercaderia_enviada: mercaderia_enviada.toFixed(2),
      mercaderia_devuelta: mercaderia_devuelta.toFixed(2),
      ventas_netas_envio: ventas_netas.toFixed(2),
      local_monto: localMonto.toFixed(2),
      local_count: localCount,
      reparto_monto: repartoMonto.toFixed(2),
      reparto_count: repartoCount,
      total_general: totalGeneral.toFixed(2),
      gastos_combustible: gastosPorZona.reduce((sum, gasto) => sum + gasto.combustible, 0).toFixed(2),
      gastos_otros: gastosPorZona.reduce((sum, gasto) => sum + gasto.otros, 0).toFixed(2),
      gastos_por_zona: gastosPorZona,
      cerrado: !!cierreExistente,
      cierre: cierreExistente || null,
      detalle_enviadas,
      detalle_devueltas,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener resumen del dia", error: error.message });
  }
};

const calcularDiasDiferencia = (fecha, referencia) => {
  const [a1, m1, d1] = fecha.split("-").map(Number);
  const [a2, m2, d2] = referencia.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
};

export const cerrarCaja = async (req, res) => {
  try {
    const hoy = getFechaLocal();
    let fechaCierre = hoy;

    if (req.body?.fecha) {
      fechaCierre = req.body.fecha;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCierre)) {
        return res.status(400).json({ message: "Fecha inválida" });
      }
      const diasAtras = calcularDiasDiferencia(fechaCierre, hoy);
      if (diasAtras < 0 || diasAtras > 2) {
        return res.status(400).json({ message: "Solo se puede cerrar la caja del día actual o de los últimos 2 días" });
      }
    }

    const cierreExistente = await CierreCaja.findOne({ where: { fecha: fechaCierre } });
    if (cierreExistente) {
      return res.status(400).json({ message: "La caja ya fue cerrada para este dia" });
    }

    const salidasHoy = await SalidaCamion.findAll({
      where: { fecha: fechaCierre, estado: { [Op.ne]: "cancelado" } },
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
      ],
    });

    let mercaderia_enviada = 0;
    let mercaderia_devuelta = 0;

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        const valor = normalizarMonto(item.precio_unitario) * normalizarMonto(item.cantidad);
        mercaderia_enviada += valor;
        if (item.cantidad_devuelta && item.cantidad_devuelta > 0) {
          mercaderia_devuelta += normalizarMonto(item.precio_unitario) * normalizarMonto(item.cantidad_devuelta);
        }
      }
    }

    const ventasHoy = await Venta.findAll({
      where: { fecha: fechaCierre, estado: "completada" },
    });

    let localMonto = 0;
    let repartoMonto = 0;

    for (const venta of ventasHoy) {
      const monto = normalizarMonto(venta.total);
      if (venta.tipo_venta === "local") {
        localMonto += monto;
      } else {
        repartoMonto += monto;
      }
    }

    const totalGeneral = localMonto + repartoMonto;
    const ventas_netas = mercaderia_enviada - mercaderia_devuelta;
    const gastosPorZona = agruparGastosPorZona(salidasHoy);
    const gastosCombustible = gastosPorZona.reduce((sum, gasto) => sum + gasto.combustible, 0);
    const gastosOtros = gastosPorZona.reduce((sum, gasto) => sum + gasto.otros, 0);
    const pagosEmpleados = await PagoEmpleado.findAll({
      where: { fecha: fechaCierre },
      include: [{ model: User, as: "empleado", attributes: ["id", "nombre"], include: [{ model: Role, attributes: ["nombre"] }] }],
    });
    const pagosEmpleadosSnapshot = pagosEmpleados.map((pago) => ({
      userId: pago.userId,
      nombre: pago.empleado?.nombre || "Empleado",
      rol: pago.empleado?.Role?.nombre || "-",
      monto: parseFloat(pago.monto) || 0,
    }));
    const now = new Date();
    const hora = now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const cierre = await CierreCaja.create({
      fecha: fechaCierre,
      hora,
      total_ventas: totalGeneral.toFixed(2),
      salidas_count: salidasHoy.length,
      mercaderia_enviada: mercaderia_enviada.toFixed(2),
      mercaderia_devuelta: mercaderia_devuelta.toFixed(2),
      ventas_netas: ventas_netas.toFixed(2),
      usuario_cierre: req.user.nombre,
      gastos_combustible: gastosCombustible.toFixed(2),
      gastos_otros: gastosOtros.toFixed(2),
      gastos_por_zona: JSON.stringify(gastosPorZona),
      descripcion_otros_gastos: "",
      pagos_empleados: JSON.stringify(pagosEmpleadosSnapshot),
    });

    const salidasEnCamino = await SalidaCamion.findAll({
      where: { fecha: fechaCierre, estado: "en_camino" },
    });
    for (const salida of salidasEnCamino) {
      await salida.update({ estado: "sobrante" });
    }

    res.status(201).json({ message: "Caja cerrada exitosamente", cierre });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar caja", error: error.message });
  }
};

export const getHistorialCierres = async (req, res) => {
  try {
    const cierres = await CierreCaja.findAll({
      order: [["fecha", "DESC"], ["createdAt", "DESC"]],
    });
    res.json(cierres.map((cierre) => ({
      ...cierre.toJSON(),
      total_ventas: normalizarMonto(cierre.total_ventas).toFixed(2),
      mercaderia_enviada: normalizarMonto(cierre.mercaderia_enviada).toFixed(2),
      mercaderia_devuelta: normalizarMonto(cierre.mercaderia_devuelta).toFixed(2),
      ventas_netas: normalizarMonto(cierre.ventas_netas).toFixed(2),
    })));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial", error: error.message });
  }
};

export const abrirCaja = async (req, res) => {
  try {
    const { fecha } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    const hoy = getFechaLocal();

    const cierre = await CierreCaja.findOne({ where: { fecha } });
    if (!cierre) {
      return res.status(404).json({ message: "No existe un cierre para esa fecha (la caja ya está abierta)" });
    }

    if (fecha !== hoy) {
      const diasAtras = calcularDiasDiferencia(fecha, hoy);
      if (diasAtras < 1) {
        return res.status(400).json({ message: "No se puede abrir una caja con fecha futura" });
      }
      if (diasAtras > 2) {
        return res.status(400).json({ message: "Solo se pueden abrir las cajas de los últimos 2 días" });
      }
    }

    await cierre.destroy();
    res.json({ message: "Caja abierta correctamente. Ya puede volver a cerrarla" });
  } catch (error) {
    res.status(500).json({ message: "Error al abrir caja", error: error.message });
  }
};

export const eliminarCierre = async (req, res) => {
  try {
    const { fecha } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: "Fecha inválida" });
    }
    if (fecha === getFechaLocal()) {
      return res.status(400).json({ message: "Para el cierre de hoy use la opción Abrir" });
    }

    const cierre = await CierreCaja.findOne({ where: { fecha } });
    if (!cierre) {
      return res.status(404).json({ message: "No existe cierre para esa fecha" });
    }

    await cierre.destroy();
    res.json({ message: "Cierre eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar cierre", error: error.message });
  }
};

const parsePagosEmpleados = (valor) => {
  if (!valor) return [];
  try { return typeof valor === "string" ? JSON.parse(valor) : valor; } catch { return []; }
};

export const getHistorialGastos = async (req, res) => {
  try {
    const cierres = await CierreCaja.findAll({
      attributes: ["id", "fecha", "hora", "usuario_cierre", "gastos_combustible", "gastos_otros", "descripcion_otros_gastos"],
      order: [["fecha", "DESC"]],
    });
    const fechasCerradas = new Set(cierres.map((cierre) => cierre.fecha));
    const gastosDia = fechasCerradas.size === 0
      ? await GastoDia.findAll({ order: [["fecha", "DESC"]] })
      : await GastoDia.findAll({
          where: { fecha: { [Op.notIn]: [...fechasCerradas] } },
          order: [["fecha", "DESC"]],
        });
    const registros = [
      ...cierres.map((cierre) => ({
        ...cierre.toJSON(),
        total: (parseFloat(cierre.gastos_combustible) || 0) + (parseFloat(cierre.gastos_otros) || 0),
      })),
      ...gastosDia.map((gasto) => ({
        id: `g${gasto.id}`,
        fecha: gasto.fecha,
        hora: null,
        usuario_cierre: "Sin cierre",
        gastos_combustible: gasto.combustible,
        gastos_otros: gasto.otros,
        descripcion_otros_gastos: gasto.descripcion_otros || "",
        total: (parseFloat(gasto.combustible) || 0) + (parseFloat(gasto.otros) || 0),
        pendiente_cierre: true,
      })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.hora || "").localeCompare(String(a.hora || "")));
    res.json(registros);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de gastos", error: error.message });
  }
};

export const getHistorialPagosEmpleados = async (req, res) => {
  try {
    const cierres = await CierreCaja.findAll({
      attributes: ["id", "fecha", "hora", "usuario_cierre", "pagos_empleados"],
      order: [["fecha", "DESC"]],
    });
    res.json(cierres.map((cierre) => ({
      id: cierre.id,
      fecha: cierre.fecha,
      hora: cierre.hora,
      usuario_cierre: cierre.usuario_cierre,
      pagos: parsePagosEmpleados(cierre.pagos_empleados),
    })).filter((registro) => registro.pagos.length > 0));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de pagos a empleados", error: error.message });
  }
};

export const getResumenIngresosEgresos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return res.status(400).json({ message: "Debe indicar fechas validas desde y hasta" });
    }
    if (desde > hasta) {
      return res.status(400).json({ message: "La fecha desde no puede ser posterior a hasta" });
    }

    const cierres = await CierreCaja.findAll({
      where: { fecha: { [Op.between]: [desde, hasta] } },
      order: [["fecha", "ASC"]],
    });

    const ventas = await Venta.findAll({
      where: { fecha: { [Op.between]: [desde, hasta] }, estado: "completada" },
      attributes: ["fecha", "total"],
      include: [{ model: VentaItem, attributes: ["cantidad", "costo_unitario"], include: [{ model: Producto, attributes: ["costo"] }] }],
    });
    const salidas = await SalidaCamion.findAll({
      where: { fecha: { [Op.between]: [desde, hasta] }, estado: { [Op.ne]: "cancelado" } },
      attributes: ["fecha", "destino", "gastos_combustible", "gastos_otros"],
    });
    const costosPorFecha = {};
    const ventasPorFecha = {};
    for (const venta of ventas) {
      ventasPorFecha[venta.fecha] = (ventasPorFecha[venta.fecha] || 0) + (parseFloat(venta.total) || 0);
      costosPorFecha[venta.fecha] = (costosPorFecha[venta.fecha] || 0) + (venta.VentaItems || []).reduce((sum, item) => {
        const costo = parseFloat(item.costo_unitario) || parseFloat(item.Producto?.costo) || 0;
        return sum + costo * (item.cantidad || 0);
      }, 0);
    }
    const movimientos = await ProveedorMovimiento.findAll({ where: { fecha: { [Op.between]: [desde, hasta] } } });
    const comprasPorFecha = {};
    for (const movimiento of movimientos) {
      comprasPorFecha[movimiento.fecha] = (comprasPorFecha[movimiento.fecha] || 0) + (parseFloat(movimiento.mercaderias_compradas) || 0);
    }
    const gastosPorFecha = {};
    for (const salida of salidas) {
      const fecha = String(salida.fecha).slice(0, 10);
      const zona = String(salida.destino || "Sin zona").trim() || "Sin zona";
      if (!gastosPorFecha[fecha]) gastosPorFecha[fecha] = {};
      if (!gastosPorFecha[fecha][zona]) gastosPorFecha[fecha][zona] = { zona, combustible: 0, otros: 0 };
      gastosPorFecha[fecha][zona].combustible += parseFloat(salida.gastos_combustible) || 0;
      gastosPorFecha[fecha][zona].otros += parseFloat(salida.gastos_otros) || 0;
    }
    const cierresPorFecha = new Map(cierres.map((cierre) => [cierre.fecha, cierre]));
    const fechas = new Set([...cierres.map((cierre) => cierre.fecha), ...Object.keys(ventasPorFecha), ...Object.keys(comprasPorFecha), ...Object.keys(gastosPorFecha)]);

    const detalle = [...fechas].sort().map((fecha) => {
      const cierre = cierresPorFecha.get(fecha);
      const combustible = parseFloat(cierre?.gastos_combustible) || 0;
      const otros = parseFloat(cierre?.gastos_otros) || 0;
      const gastosSalida = Object.values(gastosPorFecha[fecha] || {}).map((gasto) => ({ ...gasto, total: gasto.combustible + gasto.otros }));
      const combustibleSalidas = gastosSalida.reduce((sum, gasto) => sum + gasto.combustible, 0);
      const otrosSalidas = gastosSalida.reduce((sum, gasto) => sum + gasto.otros, 0);
      const usaGastosDeSalidas = combustibleSalidas > 0 || otrosSalidas > 0;
      const combustibleDelDia = usaGastosDeSalidas ? combustibleSalidas : combustible;
      const otrosDelDia = usaGastosDeSalidas ? otrosSalidas : otros;
      const pagos = parsePagosEmpleados(cierre?.pagos_empleados);
      const pagosTotal = pagos.reduce((sum, pago) => sum + (parseFloat(pago.monto) || 0), 0);
      const ingresos = cierre ? parseFloat(cierre.total_ventas) || 0 : ventasPorFecha[fecha] || 0;
      const costoMercaderia = costosPorFecha[fecha] || 0;
      const comprasProveedores = comprasPorFecha[fecha] || 0;
      return {
        fecha,
        usuario_cierre: cierre?.usuario_cierre || "-",
        ingresos,
        combustible: combustibleDelDia,
        otros: otrosDelDia,
        gastos_por_zona: gastosSalida,
        costo_mercaderia: costoMercaderia,
        compras_proveedores: comprasProveedores,
        descripcion_otros: cierre?.descripcion_otros_gastos || "",
        pagos_empleados: pagos,
        pagos_empleados_total: pagosTotal,
        egresos: combustibleDelDia + otrosDelDia + pagosTotal + costoMercaderia + comprasProveedores,
        resultado: ingresos - combustibleDelDia - otrosDelDia - pagosTotal - costoMercaderia - comprasProveedores,
      };
    });

    const resumen = detalle.reduce((totales, dia) => ({
      ingresos: totales.ingresos + dia.ingresos,
      combustible: totales.combustible + dia.combustible,
      otros: totales.otros + dia.otros,
      costo_mercaderia: totales.costo_mercaderia + dia.costo_mercaderia,
      compras_proveedores: totales.compras_proveedores + dia.compras_proveedores,
      pagos_empleados: totales.pagos_empleados + dia.pagos_empleados_total,
      egresos: totales.egresos + dia.egresos,
      resultado: totales.resultado + dia.resultado,
    }), { ingresos: 0, combustible: 0, otros: 0, costo_mercaderia: 0, compras_proveedores: 0, pagos_empleados: 0, egresos: 0, resultado: 0 });

    res.json({ desde, hasta, cierres: cierres.length, resumen, detalle });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener ingresos y egresos", error: error.message });
  }
};

export const getDetalleCierre = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();

    const cierre = await CierreCaja.findOne({ where: { fecha } });
    if (!cierre) {
      return res.status(404).json({ message: "No existe cierre para esa fecha" });
    }

    const salidasHoy = await SalidaCamion.findAll({
      where: { fecha },
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "kg_por_caja"] }],
        },
      ],
    });

    const ventasHoy = await Venta.findAll({
      where: { fecha, estado: "completada" },
      attributes: ["id", "fecha", "hora", "datos_transferencia", "datos_tarjeta", "datos_cheque", "datos_ercheck", "medio_pago", "total", "tipo_venta", "proveedorId"],
      include: [
        { model: VentaPago, attributes: ["medio_pago", "monto"] },
        { model: Proveedor, attributes: ["id", "nombre", "alias"] },
      ],
    });
    const pagosClientesHoy = await ClientePago.findAll({
      where: { fecha },
      include: [
        { model: Cliente, attributes: ["id", "nombre"] },
        { model: Proveedor, attributes: ["id", "nombre", "alias"] },
      ],
    });
    const proveedores = await Proveedor.findAll({ attributes: ["id", "nombre", "alias"] });
    const proveedoresPorId = new Map(proveedores.map((p) => [p.id, { id: p.id, nombre: p.nombre, alias: p.alias }]));
    const proveedoresPorAlias = new Map(proveedores.filter((p) => p.alias).map((p) => [p.alias.trim().toLowerCase(), { id: p.id, nombre: p.nombre, alias: p.alias }]));

    let kg_enviados = 0;
    let kg_devueltos = 0;

    const calcularKilos = (item) => {
      const cantidad = Number(item.cantidad) || 0;
      const kgPorCaja = Number(item.Producto?.kg_por_caja) || 0;
      const unidad = String(item.Producto?.unidad || "").toLowerCase();
      if (unidad === "kilogramo" || unidad === "kg") return cantidad;
      if (kgPorCaja > 0) return cantidad * kgPorCaja;
      return 0;
    };

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        kg_enviados += calcularKilos(item);
        if (item.cantidad_devuelta) {
          kg_devueltos += calcularKilos({ ...item.toJSON(), cantidad: item.cantidad_devuelta });
        }
      }
    }

    const parseDatos = (datos) => {
      if (!datos) return [];
      if (typeof datos === "string") {
        try {
          const parsed = JSON.parse(datos);
          if (typeof parsed === "string") return JSON.parse(parsed);
          return parsed;
        } catch { return []; }
      }
      if (Array.isArray(datos)) return datos;
      if (typeof datos === "object") return [datos];
      return [];
    };

    const pagos = [];
    let localMonto = 0;
    let localCount = 0;
    let repartoMonto = 0;
    let repartoCount = 0;

    for (const venta of ventasHoy) {
      const monto = normalizarMonto(venta.total);
      if (venta.tipo_venta === "local") {
        localMonto += monto;
        localCount++;
      } else {
        repartoMonto += monto;
        repartoCount++;
      }

      const proveedor = venta.Proveedor;
      const proveedorInfo = proveedor ? { id: proveedor.id, nombre: proveedor.nombre, alias: proveedor.alias } : null;

      for (const t of parseDatos(venta.datos_transferencia)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Transferencia",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.titular || t.nombre_cuenta || t.cuenta || "-",
          titular: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_tarjeta)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Tarjeta",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.titular || t.nombre_cuenta || t.cuenta || "-",
          titular: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_cheque)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Cheque",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_ercheck)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "ER Check",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      // Ventas con pago dividido: la porcion en efectivo vive en VentaPago
      // (Venta.medio_pago queda como "dividido"). Ventas viejas sin VentaPagos
      // conservan la clasificacion historica por medio_pago.
      const pagosVenta = Array.isArray(venta.VentaPagos) ? venta.VentaPagos : [];
      const efectivoVenta = pagosVenta
        .filter((p) => String(p.medio_pago || "").toLowerCase() === "efectivo")
        .reduce((suma, p) => suma + (parseFloat(p.monto) || 0), 0);
      // VentaPago es la fuente actual luego de modificar una factura. Solo
      // usamos los campos antiguos de Venta cuando no hay registros de pago.
      if (pagosVenta.length === 0 && venta.medio_pago === "efectivo"
        && (!venta.datos_transferencia || parseDatos(venta.datos_transferencia).length === 0)
        && (!venta.datos_tarjeta || parseDatos(venta.datos_tarjeta).length === 0)) {
        pagos.push({
          tipo: "Efectivo",
          fecha_hora: `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: "-",
          monto: monto,
          banco: "-",
          proveedor: null,
        });
      } else if (pagosVenta.length > 0 && efectivoVenta > 0) {
        pagos.push({
          tipo: "Efectivo",
          fecha_hora: `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: "-",
          monto: efectivoVenta,
          banco: "-",
          proveedor: null,
        });
      }
    }

    for (const pago of pagosClientesHoy) {
      const transferencia = parseDatos(pago.datos_transferencia)[0];
      const tarjeta = parseDatos(pago.datos_tarjeta)[0];
      const cheque = parseDatos(pago.datos_cheque)[0];
      const ercheck = parseDatos(pago.datos_ercheck)[0];
      const datos = transferencia || tarjeta || cheque || ercheck;
      const medioPago = String(pago.medio_pago || "otro").toLowerCase();
      const proveedorPago = pago.Proveedor
        ? { id: pago.Proveedor.id, nombre: pago.Proveedor.nombre, alias: pago.Proveedor.alias }
        : datos?.proveedorId
          ? proveedoresPorId.get(Number(datos.proveedorId))
          : datos?.alias ? proveedoresPorAlias.get(String(datos.alias).trim().toLowerCase()) : null;
      pagos.push({
        tipo: transferencia || medioPago === "transferencia" ? "Transferencia" : tarjeta || medioPago === "tarjeta" ? "Tarjeta" : cheque || medioPago === "cheque" ? "Cheque" : ercheck || medioPago === "ercheck" ? "ER Check" : medioPago === "efectivo" ? "Efectivo" : "Otro",
        fecha_hora: datos?.fecha_hora || `${pago.fecha} ${pago.hora}`,
        nombre_cuenta: pago.titular || datos?.nombre_cuenta || datos?.titular || datos?.cuenta || "-",
        titular: pago.titular || datos?.titular || datos?.nombre_cuenta || datos?.cuenta || "-",
        alias: datos?.alias || proveedorPago?.alias || "-",
        monto: parseFloat(pago.monto) || 0,
        banco: pago.banco || datos?.banco || datos?.nombre_banco || "-",
        proveedor: proveedorPago,
        cliente: pago.Cliente?.nombre || "-",
      });
    }

    res.json({
      fecha: cierre.fecha,
      hora: cierre.hora,
      usuario_cierre: cierre.usuario_cierre,
      salidas_count: cierre.salidas_count,
      mercaderia_enviada: normalizarMonto(cierre.mercaderia_enviada).toFixed(2),
      mercaderia_devuelta: normalizarMonto(cierre.mercaderia_devuelta).toFixed(2),
      ventas_netas: normalizarMonto(cierre.ventas_netas).toFixed(2),
      total_ventas: normalizarMonto(cierre.total_ventas).toFixed(2),
      gastos_combustible: cierre.gastos_combustible,
      gastos_otros: cierre.gastos_otros,
      descripcion_otros_gastos: cierre.descripcion_otros_gastos,
      pagos_empleados: parsePagosEmpleados(cierre.pagos_empleados),
      local_monto: localMonto.toFixed(2),
      local_count: localCount,
      reparto_monto: repartoMonto.toFixed(2),
      reparto_count: repartoCount,
      kg_pollos: kg_enviados,
      kg_devueltos: kg_devueltos,
      pagos,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener detalle del cierre", error: error.message });
  }
};

export const getPagosHoy = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();

    const ventasHoy = await Venta.findAll({
      where: { fecha, estado: "completada" },
      attributes: ["id", "fecha", "hora", "datos_transferencia", "datos_tarjeta", "datos_cheque", "datos_ercheck", "medio_pago", "total", "proveedorId"],
      include: [{ model: Proveedor, attributes: ["id", "nombre", "alias"] }],
    });
    const pagosClientesHoy = await ClientePago.findAll({
      where: { fecha },
      include: [
        { model: Cliente, attributes: ["id", "nombre"] },
        { model: Proveedor, attributes: ["id", "nombre", "alias"] },
      ],
    });
    const proveedores = await Proveedor.findAll({ attributes: ["id", "nombre", "alias"] });
    const proveedoresPorId = new Map(proveedores.map((p) => [p.id, { id: p.id, nombre: p.nombre, alias: p.alias }]));
    const proveedoresPorAlias = new Map(proveedores.filter((p) => p.alias).map((p) => [p.alias.trim().toLowerCase(), { id: p.id, nombre: p.nombre, alias: p.alias }]));

    const pagos = [];

    const parseDatos = (datos) => {
      if (!datos) return [];
      if (typeof datos === "string") {
        try {
          const parsed = JSON.parse(datos);
          if (typeof parsed === "string") return JSON.parse(parsed);
          return parsed;
        } catch { return []; }
      }
      if (Array.isArray(datos)) return datos;
      if (typeof datos === "object") return [datos];
      return [];
    };

    for (const venta of ventasHoy) {
      const proveedor = venta.Proveedor;
      const proveedorInfo = proveedor ? { id: proveedor.id, nombre: proveedor.nombre, alias: proveedor.alias } : null;

      for (const t of parseDatos(venta.datos_transferencia)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Transferencia",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.titular || t.nombre_cuenta || t.cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_tarjeta)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Tarjeta",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.titular || t.nombre_cuenta || t.cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_cheque)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Cheque",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_ercheck)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "ER Check",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || t.titular || t.cuenta || "-",
          titular: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || t.nombre_banco || "-",
          proveedor: proveedorPago || null,
        });
      }

    }

    for (const pago of pagosClientesHoy) {
      const transferencia = parseDatos(pago.datos_transferencia)[0];
      const tarjeta = parseDatos(pago.datos_tarjeta)[0];
      const cheque = parseDatos(pago.datos_cheque)[0];
      const ercheck = parseDatos(pago.datos_ercheck)[0];
      const datos = transferencia || tarjeta || cheque || ercheck;
      const medioPago = String(pago.medio_pago || "otro").toLowerCase();
      const proveedorPago = pago.Proveedor
        ? { id: pago.Proveedor.id, nombre: pago.Proveedor.nombre, alias: pago.Proveedor.alias }
        : datos?.proveedorId
          ? proveedoresPorId.get(Number(datos.proveedorId))
          : datos?.alias ? proveedoresPorAlias.get(String(datos.alias).trim().toLowerCase()) : null;
      pagos.push({
        tipo: transferencia || medioPago === "transferencia" ? "Transferencia" : tarjeta || medioPago === "tarjeta" ? "Tarjeta" : cheque || medioPago === "cheque" ? "Cheque" : ercheck || medioPago === "ercheck" ? "ER Check" : medioPago === "efectivo" ? "Efectivo" : "Otro",
        fecha_hora: datos?.fecha_hora || `${pago.fecha} ${pago.hora}`,
        nombre_cuenta: pago.titular || datos?.nombre_cuenta || datos?.titular || datos?.cuenta || "-",
        titular: pago.titular || datos?.titular || datos?.nombre_cuenta || datos?.cuenta || "-",
        alias: datos?.alias || proveedorPago?.alias || "-",
        monto: parseFloat(pago.monto) || 0,
        banco: pago.banco || datos?.banco || datos?.nombre_banco || "-",
        proveedor: proveedorPago,
        cliente: pago.Cliente?.nombre || "-",
      });
    }

    // Este endpoint alimenta las tablas de proveedores, no el detalle contable
    // del cierre. Solo deben aparecer pagos bancarios vinculados a un proveedor.
    res.json(pagos.filter((pago) =>
      pago.proveedor?.id && ["Transferencia", "Tarjeta", "Cheque", "ER Check"].includes(pago.tipo)
    ));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pagos del dia", error: error.message });
  }
};

export { checkDayClosed };
