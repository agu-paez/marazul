import { CierreCaja, GastoDia } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

const amount = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const getGastoDia = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();
    const gasto = await GastoDia.findOne({ where: { fecha } });
    res.json(gasto || { fecha, combustible: "0.00", otros: "0.00", descripcion_otros: "" });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener gastos del dia", error: error.message });
  }
};

export const guardarGastoDia = async (req, res) => {
  try {
    const fecha = getFechaLocal();
    if (await CierreCaja.findOne({ where: { fecha } })) {
      return res.status(400).json({ message: "La caja del dia ya fue cerrada" });
    }
    const combustible = amount(req.body.combustible);
    const otros = amount(req.body.otros);
    if (combustible === null || otros === null) {
      return res.status(400).json({ message: "Los gastos deben ser montos validos" });
    }
    const [gasto] = await GastoDia.findOrCreate({ where: { fecha }, defaults: { fecha } });
    await gasto.update({ combustible, otros, descripcion_otros: String(req.body.descripcion_otros || "").trim(), usuarioId: req.user.id });
    res.json(gasto);
  } catch (error) {
    res.status(500).json({ message: "Error al guardar gastos del dia", error: error.message });
  }
};
