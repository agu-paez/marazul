import { Produccion } from "../models/index.js";
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

const isoWeekStartDate = (isoKey) => {
  const [year, w] = isoKey.split("-W");
  const week = parseInt(w, 10);
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(Date.UTC(Number(year), 0, 4 - (dow - 1) + (week - 1) * 7));
  return monday.toISOString().slice(0, 10);
};

const fechaLocalHoy = () => {
  return getFechaLocal();
};

const currentWeekKey = () => isoWeekKey(fechaLocalHoy());

const currentMonthPrefix = () => fechaLocalHoy().slice(0, 7);

const inicioSemanaOperativa = () => {
  const hoy = new Date(`${fechaLocalHoy()}T00:00:00`);
  hoy.setDate(hoy.getDate() - hoy.getDay());
  const [y, m, d] = [hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()];
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

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

export const getEstadisticasProduccion = async (req, res) => {
  try {
    const registros = await getAllRegistros();
    const statsSemana = buildStats(registros.filter((registro) => registro.fecha >= inicioSemanaOperativa()));
    const statsMes = buildStats(registros.filter((registro) => registro.fecha.startsWith(currentMonthPrefix())));
    res.json({
      registros: statsSemana.registros,
      promedioDiario: statsSemana.promedioDiario,
      promedioSemanal: statsMes.promedioSemanal,
      semanaActual: currentWeekKey(),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadísticas de producción", error: error.message });
  }
};

export const getHistorialProduccion = async (req, res) => {
  try {
    const registros = await getAllRegistros();
    const meses = [...new Set(registros.map((registro) => registro.fecha.slice(0, 7)))].sort().reverse();
    res.json({
      meses: meses.map((mes) => ({
        mes,
        etiqueta: formatNombreMes(mes),
        ...buildStats(registros.filter((registro) => registro.fecha.startsWith(mes))),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de producción", error: error.message });
  }
};

const GREEN = "#2e6b4f";
const GRAY_HEADER = "#eef1ef";
const BORDER = "#dde2df";
const TEXT = "#333333";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const formatFechaLarga = (fechaISO) => {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-");
  return `Lunes ${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
};

const formatFechaCorta = (fechaISO) => {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
};

const formatNombreMes = (mesISO) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesISO)) return "";
  const [y, m] = mesISO.split("-");
  const nombre = MESES[parseInt(m, 10) - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} de ${y}`;
};

const drawSectionTitle = (doc, title) => {
  if (doc.y > doc.page.height - 90) doc.addPage();
  doc.moveDown(0.9);
  doc.x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(GREEN).text(title, { align: "left" });
  doc.moveDown(0.5);
};

const drawDataTable = (doc, headers, rows, colWidths, aligns, options = {}) => {
  const ml = doc.page.margins.left;
  const usable = doc.page.width - ml - doc.page.margins.right;
  const headerH = 20;
  const rowH = options.rowH || 17;
  const textOffset = 5;
  const fechaFill = "#f0f6f3";

  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

  const drawHLine = (y, w = 0.4) => {
    doc.moveTo(ml, y).lineTo(ml + usable, y).lineWidth(w).strokeColor(BORDER).stroke();
  };

  const drawVGrid = (yTop, yBottom) => {
    let cx = ml + colWidths[0];
    for (let i = 1; i < colWidths.length; i++) {
      doc.moveTo(cx, yTop).lineTo(cx, yBottom).lineWidth(0.4).strokeColor(BORDER).stroke();
      cx += colWidths[i];
    }
  };

  const drawOuter = (yTop, yBottom) => {
    doc.lineWidth(0.8).strokeColor(BORDER).rect(ml, yTop, usable, yBottom - yTop).stroke();
  };

  const ensureSpace = (need) => {
    if (doc.y + need > bottomLimit()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  };

  ensureSpace(headerH + rowH);

  const hdrY = doc.y;
  doc.rect(ml, hdrY, usable, headerH).fill(GRAY_HEADER);
  doc.lineWidth(0.5).strokeColor(BORDER).rect(ml, hdrY, usable, headerH).stroke();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GREEN);
  let x = ml;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, hdrY + textOffset, { width: colWidths[i], align: aligns[i], lineBreak: false });
    x += colWidths[i];
  }
  doc.y = hdrY + headerH;
  drawHLine(doc.y);

  let segStart = hdrY;

  doc.font("Helvetica").fontSize(8.5);
  for (let ri = 0; ri < rows.length; ri++) {
    if (doc.y + rowH > bottomLimit()) {
      drawVGrid(segStart, doc.y);
      drawOuter(segStart, doc.y);
      doc.addPage();
      doc.y = doc.page.margins.top;
      segStart = doc.y;
    }
    const rY = doc.y;
    if (ri % 2 === 1) {
      doc.rect(ml, rY, usable, rowH).fill("#f9faf9");
    }
    doc.rect(ml, rY, colWidths[0], rowH).fill(fechaFill);
    doc.fillColor(TEXT);
    x = ml;
    for (let ci = 0; ci < rows[ri].length; ci++) {
      doc.text(String(rows[ri][ci]), x, rY + textOffset, { width: colWidths[ci], align: aligns[ci], lineBreak: false });
      x += colWidths[ci];
    }
    doc.y = rY + rowH;
    const isLast = ri === rows.length - 1;
    const nextFits = doc.y + rowH <= bottomLimit();
    if (!isLast && nextFits) {
      drawHLine(doc.y);
    }
  }

  drawVGrid(segStart, doc.y);
  drawOuter(segStart, doc.y);

  doc.moveDown(0.6);
};

export const descargarHistorialProduccionPdf = async (req, res) => {
  try {
    const { mes } = req.params;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return res.status(400).json({ message: "Mes no válido" });
    }

    const registros = await getAllRegistros();
    const stats = buildStats(registros.filter((registro) => registro.fecha.startsWith(mes)));
    if (stats.registros.length === 0) {
      return res.status(404).json({ message: "No hay registros para ese mes" });
    }

    const doc = new PDFDocument({ margin: 55 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=produccion-${mes}.pdf`);
    doc.pipe(res);

    const ml = doc.page.margins.left;
    const mr = doc.page.margins.right;
    const usable = doc.page.width - ml - mr;

    doc.rect(0, 0, doc.page.width, 10).fill(GREEN);

    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").fontSize(20).fillColor(GREEN).text("Historial de Producción");
    doc.font("Helvetica").fontSize(12).fillColor("#6b7280").text(formatNombreMes(mes));
    doc.moveDown(0.6);
    doc.moveTo(ml, doc.y).lineTo(ml + usable, doc.y).lineWidth(0.8).strokeColor("#c6d4cc").stroke();
    doc.moveDown(1);

    drawSectionTitle(doc, "Registros");
    drawDataTable(doc,
      ["Fecha", "Cajones", "Alitas", "Pechugas", "Pata Muslo", "Menudos"],
      stats.registros.map((r) => [formatFechaCorta(r.fecha), r.cajones, r.alitas, r.pechugas, r.pata_muslo, r.menudos]),
      [95, 78, 78, 78, 78, 78],
      ["left", "center", "center", "center", "center", "center"]
    );

    drawSectionTitle(doc, "Promedio diario");
    drawDataTable(doc,
      ["Fecha", "Alitas", "Pechugas", "Pata Muslo", "Menudos"],
      stats.promedioDiario.map((r) => [formatFechaCorta(r.fecha), r.alitas, r.pechugas, r.pata_muslo, r.menudos]),
      [95, 97.5, 97.5, 97.5, 97.5],
      ["left", "center", "center", "center", "center"]
    );

    drawSectionTitle(doc, "Promedio por semana");
    drawDataTable(doc,
      ["Inicio de semana", "Alitas", "Pechugas", "Pata Muslo", "Menudos"],
      stats.promedioSemanal.map((r) => [formatFechaLarga(isoWeekStartDate(r.key)), r.alitas, r.pechugas, r.pata_muslo, r.menudos]),
      [95, 97.5, 97.5, 97.5, 97.5],
      ["left", "center", "center", "center", "center"],
      { rowH: 20 }
    );

    doc.font("Helvetica").fontSize(8).fillColor("#9ca3af")
      .text("Documento generado automáticamente por el Sistema de Gestión Mar Azul", ml, doc.page.height - doc.page.margins.bottom - 12, { width: usable, align: "center" });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Error al generar historial PDF", error: error.message });
  }
};

export const createProduccion = async (req, res) => {
  try {
    const { fecha, cajones, alitas, pechugas, pata_muslo, menudos } = req.body;

    if (!fecha) {
      return res.status(400).json({ message: "La fecha es obligatoria" });
    }

    const registro = await Produccion.create({
      fecha,
      cajones: Number.isFinite(Number(cajones)) ? Number(cajones) : 0,
      alitas: Number.isFinite(Number(alitas)) ? Number(alitas) : 0,
      pechugas: Number.isFinite(Number(pechugas)) ? Number(pechugas) : 0,
      pata_muslo: Number.isFinite(Number(pata_muslo)) ? Number(pata_muslo) : 0,
      menudos: Number.isFinite(Number(menudos)) ? Number(menudos) : 0,
    });

    res.status(201).json({ message: "Registro de producción cargado", registro });
  } catch (error) {
    res.status(500).json({ message: "Error al cargar producción", error: error.message });
  }
};
