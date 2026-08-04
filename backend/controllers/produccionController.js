import { Produccion } from "../models/index.js";

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

export const getEstadisticasProduccion = async (req, res) => {
  try {
    const registros = await Produccion.findAll({
      order: [
        ["fecha", "ASC"],
        ["id", "ASC"],
      ],
    });

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

    const promedioSemanal = Object.keys(weekly)
      .sort()
      .map((key) => {
        const w = weekly[key];
        const year = key.split("-W")[0];
        const weekNo = parseInt(key.split("-W")[1], 10);
        return {
          semana: `Semana ${weekNo}/${year}`,
          alitas: ratio(w.alitas, w.cajones),
          pechugas: ratio(w.pechugas, w.cajones),
          pata_muslo: ratio(w.pata_muslo, w.cajones),
          menudos: ratio(w.menudos, w.cajones),
        };
      });

    res.json({ registros, promedioDiario, promedioSemanal });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadísticas de producción", error: error.message });
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
