import { Op } from "sequelize";
import { Reparto, RepartoItem, Producto, User } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

export const getRepartosByDate = async (req, res) => {
  try {
    const { fecha } = req.query;
    const where = {};

    if (fecha) {
      where.fecha = fecha;
    } else {
      const today = getFechaLocal();
      where.fecha = today;
    }

    const repartos = await Reparto.findAll({
      where,
      include: [
        {
          model: RepartoItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
        { model: User, as: "creado_por", attributes: ["id", "nombre"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(repartos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener repartos", error: error.message });
  }
};

export const getAllRepartos = async (req, res) => {
  try {
    const repartos = await Reparto.findAll({
      include: [
        {
          model: RepartoItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
        { model: User, as: "creado_por", attributes: ["id", "nombre"] },
      ],
      order: [["fecha", "DESC"], ["createdAt", "DESC"]],
    });

    res.json(repartos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener repartos", error: error.message });
  }
};

export const getRepartoById = async (req, res) => {
  try {
    const reparto = await Reparto.findByPk(req.params.id, {
      include: [
        {
          model: RepartoItem,
          include: [{ model: Producto }],
        },
        { model: User, as: "creado_por", attributes: ["id", "nombre"] },
      ],
    });

    if (!reparto) {
      return res.status(404).json({ message: "Reparto no encontrado" });
    }

    res.json(reparto);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener reparto", error: error.message });
  }
};

export const createReparto = async (req, res) => {
  try {
    const {
      fecha,
      cliente_nombre,
      cliente_direccion,
      cliente_telefono,
      repartidor,
      notas,
      items,
    } = req.body;

    let precioTotal = 0;

    if (items && items.length > 0) {
      for (const item of items) {
        const producto = await Producto.findByPk(item.productoId);
        if (producto) {
          precioTotal += producto.precio * item.cantidad;
        }
      }
    }

    const reparto = await Reparto.create({
      fecha: fecha || getFechaLocal(),
      cliente_nombre,
      cliente_direccion,
      cliente_telefono,
      repartidor,
      notas,
      precio_total: precioTotal,
      userId: req.user.id,
    });

    if (items && items.length > 0) {
      for (const item of items) {
        const producto = await Producto.findByPk(item.productoId);
        if (producto) {
          await RepartoItem.create({
            repartoId: reparto.id,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: producto.precio,
          });
        }
      }
    }

    const repartoCompleto = await Reparto.findByPk(reparto.id, {
      include: [
        {
          model: RepartoItem,
          include: [{ model: Producto }],
        },
        { model: User, as: "creado_por", attributes: ["id", "nombre"] },
      ],
    });

    res.status(201).json({ message: "Reparto creado", reparto: repartoCompleto });
  } catch (error) {
    res.status(500).json({ message: "Error al crear reparto", error: error.message });
  }
};

export const updateReparto = async (req, res) => {
  try {
    const reparto = await Reparto.findByPk(req.params.id);
    if (!reparto) {
      return res.status(404).json({ message: "Reparto no encontrado" });
    }

    const { estado, repartidor, notas, cliente_nombre, cliente_direccion, cliente_telefono } = req.body;

    await reparto.update({
      estado,
      repartidor,
      notas,
      cliente_nombre,
      cliente_direccion,
      cliente_telefono,
    });

    const repartoActualizado = await Reparto.findByPk(reparto.id, {
      include: [
        {
          model: RepartoItem,
          include: [{ model: Producto }],
        },
        { model: User, as: "creado_por", attributes: ["id", "nombre"] },
      ],
    });

    res.json({ message: "Reparto actualizado", reparto: repartoActualizado });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar reparto", error: error.message });
  }
};

export const deleteReparto = async (req, res) => {
  try {
    const reparto = await Reparto.findByPk(req.params.id);
    if (!reparto) {
      return res.status(404).json({ message: "Reparto no encontrado" });
    }

    await RepartoItem.destroy({ where: { repartoId: reparto.id } });
    await reparto.destroy();

    res.json({ message: "Reparto eliminado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar reparto", error: error.message });
  }
};

export const getRepartosStats = async (req, res) => {
  try {
    const today = getFechaLocal();

    const totalHoy = await Reparto.count({ where: { fecha: today } });
    const pendientes = await Reparto.count({
      where: { fecha: today, estado: "pendiente" },
    });
    const enCamino = await Reparto.count({
      where: { fecha: today, estado: "en_camino" },
    });
    const entregados = await Reparto.count({
      where: { fecha: today, estado: "entregado" },
    });

    const repartosHoy = await Reparto.findAll({
      where: { fecha: today },
      attributes: ["precio_total"],
    });
    const totalVentas = repartosHoy.reduce(
      (sum, r) => sum + (parseFloat(r.precio_total) || 0),
      0
    );

    res.json({
      fecha: today,
      total: totalHoy,
      pendientes,
      en_camino,
      entregados,
      total_ventas: totalVentas.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadísticas", error: error.message });
  }
};
