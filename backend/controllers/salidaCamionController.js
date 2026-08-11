import { SalidaCamion, SalidaCamionItem, Producto, User, Cliente, CierreCaja, Venta, VentaItem } from "../models/index.js";
import { Op } from "sequelize";
import { getFechaLocal } from "../utils/fecha.js";

const checkDayClosed = async (fecha) => {
  const cierre = await CierreCaja.findOne({ where: { fecha } });
  return !!cierre;
};

const includeSalida = [
  {
    model: SalidaCamionItem,
    include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad"] }],
  },
  { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
  { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
  { model: User, as: "creado_por", attributes: ["id", "nombre"] },
  { model: User, as: "autorizado_por", attributes: ["id", "nombre"] },
];

export const getAllSalidas = async (req, res) => {
  try {
    const where = {};

    const salidas = await SalidaCamion.findAll({
      where,
      include: includeSalida,
      order: [["fecha", "DESC"], ["createdAt", "DESC"]],
    });

    res.json(salidas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener salidas", error: error.message });
  }
};

export const getSalidaById = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto }],
        },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
        { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
        { model: User, as: "creado_por", attributes: ["id", "nombre"] },
        { model: User, as: "autorizado_por", attributes: ["id", "nombre"] },
      ],
    });

    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    if (req.userRole !== "admin" && salida.asignadoRepartidorId !== req.user.id && salida.creadoPorId !== req.user.id) {
      return res.status(403).json({ message: "No tienes permisos para ver esta salida" });
    }

    res.json(salida);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener salida", error: error.message });
  }
};

export const getMisSalidas = async (req, res) => {
  try {
    const salidas = await SalidaCamion.findAll({
      where: {
        [Op.or]: [
          { asignadoRepartidorId: req.user.id },
          { creadoPorId: req.user.id },
        ],
      },
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad"] }],
        },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
        { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
      ],
      order: [["fecha", "DESC"], ["createdAt", "DESC"]],
    });

    res.json(salidas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener salidas", error: error.message });
  }
};

export const createSalida = async (req, res) => {
  try {
    const {
      fecha,
      camion,
      destino,
      clienteId,
      notas,
      asignadoRepartidorId,
      items,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Debe agregar al menos un producto" });
    }
    if (!destino || !String(destino).trim()) {
      return res.status(400).json({ message: "Debe seleccionar una zona para la salida" });
    }

    let clienteNombre = null;
    let clienteIdVal = null;
    if (clienteId) {
      const cliente = await Cliente.findByPk(clienteId);
      if (!cliente) {
        return res.status(400).json({ message: "Cliente no encontrado" });
      }
      if (cliente.zona !== destino) {
        return res.status(400).json({ message: "El cliente no pertenece a la zona seleccionada" });
      }
      clienteNombre = cliente.nombre;
      clienteIdVal = cliente.id;
    }

    const salidaFecha = fecha || getFechaLocal();

    if (await checkDayClosed(salidaFecha)) {
      return res.status(400).json({ message: "No se pueden crear salidas, la caja del día ya fue cerrada" });
    }

    let precioTotal = 0;
    for (const item of items) {
      const producto = await Producto.findByPk(item.productoId);
      if (!producto) {
        return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
      }
      const cantidad = Number(item.cantidad);
      const esKilogramo = ["kg", "kilogramo"].includes(String(producto.unidad || "").toLowerCase());
      if (!Number.isFinite(cantidad) || cantidad <= 0 || (!esKilogramo && !Number.isInteger(cantidad))) {
        return res.status(400).json({ message: `La cantidad de "${producto.nombre}" no es válida` });
      }
      if (producto.stock < cantidad) {
        return res.status(400).json({
          message: `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, solicitado ${item.cantidad}`,
        });
      }
      precioTotal += parseFloat(producto.precio) * cantidad;
    }

    const montoSalidaCalc = precioTotal;

    const salida = await SalidaCamion.create({
      fecha: salidaFecha,
      camion,
      destino,
      cliente_nombre: clienteNombre || "",
      clienteId: clienteIdVal,
      notas,
      precio_total: precioTotal,
      monto_salida: montoSalidaCalc,
      asignadoRepartidorId: asignadoRepartidorId || req.user.id,
      creadoPorId: req.user.id,
    });

    for (const item of items) {
      const producto = await Producto.findByPk(item.productoId);
      await SalidaCamionItem.create({
        salidaCamionId: salida.id,
        productoId: item.productoId,
        cantidad: Number(item.cantidad),
        precio_unitario: producto.precio,
      });

      await producto.update({ stock: parseFloat(producto.stock) - Number(item.cantidad) });
    }

    const salidaCompleta = await SalidaCamion.findByPk(salida.id, {
      include: includeSalida,
    });

    res.status(201).json({ message: "Salida de camión creada", salida: salidaCompleta });
  } catch (error) {
    res.status(500).json({ message: "Error al crear salida", error: error.message });
  }
};

export const registrarRegreso = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [{ model: SalidaCamionItem, include: [{ model: Producto }] }],
    });

    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    const editandoHistorial = salida.estado === "sobrante";

    if (editandoHistorial && req.userRole !== "admin") {
      return res.status(403).json({ message: "Solo el administrador puede editar el historial de sobrante" });
    }

    if (req.userRole === "repartidor") {
      if (salida.asignadoRepartidorId !== req.user.id && salida.creadoPorId !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para modificar esta salida" });
      }
    }

    const { items_regreso, cancelar = false, motivo } = req.body;

    if (cancelar && salida.estado !== "en_camino") {
      return res.status(400).json({ message: "Solo se puede cancelar con regreso una salida en camino" });
    }

    if (salida.estado !== "en_camino" && !editandoHistorial && !cancelar) {
      return res.status(400).json({ message: "Solo se puede registrar regreso de salidas en camino" });
    }

    if (await checkDayClosed(salida.fecha)) {
      return res.status(400).json({ message: "No se puede modificar, la caja del día ya fue cerrada" });
    }

    const ventasExistentes = await Venta.findAll({
      where: { salidaCamionId: salida.id, estado: "completada" },
      include: [{ model: VentaItem, attributes: ["productoId", "cantidad"] }],
    });
    if (!cancelar && ventasExistentes.length === 0) {
      return res.status(400).json({ message: "Debe registrar la mercaderia como Venta por Reparto antes de confirmar el regreso" });
    }

    const vendidoPorProducto = {};
    for (const venta of ventasExistentes) {
      for (const vi of venta.VentaItems) {
        vendidoPorProducto[vi.productoId] = (vendidoPorProducto[vi.productoId] || 0) + vi.cantidad;
      }
    }

    let montoRegreso = 0;
    if (items_regreso && items_regreso.length > 0) {
      for (const item of items_regreso) {
        const producto = await Producto.findByPk(item.productoId);
        if (producto) {
          const salidaItem = salida.SalidaCamionItems.find((si) => si.productoId === item.productoId);
          if (salidaItem) {
            const maxDevolver = salidaItem.cantidad - (vendidoPorProducto[item.productoId] || 0);
            if (item.cantidad > 0 && item.cantidad > maxDevolver) {
              return res.status(400).json({
                message: `No se puede devolver ${item.cantidad} unidades de "${producto.nombre}": solo quedan ${maxDevolver} disponibles (${salidaItem.cantidad} cargados - ${vendidoPorProducto[item.productoId] || 0} vendidos)`,
              });
            }
            const devueltoAnterior = salidaItem.cantidad_devuelta || 0;
            montoRegreso += producto.precio * item.cantidad;
            await producto.update({ stock: producto.stock + (item.cantidad - devueltoAnterior) });
            await salidaItem.update({ cantidad_devuelta: item.cantidad });
          }
        }
      }
    }

    await salida.update({
      monto_regreso: montoRegreso,
    });

    if (cancelar) {
      const motivoTexto = String(motivo || "").trim().replace(/^ENVIO CANCELADO\s*\n?/i, "");
      await salida.update({
        estado: "cancelado",
        notas: `ENVIO CANCELADO\n${motivoTexto}`,
      });
    } else {
      const totalVentasReparto = ventasExistentes.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
      const montoSalida = parseFloat(salida.monto_salida || 0);
      const estadoFinal = montoRegreso + totalVentasReparto >= montoSalida ? "entregado" : "sobrante";
      await salida.update({ estado: estadoFinal });
    }

    const salidaActualizada = await SalidaCamion.findByPk(salida.id, {
      include: includeSalida,
    });

    res.json({
      message: cancelar ? "Envio cancelado" : editandoHistorial ? "Historial de regreso actualizado" : "Regreso registrado",
      salida: salidaActualizada,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar regreso", error: error.message });
  }
};

export const updateSalidaStatus = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [{ model: SalidaCamionItem }],
    });
    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    if (req.userRole === "repartidor") {
      if (salida.asignadoRepartidorId !== req.user.id && salida.creadoPorId !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para modificar esta salida" });
      }
    }

    if (req.userRole === "operador" && salida.estado !== "pendiente") {
      return res.status(400).json({ message: "Solo se pueden enviar salidas pendientes" });
    }

    if (await checkDayClosed(salida.fecha)) {
      return res.status(400).json({ message: "No se puede modificar, la caja del dia ya fue cerrada" });
    }

    const { estado, notas } = req.body;

    if (req.userRole === "operador" && estado !== "en_camino") {
      return res.status(403).json({ message: "Los operadores solo pueden marcar salidas como en camino" });
    }

    if (estado && !["pendiente", "en_camino", "entregado", "cancelado", "sobrante"].includes(estado)) {
      return res.status(400).json({ message: "Estado no valido" });
    }

    if (req.userRole === "repartidor") {
      const estadoActual = salida.estado;
      if (estado === "en_camino") {
        return res.status(403).json({ message: "Solo un administrador u operador puede marcar como en camino" });
      }
      if (estadoActual === "pendiente" && estado === "cancelado") {
        return res.status(403).json({ message: "No puedes cancelar una salida pendiente, solicita a un administrador" });
      }
      if (estado === "entregado" && estadoActual !== "en_camino") {
        return res.status(400).json({ message: "Solo puedes entregar salidas que estan en camino" });
      }
      if (estado === "cancelado" && (estadoActual === "entregado" || estadoActual === "cancelado")) {
        return res.status(400).json({ message: "No puedes cancelar una entrega ya completada" });
      }
    }

    if (salida.estado === "sobrante" && estado === "cancelado" && req.userRole !== "admin") {
      return res.status(403).json({ message: "Solo el administrador puede cancelar un envio con sobrante" });
    }

    if (estado === "entregado") {
      const ventasCount = await Venta.count({ where: { salidaCamionId: salida.id } });
      if (ventasCount === 0) {
        return res.status(400).json({ message: "Debe registrar al menos una Venta por Reparto antes de marcar como entregado" });
      }
    }

    if (estado === "cancelado") {
      const ventasReparto = await Venta.findAll({
        where: { salidaCamionId: salida.id, estado: "completada" },
        include: [{ model: VentaItem, attributes: ["productoId", "cantidad"] }],
      });

      const vendidoPorProducto = {};
      for (const venta of ventasReparto) {
        for (const vi of venta.VentaItems) {
          vendidoPorProducto[vi.productoId] = (vendidoPorProducto[vi.productoId] || 0) + vi.cantidad;
        }
      }

      for (const item of salida.SalidaCamionItems) {
        const vendido = vendidoPorProducto[item.productoId] || 0;
        const aRestaurar = item.cantidad - vendido;
        if (aRestaurar > 0) {
          const prod = await Producto.findByPk(item.productoId);
          if (prod) {
            await prod.update({ stock: prod.stock + aRestaurar });
          }
        }
      }
    }

    let updateData = { estado };
    if (estado === "en_camino") {
      updateData.autorizadoPorId = req.user.id;
    }
    if (estado === "cancelado" && notas) {
      const motivo = String(notas).trim();
      const sinPrefijo = motivo.replace(/^ENVIO CANCELADO\s*\n?/i, "");
      updateData.notas = `ENVIO CANCELADO\n${sinPrefijo}`;
    } else {
      updateData.notas = notas !== undefined ? notas : salida.notas;
    }

    await salida.update(updateData);

    const salidaActualizada = await SalidaCamion.findByPk(salida.id, {
      include: includeSalida,
    });

    res.json({ message: "Estado actualizado", salida: salidaActualizada });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar salida", error: error.message });
  }
};

export const updateSalidaCompleta = async (req, res) => {
  try {
    if (req.userRole === "repartidor") {
      return res.status(403).json({ message: "Los repartidores solo pueden modificar el estado" });
    }

    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [{ model: SalidaCamionItem }],
    });

    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    if (await checkDayClosed(salida.fecha)) {
      return res.status(400).json({ message: "No se puede modificar, la caja del día ya fue cerrada" });
    }

    const { camion, destino, clienteId, notas, asignadoRepartidorId, items } = req.body;

    if (salida.estado !== "pendiente") {
      return res.status(400).json({ message: "Solo se puede editar una salida en estado pendiente" });
    }

    let clienteNombreUpd = null;
    let clienteIdUpd = null;
    if (clienteId) {
      const cliente = await Cliente.findByPk(clienteId);
      if (!cliente) {
        return res.status(400).json({ message: "Cliente no encontrado" });
      }
      clienteNombreUpd = cliente.nombre;
      clienteIdUpd = cliente.id;
    }

    for (const oldItem of salida.SalidaCamionItems) {
      const prod = await Producto.findByPk(oldItem.productoId);
      if (prod) {
        await prod.update({ stock: prod.stock + oldItem.cantidad });
      }
    }

    await SalidaCamionItem.destroy({ where: { salidaCamionId: salida.id } });

    let precioTotal = 0;
    if (items && items.length > 0) {
      for (const item of items) {
        const producto = await Producto.findByPk(item.productoId);
        if (!producto) {
          return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
        }
        if (producto.stock < item.cantidad) {
          return res.status(400).json({
            message: `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}`,
          });
        }
        precioTotal += producto.precio * item.cantidad;
        await SalidaCamionItem.create({
          salidaCamionId: salida.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
          precio_unitario: producto.precio,
        });
        await producto.update({ stock: producto.stock - item.cantidad });
      }
    }

    await salida.update({
      camion,
      destino,
      cliente_nombre: clienteNombreUpd || "",
      clienteId: clienteIdUpd,
      notas,
      precio_total: precioTotal,
      monto_salida: precioTotal,
      asignadoRepartidorId,
    });

    const salidaActualizada = await SalidaCamion.findByPk(salida.id, {
      include: includeSalida,
    });

    res.json({ message: "Salida actualizada", salida: salidaActualizada });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar salida", error: error.message });
  }
};

export const deleteSalida = async (req, res) => {
  try {
    if (req.userRole === "repartidor") {
      return res.status(403).json({ message: "Los repartidores no pueden eliminar salidas" });
    }

    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [{ model: SalidaCamionItem }],
    });

    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    if (await checkDayClosed(salida.fecha)) {
      return res.status(400).json({ message: "No se puede eliminar, la caja del día ya fue cerrada" });
    }

    if (salida.estado !== "pendiente") {
      return res.status(400).json({ message: "Solo se pueden eliminar salidas pendientes" });
    }

    for (const item of salida.SalidaCamionItems) {
      const prod = await Producto.findByPk(item.productoId);
      if (prod) {
        await prod.update({ stock: prod.stock + item.cantidad });
      }
    }

    await SalidaCamionItem.destroy({ where: { salidaCamionId: salida.id } });
    await salida.destroy();

    res.json({ message: "Salida eliminada y stock restaurado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar salida", error: error.message });
  }
};

export const getSalidasStats = async (req, res) => {
  try {
    const today = getFechaLocal();
    const where = { fecha: today };

    if (req.userRole === "repartidor") {
      where.asignadoRepartidorId = req.user.id;
    }

    const totalHoy = await SalidaCamion.count({ where });
    const pendientes = await SalidaCamion.count({ where: { ...where, estado: "pendiente" } });
    const enCamino = await SalidaCamion.count({ where: { ...where, estado: "en_camino" } });
    const entregados = await SalidaCamion.count({ where: { ...where, estado: "entregado" } });

    const salidasHoy = await SalidaCamion.findAll({
      where,
      attributes: ["precio_total"],
    });
    const totalVentas = salidasHoy.reduce(
      (sum, s) => sum + (parseFloat(s.precio_total) || 0),
      0
    );

    res.json({
      fecha: today,
      total: totalHoy,
      pendientes,
      en_camino: enCamino,
      entregados,
      total_ventas: totalVentas.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadísticas", error: error.message });
  }
};

export const getCamionesActivos = async (req, res) => {
  try {
    const where = { estado: "en_camino" };
    if (req.userRole === "repartidor") {
      where.asignadoRepartidorId = req.user.id;
    }
    const salidas = await SalidaCamion.findAll({
      where,
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
        { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
      ],
      order: [["fecha", "DESC"]],
    });
    res.json(salidas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener camiones activos", error: error.message });
  }
};

export const getStockCamion = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
      ],
    });

    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    const ventasDelCamion = await Venta.findAll({
      where: { salidaCamionId: salida.id, estado: "completada" },
      include: [{ model: VentaItem, attributes: ["productoId", "cantidad"] }],
    });

    const stockDisponible = {};
    for (const item of salida.SalidaCamionItems) {
      const productoId = item.productoId;
      if (!stockDisponible[productoId]) {
        stockDisponible[productoId] = {
          productoId,
           nombre: item.Producto?.nombre,
           unidad: item.Producto?.unidad,
          precio: parseFloat(item.precio_unitario),
          cargado: item.cantidad,
          vendido: 0,
          devuelto: item.cantidad_devuelta || 0,
          disponible: item.cantidad - (item.cantidad_devuelta || 0),
        };
      }
    }

    for (const venta of ventasDelCamion) {
      for (const vi of venta.VentaItems) {
        if (stockDisponible[vi.productoId]) {
          stockDisponible[vi.productoId].vendido += vi.cantidad;
          stockDisponible[vi.productoId].disponible -= vi.cantidad;
        }
      }
    }

    res.json({
      salidaId: salida.id,
      camion: salida.camion,
      items: Object.values(stockDisponible),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener stock del camion", error: error.message });
  }
};
