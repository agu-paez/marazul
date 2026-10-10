import crypto from "node:crypto";
import { Dispositivo } from "../models/index.js";
import logger from "../utils/logger.js";

const generarToken = () => crypto.randomBytes(24).toString("hex");

const parseNumero = (valor) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

// Endpoint público para las tablets: se autentica con el token del dispositivo.
export const registrarUbicacion = async (req, res) => {
  try {
    const token = req.headers["x-device-token"] || req.body?.token;
    if (!token) {
      return res.status(401).json({ message: "Token de dispositivo no proporcionado" });
    }

    const dispositivo = await Dispositivo.findOne({ where: { token, activo: true } });
    if (!dispositivo) {
      return res.status(401).json({ message: "Dispositivo no autorizado" });
    }

    const latitud = parseNumero(req.body?.latitud ?? req.body?.latitude);
    const longitud = parseNumero(req.body?.longitud ?? req.body?.longitude);
    if (latitud === null || longitud === null) {
      return res.status(400).json({ message: "Latitud y longitud son requeridas" });
    }
    if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
      return res.status(400).json({ message: "Coordenadas fuera de rango" });
    }

    await dispositivo.update({
      latitud,
      longitud,
      precision: parseNumero(req.body?.precision ?? req.body?.accuracy),
      velocidad: parseNumero(req.body?.velocidad ?? req.body?.speed),
      direccion: parseNumero(req.body?.direccion ?? req.body?.heading),
      bateria: parseNumero(req.body?.bateria ?? req.body?.battery),
      proveedor: req.body?.proveedor || req.body?.provider || null,
      ultima_conexion: new Date(),
    });

    res.json({ message: "Ubicación registrada", ultima_conexion: dispositivo.ultima_conexion });
  } catch (error) {
    logger.error("Error al registrar ubicación", { error: error.stack || error.message });
    res.status(500).json({ message: "Error al registrar ubicación" });
  }
};

export const listarDispositivos = async (req, res) => {
  try {
    const dispositivos = await Dispositivo.findAll({
      order: [["nombre", "ASC"]],
    });
    res.json(dispositivos);
  } catch (error) {
    logger.error("Error al listar dispositivos", { error: error.stack || error.message });
    res.status(500).json({ message: "Error al obtener dispositivos" });
  }
};

export const crearDispositivo = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body || {};
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ message: "El nombre del dispositivo es requerido" });
    }

    const dispositivo = await Dispositivo.create({
      nombre: String(nombre).trim(),
      descripcion: descripcion ? String(descripcion).trim() : null,
      token: generarToken(),
      activo: true,
    });

    res.status(201).json({ message: "Dispositivo creado", dispositivo });
  } catch (error) {
    logger.error("Error al crear dispositivo", { error: error.stack || error.message });
    res.status(500).json({ message: "Error al crear dispositivo" });
  }
};

export const actualizarDispositivo = async (req, res) => {
  try {
    const dispositivo = await Dispositivo.findByPk(req.params.id);
    if (!dispositivo) return res.status(404).json({ message: "Dispositivo no encontrado" });

    const cambios = {};
    if (req.body?.nombre !== undefined) cambios.nombre = String(req.body.nombre).trim();
    if (req.body?.descripcion !== undefined) cambios.descripcion = req.body.descripcion ? String(req.body.descripcion).trim() : null;
    if (req.body?.activo !== undefined) cambios.activo = Boolean(req.body.activo);

    await dispositivo.update(cambios);
    res.json({ message: "Dispositivo actualizado", dispositivo });
  } catch (error) {
    logger.error("Error al actualizar dispositivo", { error: error.stack || error.message });
    res.status(500).json({ message: "Error al actualizar dispositivo" });
  }
};

export const regenerarToken = async (req, res) => {
  try {
    const dispositivo = await Dispositivo.findByPk(req.params.id);
    if (!dispositivo) return res.status(404).json({ message: "Dispositivo no encontrado" });

    await dispositivo.update({ token: generarToken() });
    res.json({ message: "Token regenerado", dispositivo });
  } catch (error) {
    logger.error("Error al regenerar token", { error: error.stack || error.message });
    res.status(500).json({ message: "Error al regenerar token" });
  }
};

export const eliminarDispositivo = async (req, res) => {
  try {
    const dispositivo = await Dispositivo.findByPk(req.params.id);
    if (!dispositivo) return res.status(404).json({ message: "Dispositivo no encontrado" });

    await dispositivo.destroy();
    res.json({ message: "Dispositivo eliminado" });
  } catch (error) {
    logger.error("Error al eliminar dispositivo", { error: error.stack || error.message });
    res.status(500).json({ message: "Error al eliminar dispositivo" });
  }
};
