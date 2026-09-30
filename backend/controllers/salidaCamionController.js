import { SalidaCamion, SalidaCamionItem, Producto, User, Cliente, ClientePago, CierreCaja, Venta, VentaItem, VentaPago, Descuento } from "../models/index.js";
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import { getFechaLocal } from "../utils/fecha.js";

const checkDayClosed = async (fecha) => {
  const cierre = await CierreCaja.findOne({ where: { fecha } });
  return !!cierre;
};

const cargadoEnUnidades = (item) => Number(item.cantidad) || 0;
const devueltoEnUnidades = (item) => Number(item.cantidad_devuelta) || 0;
const unidadesDeVentaItem = (item) => Number(item.cantidad) || 0;

const redondearUnidades = (valor) => Math.round(valor * 100) / 100;

// Margen tolerado al comparar cantidades de mercaderia, para no bloquear por
// errores de redondeo de punto flotante entre kg y(storage DECIMAL(13,2)).
const TOLERANCIA_UNIDADES = 0.009;

const esUnidadDePeso = (producto) => ["kg", "kilogramo"].includes(String(producto?.unidad || "").toLowerCase());

// Unidades ya vendidas de una salida, agrupadas por producto.
const getVendidoPorProducto = async (salidaId, transaction) => {
  const ventas = await Venta.findAll({
    where: { salidaCamionId: salidaId, estado: "completada" },
    include: [{ model: VentaItem, attributes: ["productoId", "cantidad"] }],
    transaction,
  });

  const vendidoPorProducto = {};
  for (const venta of ventas) {
    for (const vi of venta.VentaItems) {
      const productoId = String(vi.productoId);
      vendidoPorProducto[productoId] = redondearUnidades((vendidoPorProducto[productoId] || 0) + unidadesDeVentaItem(vi));
    }
  }
  return vendidoPorProducto;
};

const includeSalida = [
  {
    model: SalidaCamionItem,
            include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "descuento", "descuento_mayorista", "descuento_nuevo", "permitir_modificar_precio"] }],
  },
  { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
  { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
  { model: User, as: "creado_por", attributes: ["id", "nombre"] },
  { model: User, as: "autorizado_por", attributes: ["id", "nombre"] },
];

export const getAllSalidas = async (req, res) => {
  try {
    const where = {};
    if (req.query.fecha) where.fecha = req.query.fecha;
    if (req.query.desde) where.fecha = { [Op.gt]: req.query.desde };

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

// Ventas completadas de una salida, sin filtrar por vendedor: el historial
// debe mostrar todas las ventas del camion aunque las haya registrado otro usuario.
export const getVentasDeSalida = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, { attributes: ["id", "asignadoRepartidorId", "creadoPorId"] });
    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }
    if (req.userRole !== "admin" && salida.asignadoRepartidorId !== req.user.id && salida.creadoPorId !== req.user.id) {
      return res.status(403).json({ message: "No tienes permisos para ver esta salida" });
    }

    const ventas = await Venta.findAll({
      where: { salidaCamionId: req.params.id, estado: "completada" },
      include: [
        {
          model: VentaItem,
          attributes: ["productoId", "cantidad", "precio_unitario"],
          include: [{ model: Producto, attributes: ["id", "nombre", "unidad"] }],
        },
        { model: VentaPago },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    res.json(ventas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener ventas de la salida", error: error.message });
  }
};

export const getMisSalidas = async (req, res) => {
  try {
    const salidas = await SalidaCamion.findAll({
      where: {
        ...(req.query.fecha ? { fecha: req.query.fecha } : {}),
        [Op.or]: [
          { asignadoRepartidorId: req.user.id },
          { creadoPorId: req.user.id },
        ],
      },
      include: [
        {
          model: SalidaCamionItem,
           include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "descuento", "descuento_mayorista", "descuento_nuevo", "permitir_modificar_precio"] }],
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
    if (!asignadoRepartidorId) {
      return res.status(400).json({ message: "Debe seleccionar el repartidor asignado a la salida" });
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

    const productoIds = [...new Set(items.map((item) => item.productoId))];
    const productos = await Producto.findAll({ where: { id: { [Op.in]: productoIds } } });
    const productosPorId = new Map(productos.map((producto) => [String(producto.id), producto]));
    const cantidadesPorProducto = new Map();

    let precioTotal = 0;
    for (const item of items) {
      const producto = productosPorId.get(String(item.productoId));
      if (!producto) {
        return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
      }
      const cantidad = Number(item.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0 || (!esUnidadDePeso(producto) && !Number.isInteger(cantidad))) {
        return res.status(400).json({ message: `La cantidad de "${producto.nombre}" no es válida` });
      }
      const productoId = String(item.productoId);
      cantidadesPorProducto.set(productoId, (cantidadesPorProducto.get(productoId) || 0) + cantidad);
      if (producto.stock < cantidadesPorProducto.get(productoId)) {
        return res.status(400).json({
          message: `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, solicitado ${cantidadesPorProducto.get(productoId)}`,
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
      asignadoRepartidorId,
      creadoPorId: req.user.id,
    });

    for (const item of items) {
      const producto = productosPorId.get(String(item.productoId));
      await SalidaCamionItem.create({
        salidaCamionId: salida.id,
        productoId: item.productoId,
        cantidad: Number(item.cantidad),
        precio_unitario: producto.precio,
      });
    }

    for (const [productoId, cantidad] of cantidadesPorProducto) {
      const producto = productosPorId.get(String(productoId));
      await producto.update({ stock: parseFloat(producto.stock) - cantidad });
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

    if ((await checkDayClosed(salida.fecha)) && !editandoHistorial) {
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
        vendidoPorProducto[vi.productoId] = redondearUnidades((vendidoPorProducto[vi.productoId] || 0) + unidadesDeVentaItem(vi));
      }
    }

    let montoRegreso = 0;
    if (items_regreso && items_regreso.length > 0) {
      for (const item of items_regreso) {
        const producto = await Producto.findByPk(item.productoId);
        if (producto) {
          const salidaItem = salida.SalidaCamionItems.find((si) => si.productoId === item.productoId);
          if (salidaItem) {
            const devuelvenUnidades = Number(item.cantidad) || 0;
            const maxDevolver = redondearUnidades(cargadoEnUnidades(salidaItem) - (vendidoPorProducto[item.productoId] || 0));
            if (devuelvenUnidades > 0 && devuelvenUnidades > maxDevolver + 0.009) {
              return res.status(400).json({
                message: `No se puede devolver ${redondearUnidades(devuelvenUnidades)} unidades de "${producto.nombre}": solo quedan ${maxDevolver} disponibles (${cargadoEnUnidades(salidaItem)} cargados - ${vendidoPorProducto[item.productoId] || 0} vendidos)`,
              });
            }
            const devueltoAnterior = devueltoEnUnidades(salidaItem);
            montoRegreso += parseFloat(producto.precio) * devuelvenUnidades;
            await producto.update({ stock: parseFloat(producto.stock) + devuelvenUnidades - devueltoAnterior });
            await salidaItem.update({
              cantidad_devuelta: devuelvenUnidades,
            });
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
      let faltaMercaderia = false;
      for (const si of salida.SalidaCamionItems) {
        const pendiente = redondearUnidades(cargadoEnUnidades(si) - (vendidoPorProducto[si.productoId] || 0) - devueltoEnUnidades(si));
        if (pendiente > 0.009) {
          faltaMercaderia = true;
          break;
        }
      }
      await salida.update({ estado: faltaMercaderia ? "sobrante" : "entregado" });
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

export const reabrirSalida = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id);
    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    const today = getFechaLocal();
    if (String(salida.fecha).slice(0, 10) > today) {
      return res.status(400).json({ message: "No se pueden abrir salidas con fecha futura" });
    }

    if (await checkDayClosed(today)) {
      return res.status(400).json({ message: "La caja esta cerrada. Primero debe abrir la caja" });
    }

    if (!["entregado", "sobrante"].includes(salida.estado)) {
      return res.status(400).json({ message: "Solo se pueden abrir salidas entregadas o con sobrante" });
    }

    await salida.update({ estado: "en_camino" });
    res.json({ message: "Salida abierta correctamente. Ya puede seguir operandola", salida });
  } catch (error) {
    res.status(500).json({ message: "Error al abrir la salida", error: error.message });
  }
};

export const updateSalidaStatus = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, {
      include: [{ model: SalidaCamionItem, include: [{ model: Producto }] }],
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
          vendidoPorProducto[vi.productoId] = redondearUnidades((vendidoPorProducto[vi.productoId] || 0) + unidadesDeVentaItem(vi));
        }
      }

      for (const item of salida.SalidaCamionItems) {
        const pendienteUnidades = Math.max(0, redondearUnidades(cargadoEnUnidades(item) - (vendidoPorProducto[item.productoId] || 0)));
        if (pendienteUnidades > 0) {
          const prod = await Producto.findByPk(item.productoId);
          if (prod) {
            await prod.update({ stock: parseFloat(prod.stock) + pendienteUnidades });
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

export const getPagosDeudaDeSalida = async (req, res) => {
  try {
    const pagosDeuda = await ClientePago.findAll({
      where: { salidaCamionId: req.params.id },
      include: [{ model: Cliente, attributes: ["id", "nombre"] }],
      order: [["createdAt", "ASC"]],
    });
    res.json(pagosDeuda);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pagos de deuda de la salida", error: error.message });
  }
};

export const getTransferenciasDeSalida = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id, {
      attributes: ["id", "fecha", "asignadoRepartidorId", "creadoPorId"],
    });
    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }
    if (req.userRole !== "admin" && salida.asignadoRepartidorId !== req.user.id && salida.creadoPorId !== req.user.id) {
      return res.status(403).json({ message: "No tienes permisos para ver esta salida" });
    }

    const pagos = await ClientePago.count({
      where: {
        salidaCamionId: salida.id,
        medio_pago: "transferencia",
      },
    });
    res.json({ cantidad: pagos });
  } catch (error) {
    res.status(500).json({ message: "Error al contar transferencias", error: error.message });
  }
};

export const guardarConteoSalida = async (req, res) => {
  try {
    const salida = await SalidaCamion.findByPk(req.params.id);
    if (!salida) {
      return res.status(404).json({ message: "Salida no encontrada" });
    }
    if (!req.body.billetes || typeof req.body.billetes !== "object" || Array.isArray(req.body.billetes)) {
      return res.status(400).json({ message: "El conteo de billetes no es válido" });
    }

    const combustible = Number(req.body.gastos_combustible || 0);
    const otros = Number(req.body.gastos_otros || 0);
    if (!Number.isFinite(combustible) || combustible < 0 || !Number.isFinite(otros) || otros < 0) {
      return res.status(400).json({ message: "Los gastos deben ser números mayores o iguales a cero" });
    }

    await salida.update({
      conteo_billetes: JSON.stringify(req.body.billetes),
      gastos_combustible: combustible.toFixed(2),
      gastos_otros: otros.toFixed(2),
    });
    res.json({ message: "Conteo guardado", salida });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar conteo", error: error.message });
  }
};

export const updateSalidaCompleta = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    if (req.userRole === "repartidor") {
      await transaction.rollback();
      return res.status(403).json({ message: "Los repartidores solo pueden modificar el estado" });
    }

    const salida = await SalidaCamion.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!salida) {
      await transaction.rollback();
      return res.status(404).json({ message: "Salida no encontrada" });
    }

    if (await checkDayClosed(salida.fecha)) {
      await transaction.rollback();
      return res.status(400).json({ message: "No se puede modificar, la caja del día ya fue cerrada" });
    }

    // En camino ya puede tener ventas registradas por el repartidor, asi que se
    // puede editar la mercaderia mientras no se baje de lo ya vendido. Para tocar
    // una entrega hay que reabrirla primero.
    if (!["pendiente", "en_camino"].includes(salida.estado)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Solo se puede editar una salida pendiente o en camino" });
    }

    const { camion, destino, clienteId, notas, asignadoRepartidorId, items } = req.body;

    if (!camion || !String(camion).trim()) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe completar el camion" });
    }
    if (!destino || !String(destino).trim()) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe seleccionar una zona para la salida" });
    }
    if (!asignadoRepartidorId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe seleccionar el repartidor asignado a la salida" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe agregar al menos un producto" });
    }

    let clienteUpd = null;
    if (clienteId) {
      const cliente = await Cliente.findByPk(clienteId, { transaction });
      if (!cliente) {
        await transaction.rollback();
        return res.status(400).json({ message: "Cliente no encontrado" });
      }
      if (cliente.zona !== destino) {
        await transaction.rollback();
        return res.status(400).json({ message: "El cliente no pertenece a la zona seleccionada" });
      }
      clienteUpd = cliente;
    }

    // Consolida por productoId: la UI manda un item por producto, pero si llega
    // repetido se acumula la cantidad en vez de crear items duplicados.
    const cantidadPorProducto = new Map();
    for (const item of items) {
      const productoId = String(item?.productoId ?? "");
      if (!productoId) {
        await transaction.rollback();
        return res.status(400).json({ message: "Cada producto de la salida debe tener un id" });
      }
      const cantidad = Number(item.cantidad);
      const acumulada = cantidadPorProducto.get(productoId) || 0;
      if (!Number.isFinite(cantidad)) {
        await transaction.rollback();
        return res.status(400).json({ message: "Las cantidades de la mercadería no son válidas" });
      }
      cantidadPorProducto.set(productoId, redondearUnidades(acumulada + cantidad));
    }

    const itemsPrevios = await SalidaCamionItem.findAll({
      where: { salidaCamionId: salida.id },
      transaction,
    });
    const previoPorProducto = new Map(itemsPrevios.map((item) => [String(item.productoId), item]));

    // Se bloquean todos los productos que la edicion puede mover: los que ya
    // estaban en la salida y los nuevos.
    const productosIds = [...new Set([...previoPorProducto.keys(), ...cantidadPorProducto.keys()])];
    const productos = await Producto.findAll({
      where: { id: { [Op.in]: productosIds } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const productoPorId = new Map(productos.map((producto) => [String(producto.id), producto]));

    for (const [productoId, cantidad] of cantidadPorProducto) {
      const producto = productoPorId.get(productoId);
      if (!producto) {
        await transaction.rollback();
        return res.status(400).json({ message: `Producto ID ${productoId} no encontrado` });
      }
      if (cantidad <= 0 || (!esUnidadDePeso(producto) && !Number.isInteger(cantidad))) {
        await transaction.rollback();
        return res.status(400).json({ message: `La cantidad de "${producto.nombre}" no es válida` });
      }
    }

    const vendidoPorProducto = await getVendidoPorProducto(salida.id, transaction);

    for (const [productoId, cantidad] of cantidadPorProducto) {
      const producto = productoPorId.get(productoId);
      const previo = previoPorProducto.get(productoId);
      const vendido = vendidoPorProducto[productoId] || 0;
      if (vendido > 0 && !previo) {
        await transaction.rollback();
        return res.status(400).json({ message: `No se puede quitar "${producto.nombre}" porque ya tiene mercadería vendida` });
      }
      const devuelto = previo ? devueltoEnUnidades(previo) : 0;
      const minimo = redondearUnidades(vendido + devuelto);
      if (minimo > 0 && cantidad < minimo - TOLERANCIA_UNIDADES) {
        await transaction.rollback();
        const detalle = devuelto > 0 ? `${vendido} vendidos y ${devuelto} devueltos` : `${vendido} vendidos`;
        return res.status(400).json({ message: `No se puede bajar "${producto.nombre}" a ${cantidad}: ya tiene ${detalle}` });
      }
    }

    // Devuelve al deposito lo que la salida aun tiene afuera y descuenta lo que
    // quedara cargado. Se hace sobre todos los productos afectados para que un
    // producto quitado y uno nuevo no se pisen entre si.
    for (const productoId of productosIds) {
      const producto = productoPorId.get(productoId);
      if (!producto) continue;
      const previo = previoPorProducto.get(productoId);
      const sigueEnLaSalida = cantidadPorProducto.has(productoId);
      const devueltoPrevio = previo ? devueltoEnUnidades(previo) : 0;
      const salientePrevio = previo ? redondearUnidades(cargadoEnUnidades(previo) - devueltoPrevio) : 0;
      // Lo devuelto solo descuenta del stock mientras el item siga existiendo:
      // si se quita el producto, esa mercaderia ya esta en el deposito y hay que
      // devolver solo lo que quedo afuera, o el stock se infla.
      const devueltoNuevo = sigueEnLaSalida ? devueltoPrevio : 0;
      const salienteNuevo = redondearUnidades((cantidadPorProducto.get(productoId) || 0) - devueltoNuevo);
      const disponible = redondearUnidades((parseFloat(producto.stock) || 0) + Math.max(0, salientePrevio));
      if (salienteNuevo > disponible + TOLERANCIA_UNIDADES) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Stock insuficiente para "${producto.nombre}": disponible ${disponible}, solicitado ${salienteNuevo}`,
        });
      }
      const stockNuevo = redondearUnidades(Math.max(0, disponible - salienteNuevo));
      await producto.update({ stock: stockNuevo }, { transaction });
    }

    await SalidaCamionItem.destroy({ where: { salidaCamionId: salida.id }, transaction });

    let precioTotal = 0;
    for (const [productoId, cantidad] of cantidadPorProducto) {
      const producto = productoPorId.get(productoId);
      const previo = previoPorProducto.get(productoId);
      // Se conserva el precio con el que se cargo: si el producto ya estaba en la
      // salida, reprificarlo alteraria el monto de mercaderia ya solda.
      const precioUnitario = previo ? parseFloat(previo.precio_unitario) : parseFloat(producto.precio);
      await SalidaCamionItem.create({
        salidaCamionId: salida.id,
        productoId: producto.id,
        cantidad,
        cantidad_devuelta: previo ? devueltoEnUnidades(previo) : 0,
        precio_unitario: precioUnitario,
      }, { transaction });
      precioTotal += precioUnitario * cantidad;
    }

    const updateData = {
      camion: String(camion).trim(),
      destino,
      cliente_nombre: clienteUpd ? clienteUpd.nombre : "",
      clienteId: clienteUpd ? clienteUpd.id : null,
      notas,
      precio_total: precioTotal,
      monto_salida: precioTotal,
      asignadoRepartidorId,
    };

    await salida.update(updateData, { transaction });
    await transaction.commit();

    const salidaActualizada = await SalidaCamion.findByPk(salida.id, {
      include: includeSalida,
    });

    res.json({ message: "Salida actualizada", salida: salidaActualizada });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
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
    const where = { fecha: today, estado: { [Op.ne]: "cancelado" } };

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
            include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "descuento", "descuento_mayorista", "descuento_nuevo", "permitir_modificar_precio"], include: [{ model: Descuento, as: "Descuentos", where: { activo: true }, required: false, through: { attributes: ["porcentaje"] } }] }],
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
           descuento: item.Producto?.descuento,
            descuento_mayorista: item.Producto?.descuento_mayorista,
            descuento_nuevo: item.Producto?.descuento_nuevo,
            Descuentos: item.Producto?.Descuentos || [],
           permitir_modificar_precio: item.Producto?.permitir_modificar_precio,
            precio: parseFloat(item.precio_unitario),
          precio_unidad: parseFloat(item.precio_unitario),
          cargado: redondearUnidades(cargadoEnUnidades(item)),
          vendido: 0,
          devuelto: redondearUnidades(devueltoEnUnidades(item)),
          disponible: redondearUnidades(cargadoEnUnidades(item) - devueltoEnUnidades(item)),
        };
      }
    }

    for (const venta of ventasDelCamion) {
      for (const vi of venta.VentaItems) {
        if (stockDisponible[vi.productoId]) {
          const unidades = unidadesDeVentaItem(vi);
          stockDisponible[vi.productoId].vendido = redondearUnidades(stockDisponible[vi.productoId].vendido + unidades);
          stockDisponible[vi.productoId].disponible = redondearUnidades(stockDisponible[vi.productoId].disponible - unidades);
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
