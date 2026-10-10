import { ventasLocalAPI } from "../api";
import { generarHistorialVentasLocalPDF } from "./generarPDF.js";

export const descargarHistorialVentasLocalPDF = async (fecha) => {
  const res = await ventasLocalAPI.getDetalle(fecha);
  await generarHistorialVentasLocalPDF(res.data);
  return res.data;
};

// El PDF nunca se descarga solo: se genera desde el historial cuando se pide.
// Estas fechas son un recordatorio local de los cierres que todavia no se
// bajaron (o que quedaron desactualizados al volver a abrir la caja).
const CLAVE_PDF_PENDIENTES = "ventasLocalPdfPendientes";

const normalizarFecha = (fecha) => {
  if (!fecha) return null;
  const texto = typeof fecha === "string" ? fecha : String(fecha);
  return texto.slice(0, 10);
};

const leerPendientes = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_PDF_PENDIENTES));
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
};

const escribirPendientes = (fechas) => {
  try {
    localStorage.setItem(CLAVE_PDF_PENDIENTES, JSON.stringify(fechas));
  } catch {
    // localStorage puede estar bloqueado; el aviso es solo informativo.
  }
};

export const marcarPdfVentasLocalPendiente = (fecha) => {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return;
  const pendientes = leerPendientes();
  if (!pendientes.includes(normalizada)) escribirPendientes([...pendientes, normalizada]);
};

export const hayPdfVentasLocalPendiente = (fecha) => {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return leerPendientes().length > 0;
  return leerPendientes().includes(normalizada);
};

export const fechasConPdfPendiente = () => leerPendientes();

export const limpiarPdfVentasLocalPendiente = (fecha) => {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) {
    escribirPendientes([]);
    return;
  }
  escribirPendientes(leerPendientes().filter((item) => item !== normalizada));
};
