import { Produccion, Producto } from "../models/index.js";
import sequelize from "../config/database.js";
import PDFDocument from "pdfkit";
import { getFechaLocal } from "../utils/fecha.js";

const ratio = (total, cajones) => {
  if (!cajones || cajones <= 0) return 0;
  return Math.round((total / cajones) * 100) / 100;
};

const isoWeekKey = (fecha) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const fechaLocalHoy = () => {
  return getFechaLocal();
};

const currentWeekKey = () => isoWeekKey(fechaLocalHoy());

const currentMonthPrefix = () => fechaLocalHoy().slice(0, 7);

const buildStats = (registros) => {
  const byDate = {};
  for (const r of registros) {
    if (!byDate[r.fecha]) {
      byDate[r.fecha] = { fecha: r.fecha, cajones: 0, alitas: 0, pechugas: 0, pata_muslo: 0, menudos: 0 };
    }
    byDate[r.fecha].cajones += r.cajones || 0;
    byDate[r.fecha].alitas += r.alitas || 0;
    byDate[r.fecha].pechugas += r.pechugas || 0;
    byDate[r.fecha].pata_muslo += r.pata_muslo || 0;
    byDate[r.fecha].menudos += r.menudos || 0;
  }

  const promedioDiario = Object.values(byDate).map((d) => ({
    fecha: d.fecha,
    alitas: ratio(d.alitas, d.cajones),
    pechugas: ratio(d.pechugas, d.cajones),
    pata_muslo: ratio(d.pata_muslo, d.cajones),
    menudos: ratio(d.menudos, d.cajones),
  }));

  const weekly = {};
  for (const r of registros) {
    const key = isoWeekKey(r.fecha);
    if (!weekly[key]) {
      weekly[key] = { cajones: 0, alitas: 0, pechugas: 0, pata_muslo: 0, menudos: 0 };
    }
    weekly[key].cajones += r.cajones || 0;
    weekly[key].alitas += r.alitas || 0;
    weekly[key].pechugas += r.pechugas || 0;
    weekly[key].pata_muslo += r.pata_muslo || 0;
    weekly[key].menudos += r.menudos || 0;
  }

  const promedioSemanal = Object.keys(weekly).sort().map((key) => {
    const w = weekly[key];
    const [year, weekNo] = key.split("-W");
    return {
      key,
      semana: `Semana ${weekNo}/${year}`,
      alitas: ratio(w.alitas, w.cajones),
      pechugas: ratio(w.pechugas, w.cajones),
      pata_muslo: ratio(w.pata_muslo, w.cajones),
      menudos: ratio(w.menudos, w.cajones),
    };
  });

  return { registros, promedioDiario, promedioSemanal };
};

const getAllRegistros = () => Produccion.findAll({ order: [["fecha", "ASC"], ["id", "ASC"]] });

const getStatsForWeek = (registros, semana) => buildStats(
  registros.filter((registro) => isoWeekKey(registro.fecha) === semana)
);

export const getEstadisticasProduccion = async (req, res) => {
  try {
    const registros = await getAllRegistros();
    const semanaActual = currentWeekKey();
    const statsSemana = getStatsForWeek(registros, semanaActual);
    const statsMes = buildStats(registros.filter((registro) => registro.fecha.startsWith(currentMonthPrefix())));
    res.json({
      ...statsSemana,
      promedioSemanal: statsMes.promedioSemanal,
      semanaActual,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadísticas de producción", error: error.message });
  }
};

export const getHistorialProduccion = async (req, res) => {
  try {
    const registros = await getAllRegistros();
    const semanas = [...new Set(registros.map((registro) => isoWeekKey(registro.fecha)))].sort().reverse();
    res.json({
      semanas: semanas.map((semana) => ({
        semana,
        etiqueta: `Semana ${semana.split("-W")[1]}/${semana.split("-W")[0]}`,
        ...getStatsForWeek(registros, semana),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de producción", error: error.message });
  }
};

const drawTable = (doc, title, columns, rows) => {
  doc.fontSize(13).fillColor("#3a5a4a").text(title, { underline: true });
  doc.moveDown(0.3).fontSize(9).fillColor("#222").text(columns.join("    "));
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#b9a777").stroke();
  doc.moveDown(0.25);
  rows.forEach((row) => doc.text(row.join("    ")));
  doc.moveDown(1);
};

export const descargarHistorialProduccionPdf = async (req, res) => {
  try {
    const { semana } = req.params;
    if (!/^\d{4}-W\d{2}$/.test(semana)) {
      return res.status(400).json({ message: "Semana no válida" });
    }

    const registros = await getAllRegistros();
    const stats = getStatsForWeek(registros, semana);
    if (stats.registros.length === 0) {
      return res.status(404).json({ message: "No hay registros para esa semana" });
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=produccion-${semana}.pdf`);
    doc.pipe(res);
    doc.fontSize(20).fillColor("#3a5a4a").text("Historial de Producción");
    doc.fontSize(13).fillColor("#555").text(`Semana ${semana.split("-W")[1]}/${semana.split("-W")[0]}`);
    doc.moveDown(1);
    drawTable(doc, "Registros", ["Fecha", "Cajones", "Alitas", "Pechugas", "Pata Muslo", "Menudos"], stats.registros.map((r) => [
      r.fecha, r.cajones, r.alitas, r.pechugas, r.pata_muslo, r.menudos,
    ]));
    drawTable(doc, "Promedio diario", ["Fecha", "Alitas", "Pechugas", "Pata Muslo", "Menudos"], stats.promedioDiario.map((r) => [
      r.fecha, r.alitas, r.pechugas, r.pata_muslo, r.menudos,
    ]));
    drawTable(doc, "Promedio semanal", ["Semana", "Alitas", "Pechugas", "Pata Muslo", "Menudos"], stats.promedioSemanal.map((r) => [
      r.semana, r.alitas, r.pechugas, r.pata_muslo, r.menudos,
    ]));
    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Error al generar historial PDF", error: error.message });
  }
};

export const createProduccion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { fecha, productos_cajones, alitas, pechugas, pata_muslo, menudos } = req.body;

    if (!fecha) {
      await transaction.rollback();
      return res.status(400).json({ message: "La fecha es obligatoria" });
    }

    if (!Array.isArray(productos_cajones) || productos_cajones.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe cargar al menos un producto en los cajones" });
    }

    const cantidades = productos_cajones.map((item) => ({
      productoId: Number(item.productoId),
      cantidad: Number(item.cantidad),
    }));
    if (cantidades.some((item) => !Number.isInteger(item.productoId) || !Number.isInteger(item.cantidad) || item.cantidad <= 0)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Las cantidades de cajones deben ser enteros mayores a cero" });
    }

    const cantidadPorProducto = new Map();
    for (const item of cantidades) {
      cantidadPorProducto.set(item.productoId, (cantidadPorProducto.get(item.productoId) || 0) + item.cantidad);
    }

    for (const [productoId, cantidad] of cantidadPorProducto) {
      const producto = await Producto.findOne({ where: { id: productoId, activo: true }, transaction, lock: transaction.LOCK.UPDATE });
      if (!producto) {
        await transaction.rollback();
        return res.status(404).json({ message: `Producto ${productoId} no encontrado` });
      }
      if (producto.stock < cantidad) {
        await transaction.rollback();
        return res.status(400).json({ message: `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, solicitado ${cantidad}` });
      }
      await producto.update({ stock: producto.stock - cantidad }, { transaction });
    }

    const cajones = [...cantidadPorProducto.values()].reduce((total, cantidad) => total + cantidad, 0);

    const registro = await Produccion.create({
      fecha,
      cajones,
      alitas: Number.isFinite(Number(alitas)) ? Number(alitas) : 0,
      pechugas: Number.isFinite(Number(pechugas)) ? Number(pechugas) : 0,
      pata_muslo: Number.isFinite(Number(pata_muslo)) ? Number(pata_muslo) : 0,
      menudos: Number.isFinite(Number(menudos)) ? Number(menudos) : 0,
    }, { transaction });

    await transaction.commit();

    res.status(201).json({ message: "Registro de producción cargado", registro });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Error al cargar producción", error: error.message });
  }
};
