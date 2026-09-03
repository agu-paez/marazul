import { Cliente, Venta, VentaItem, VentaPago, ClientePago, Producto, CierreCaja, Proveedor, SalidaCamion, Reintegro, User } from "../models/index.js";
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import { getFechaLocal } from "../utils/fecha.js";

const parseMonto = (valor) => {
  if (typeof valor === "number") return valor;
  const texto = String(valor ?? "").trim().replace(/\s/g, "");
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto.replace(/\.(?=\d{3}(?:\.|$))/g, "");
  return Number(normalizado);
};

const normalizarSaldos = async (cliente) => {
  const deuda = parseFloat(cliente.saldo_pendiente) || 0;
  const favor = parseFloat(cliente.saldo_favor) || 0;
  const saldoPendiente = Math.max(0, deuda - favor);
  const saldoFavor = Math.max(0, favor - deuda);
  if (saldoPendiente !== deuda || saldoFavor !== favor) {
    await cliente.update({ saldo_pendiente: saldoPendiente.toFixed(2), saldo_favor: saldoFavor.toFixed(2) });
  }
  return cliente;
};

export const getAllClientes = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      where: { activo: true },
      order: [["nombre", "ASC"]],
    });
    await Promise.all(clientes.map(normalizarSaldos));
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener clientes", error: error.message });
  }
};

export const getClienteById = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    await normalizarSaldos(cliente);
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener cliente", error: error.message });
  }
};

export const createCliente = async (req, res) => {
  try {
    const { nombre, zona, tipo_descuento = "producto" } = req.body;
    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({ message: "El nombre del cliente es requerido" });
    }

    if (!["producto", "mayorista", "nuevo"].includes(tipo_descuento)) {
      return res.status(400).json({ message: "El tipo de descuento no es válido" });
    }
    const cliente = await Cliente.create({
      nombre: nombre.trim(),
      zona: zona?.trim() || null,
      tipo_descuento,
      pendiente_revision: req.userRole === "repartidor",
    });
    res.status(201).json({ message: "Cliente creado", cliente });
  } catch (error) {
    res.status(500).json({ message: "Error al crear cliente", error: error.message });
  }
};

export const updateCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const { nombre, zona, activo, tipo_descuento } = req.body;
    if (tipo_descuento !== undefined && !["producto", "mayorista", "nuevo"].includes(tipo_descuento)) {
      return res.status(400).json({ message: "El tipo de descuento no es válido" });
    }
    await cliente.update({
      nombre: nombre || cliente.nombre,
      zona: zona !== undefined ? (zona?.trim() || null) : cliente.zona,
      activo: activo !== undefined ? activo : cliente.activo,
      tipo_descuento: tipo_descuento || cliente.tipo_descuento,
    });

    res.json({ message: "Cliente actualizado", cliente });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar cliente", error: error.message });
  }
};

export const revisarCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    await cliente.update({ pendiente_revision: false });

    res.json({ message: "Cliente marcado como revisado", cliente });
  } catch (error) {
    res.status(500).json({ message: "Error al marcar cliente como revisado", error: error.message });
  }
};

export const updateMontosCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const saldoPendiente = parseMonto(req.body.saldo_pendiente);
    const limiteCredito = req.body.limite_credito === undefined
      ? parseFloat(cliente.limite_credito) || 0
      : parseMonto(req.body.limite_credito);

    if (!Number.isFinite(saldoPendiente) || !Number.isFinite(limiteCredito) || limiteCredito < 0) {
      return res.status(400).json({ message: "Los montos no son validos" });
    }

    await cliente.update({
      saldo_pendiente: saldoPendiente.toFixed(2),
      limite_credito: limiteCredito.toFixed(2),
    });

    res.json({ message: "Montos del cliente actualizados", cliente });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar montos", error: error.message });
  }
};

export const getHistorialCuentaCorriente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const ventas = await Venta.findAll({
      where: {
        clienteId: cliente.id,
        estado: "completada",
      },
      include: [
        {
          model: VentaItem,
          include: [{ model: Producto, attributes: ["id", "nombre"] }],
        },
        { model: VentaPago },
      ],
      order: [["createdAt", "DESC"]],
    });

    const pagosCC = await ClientePago.findAll({
      where: { clienteId: cliente.id },
      order: [["createdAt", "DESC"]],
    });

    res.json({
      cliente,
      ventas,
      pagos: pagosCC,
      saldo_pendiente: parseFloat(cliente.saldo_pendiente),
      saldo_favor: parseFloat(cliente.saldo_favor) || 0,
      limite_credito: parseFloat(cliente.limite_credito),
      credito_disponible: parseFloat(cliente.limite_credito) - parseFloat(cliente.saldo_pendiente) + (parseFloat(cliente.saldo_favor) || 0),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial", error: error.message });
  }
};

export const getHistorialDeudas = async (req, res) => {
  try {
    let whereClientes = { activo: true };
    let zonas = [];

    if (req.userRole !== "admin") {
      const salidas = await SalidaCamion.findAll({
        where: {
          asignadoRepartidorId: req.user.id,
          destino: { [Op.ne]: null },
          estado: { [Op.in]: ["pendiente", "en_camino"] },
        },
        attributes: ["destino"],
      });
      zonas = [...new Set(salidas.map((salida) => String(salida.destino || "").trim()).filter(Boolean))];
      if (zonas.length === 0) {
        return res.json({ clientes: [], zonas });
      }
      whereClientes.zona = { [Op.in]: zonas };
    }

    const clientes = await Cliente.findAll({ where: whereClientes, order: [["nombre", "ASC"]] });
    await Promise.all(clientes.map(normalizarSaldos));
    const clientesConHistorial = await Promise.all(clientes.map(async (cliente) => {
      const [ventas, pagos] = await Promise.all([
        Venta.findAll({
          where: { clienteId: cliente.id, estado: "completada" },
          include: [{ model: VentaPago }, { model: VentaItem, include: [{ model: Producto, attributes: ["id", "nombre"] }] }],
          order: [["createdAt", "DESC"]],
        }),
        ClientePago.findAll({ where: { clienteId: cliente.id }, order: [["createdAt", "DESC"]] }),
      ]);
      const saldoPendiente = parseFloat(cliente.saldo_pendiente) || 0;
      const saldoFavor = parseFloat(cliente.saldo_favor) || 0;
      return {
        cliente,
        ventas,
        pagos,
        saldo_pendiente: saldoPendiente,
        saldo_favor: saldoFavor,
        limite_credito: parseFloat(cliente.limite_credito) || 0,
        credito_disponible: (parseFloat(cliente.limite_credito) || 0) - saldoPendiente + saldoFavor,
      };
    }));

    res.json({ clientes: clientesConHistorial, zonas });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de deudas", error: error.message });
  }
};

export const registrarPagoCuentaCorriente = async (req, res) => {
  try {
    const { pagos } = req.body;
    const fechaHoy = getFechaLocal();
    const cierre = await CierreCaja.findOne({ where: { fecha: fechaHoy } });
    if (cierre) {
      return res.status(400).json({ message: "No se pueden registrar pagos: la caja del día está cerrada" });
    }

    if (!pagos || pagos.length === 0) {
      return res.status(400).json({ message: "Debe registrar al menos un pago" });
    }

    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const montos = pagos.map((p) => parseMonto(p.monto));
    if (montos.some((monto) => !Number.isFinite(monto) || monto <= 0)) {
      return res.status(400).json({ message: "Todos los montos del pago deben ser válidos" });
    }
    const totalPago = montos.reduce((sum, monto) => sum + monto, 0);

    if (totalPago <= 0) {
      return res.status(400).json({ message: "El total del pago debe ser mayor a 0" });
    }

    const deudaOriginal = parseFloat(cliente.saldo_pendiente) || 0;
    const favorOriginal = parseFloat(cliente.saldo_favor) || 0;
    const saldoPendienteActual = Math.max(0, deudaOriginal - favorOriginal);
    const saldoFavorActual = Math.max(0, favorOriginal - deudaOriginal);
    for (const pago of pagos) {
      const datosBancarios = pago.datos_transferencia || pago.datos_tarjeta || pago.datos_cheque || pago.datos_ercheck;
      const proveedorId = datosBancarios?.proveedorId || null;
      if (["transferencia", "tarjeta", "cheque", "ercheck"].includes(pago.medio_pago)) {
        const proveedor = proveedorId ? await Proveedor.findOne({ where: { id: proveedorId, activo: true } }) : null;
        if (!proveedor) {
          return res.status(400).json({ message: "Debe seleccionar un alias de proveedor válido" });
        }
      }
    }
    const nuevoSaldo = Math.max(0, saldoPendienteActual - totalPago);
    const nuevoSaldoFavor = saldoFavorActual + Math.max(0, totalPago - saldoPendienteActual);
    await cliente.update({
      saldo_pendiente: nuevoSaldo.toFixed(2),
      saldo_favor: nuevoSaldoFavor.toFixed(2),
    });

    const now = new Date();
    const hora = now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const fecha = getFechaLocal(now);
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    const salida = await SalidaCamion.findOne({
      where: { fecha, destino: cliente.zona, estado: { [Op.ne]: "cancelado" } },
      order: [["createdAt", "DESC"]],
    });

    for (const pago of pagos) {
      const datosBancarios = pago.datos_transferencia || pago.datos_tarjeta || pago.datos_cheque || pago.datos_ercheck;
      const proveedorId = datosBancarios?.proveedorId || null;
      await ClientePago.create({
        clienteId: cliente.id,
        monto: parseMonto(pago.monto).toFixed(2),
        medio_pago: pago.medio_pago,
        fecha,
        fecha_pago: typeof pago.fecha_pago === "string" && fechaRegex.test(pago.fecha_pago) ? pago.fecha_pago : fecha,
        hora,
        notas: pago.notas || null,
        datos_transferencia: pago.datos_transferencia ? JSON.stringify(pago.datos_transferencia) : null,
        datos_tarjeta: pago.datos_tarjeta ? JSON.stringify(pago.datos_tarjeta) : null,
        datos_cheque: pago.datos_cheque ? JSON.stringify(pago.datos_cheque) : null,
        datos_ercheck: pago.datos_ercheck ? JSON.stringify(pago.datos_ercheck) : null,
        proveedorId,
        registradoPorId: req.user.id,
        salidaCamionId: salida?.id || null,
        titular: datosBancarios?.titular || datosBancarios?.nombre_cuenta || datosBancarios?.cuenta || null,
        banco: datosBancarios?.banco || datosBancarios?.nombre_banco || null,
      });
    }

    const clienteActualizado = await Cliente.findByPk(cliente.id);

    res.json({
      message: `Pago de $${totalPago.toFixed(2)} registrado. Saldo pendiente: $${nuevoSaldo.toFixed(2)}. Saldo a favor: $${nuevoSaldoFavor.toFixed(2)}`,
      cliente: clienteActualizado,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar pago", error: error.message });
  }
};

export const registrarReintegro = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { productoId, precio } = req.body;
    const monto = parseMonto(precio);
    if (!Number.isFinite(monto) || monto <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "El precio debe ser mayor a 0" });
    }

    const cierre = await CierreCaja.findOne({ where: { fecha: getFechaLocal() }, transaction });
    if (cierre) {
      await transaction.rollback();
      return res.status(400).json({ message: "No se pueden registrar reintegros: la caja del día está cerrada" });
    }

    const [cliente, producto] = await Promise.all([
      Cliente.findOne({ where: { id: req.params.id, activo: true }, transaction, lock: transaction.LOCK.UPDATE }),
      Producto.findOne({ where: { id: productoId, activo: true }, transaction }),
    ]);
    if (!cliente) {
      await transaction.rollback();
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    if (!producto) {
      await transaction.rollback();
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const saldoNeto = (parseFloat(cliente.saldo_pendiente) || 0) - (parseFloat(cliente.saldo_favor) || 0);
    const nuevoSaldoNeto = saldoNeto - monto;
    const nuevoSaldoPendiente = Math.max(0, nuevoSaldoNeto);
    const nuevoSaldoFavor = Math.max(0, -nuevoSaldoNeto);
    await cliente.update({
      saldo_pendiente: nuevoSaldoPendiente.toFixed(2),
      saldo_favor: nuevoSaldoFavor.toFixed(2),
    }, { transaction });

    const now = new Date();
    await Reintegro.create({
      monto: monto.toFixed(2),
      precio: monto.toFixed(2),
      producto_nombre: producto.nombre,
      fecha: getFechaLocal(now),
      hora: now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      clienteId: cliente.id,
      productoId: producto.id,
      registradoPorId: req.user.id,
    }, { transaction });
    await transaction.commit();

    res.json({
      message: `Reintegro de $${monto.toFixed(2)} registrado`,
      cliente: await Cliente.findByPk(cliente.id),
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Error al registrar reintegro", error: error.message });
  }
};

export const getHistorialReintegros = async (req, res) => {
  try {
    const where = req.userRole === "repartidor" ? { registradoPorId: req.user.id } : {};
    const reintegros = await Reintegro.findAll({
      where,
      include: [
        { model: Cliente, attributes: ["id", "nombre", "zona"] },
        { model: User, as: "registrado_por", attributes: ["id", "nombre"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(reintegros);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de reintegros", error: error.message });
  }
};

export const deletePagoCuentaCorriente = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const cliente = await Cliente.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!cliente) {
      await transaction.rollback();
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const pago = await ClientePago.findOne({
      where: { id: req.params.pagoId, clienteId: cliente.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!pago) {
      await transaction.rollback();
      return res.status(404).json({ message: "Pago no encontrado" });
    }
    if (String(pago.notas || "").toLowerCase().includes("incluido en venta")) {
      await transaction.rollback();
      return res.status(400).json({ message: "No se puede eliminar un pago incluido en una venta" });
    }

    const saldoNetoAnterior = (parseFloat(cliente.saldo_pendiente) || 0) - (parseFloat(cliente.saldo_favor) || 0);
    const esReintegro = pago.medio_pago === "reintegro";
    const saldoNetoRestaurado = saldoNetoAnterior + (esReintegro ? -(parseFloat(pago.monto) || 0) : (parseFloat(pago.monto) || 0));
    await cliente.update({
      saldo_pendiente: Math.max(0, saldoNetoRestaurado).toFixed(2),
      saldo_favor: Math.max(0, -saldoNetoRestaurado).toFixed(2),
    }, { transaction });
    await pago.destroy({ transaction });
    await transaction.commit();

    res.json({ message: "Pago eliminado correctamente" });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Error al eliminar pago", error: error.message });
  }
};

export const deleteCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    if (parseFloat(cliente.saldo_pendiente) > 0) {
      return res.status(400).json({ message: "No se puede eliminar un cliente con deuda pendiente" });
    }

    await cliente.update({ activo: false });
    res.json({ message: "Cliente desactivado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar cliente", error: error.message });
  }
};
