import { Cliente, Venta, VentaItem, VentaPago, ClientePago, Producto, CierreCaja } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

export const getAllClientes = async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      where: { activo: true },
      order: [["nombre", "ASC"]],
    });
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
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener cliente", error: error.message });
  }
};

export const createCliente = async (req, res) => {
  try {
    const { nombre, zona, limite_credito } = req.body;
    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({ message: "El nombre del cliente es requerido" });
    }

    const limiteCredito = limite_credito === undefined ? 30000 : Number(limite_credito);
    if (!Number.isFinite(limiteCredito) || limiteCredito < 0) {
      return res.status(400).json({ message: "El limite de credito no es valido" });
    }

    const cliente = await Cliente.create({
      nombre: nombre.trim(),
      zona: zona?.trim() || null,
      limite_credito: limiteCredito.toFixed(2),
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

    const { nombre, zona, activo } = req.body;
    await cliente.update({
      nombre: nombre || cliente.nombre,
      zona: zona !== undefined ? (zona?.trim() || null) : cliente.zona,
      activo: activo !== undefined ? activo : cliente.activo,
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

    const saldoPendiente = Number(req.body.saldo_pendiente);
    const limiteCredito = Number(req.body.limite_credito);

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

    const montos = pagos.map((p) => parseFloat(p.monto));
    if (montos.some((monto) => !Number.isFinite(monto) || monto <= 0)) {
      return res.status(400).json({ message: "Todos los montos del pago deben ser válidos" });
    }
    const totalPago = montos.reduce((sum, monto) => sum + monto, 0);

    if (totalPago <= 0) {
      return res.status(400).json({ message: "El total del pago debe ser mayor a 0" });
    }

    const saldoPendienteActual = parseFloat(cliente.saldo_pendiente) || 0;
    const saldoFavorActual = parseFloat(cliente.saldo_favor) || 0;
    const nuevoSaldo = Math.max(0, saldoPendienteActual - totalPago);
    const nuevoSaldoFavor = saldoFavorActual + Math.max(0, totalPago - saldoPendienteActual);
    await cliente.update({
      saldo_pendiente: nuevoSaldo.toFixed(2),
      saldo_favor: nuevoSaldoFavor.toFixed(2),
    });

    const now = new Date();
    const hora = now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const fecha = getFechaLocal(now);

    for (const pago of pagos) {
      await ClientePago.create({
        clienteId: cliente.id,
        monto: parseFloat(pago.monto).toFixed(2),
        medio_pago: pago.medio_pago,
        fecha,
        hora,
        notas: pago.notas || null,
        datos_transferencia: pago.datos_transferencia ? JSON.stringify(pago.datos_transferencia) : null,
        datos_tarjeta: pago.datos_tarjeta ? JSON.stringify(pago.datos_tarjeta) : null,
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
