import { Cliente, Venta, VentaItem, VentaPago, ClientePago, Producto } from "../models/index.js";
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
    const { nombre, zona, zona_pendiente } = req.body;
    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({ message: "El nombre del cliente es requerido" });
    }

    const cliente = await Cliente.create({
      nombre: nombre.trim(),
      zona: zona?.trim() || null,
      zona_pendiente: Boolean(zona_pendiente),
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

    const { nombre, zona, activo, zona_pendiente } = req.body;
    await cliente.update({
      nombre: nombre || cliente.nombre,
      zona: zona !== undefined ? (zona?.trim() || null) : cliente.zona,
      activo: activo !== undefined ? activo : cliente.activo,
      zona_pendiente: zona_pendiente !== undefined ? Boolean(zona_pendiente) : false,
    });

    res.json({ message: "Cliente actualizado", cliente });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar cliente", error: error.message });
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
      limite_credito: parseFloat(cliente.limite_credito),
      credito_disponible: parseFloat(cliente.limite_credito) - parseFloat(cliente.saldo_pendiente),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial", error: error.message });
  }
};

export const registrarPagoCuentaCorriente = async (req, res) => {
  try {
    const { pagos } = req.body;

    if (!pagos || pagos.length === 0) {
      return res.status(400).json({ message: "Debe registrar al menos un pago" });
    }

    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const totalPago = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);

    if (totalPago <= 0) {
      return res.status(400).json({ message: "El total del pago debe ser mayor a 0" });
    }

    const nuevoSaldo = parseFloat(cliente.saldo_pendiente) - totalPago;
    await cliente.update({ saldo_pendiente: nuevoSaldo.toFixed(2) });

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
      });
    }

    const clienteActualizado = await Cliente.findByPk(cliente.id);

    res.json({
      message: `Pago de $${totalPago.toFixed(2)} registrado. Saldo pendiente: $${nuevoSaldo.toFixed(2)}`,
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
