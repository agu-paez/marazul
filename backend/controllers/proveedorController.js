import { Proveedor, Marca, Producto, Venta, ClientePago, ProveedorMovimiento } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

export const getAllProveedores = async (req, res) => {
  try {
    const proveedores = await Proveedor.findAll({
      include: [{
        model: Marca,
        include: [{ model: Producto, attributes: ["id", "nombre", "precio", "stock"] }],
      }],
      where: { activo: true },
    });

    const ventas = await Venta.findAll({
      where: { estado: "completada" },
      attributes: ["datos_transferencia", "proveedorId"],
    });
    const pagosClientes = await ClientePago.findAll({
      attributes: ["datos_transferencia", "datos_tarjeta"],
    });
    const transferenciasPorProveedor = new Map();
    const proveedoresPorAlias = new Map(proveedores
      .filter((proveedor) => proveedor.alias)
      .map((proveedor) => [String(proveedor.alias).trim().toLowerCase(), proveedor.id]));

    for (const venta of ventas) {
      let transferencias = venta.datos_transferencia || [];
      if (typeof transferencias === "string") {
        try {
          transferencias = JSON.parse(transferencias);
        } catch {
          transferencias = [];
        }
      }

      for (const transferencia of Array.isArray(transferencias) ? transferencias : []) {
        const proveedorId = transferencia.proveedorId || venta.proveedorId;
        const monto = parseFloat(transferencia.monto) || 0;
        if (proveedorId && monto > 0) {
          transferenciasPorProveedor.set(
            Number(proveedorId),
            (transferenciasPorProveedor.get(Number(proveedorId)) || 0) + monto
          );
        }
      }
    }

    for (const pago of pagosClientes) {
      for (const datos of [pago.datos_transferencia, pago.datos_tarjeta]) {
        let transferencias = datos || [];
        if (typeof transferencias === "string") {
          try {
            transferencias = JSON.parse(transferencias);
            if (typeof transferencias === "string") transferencias = JSON.parse(transferencias);
          } catch {
            transferencias = [];
          }
        }
        if (!Array.isArray(transferencias) && transferencias && typeof transferencias === "object") {
          transferencias = [transferencias];
        }

        for (const transferencia of Array.isArray(transferencias) ? transferencias : []) {
          const proveedorId = transferencia.proveedorId || proveedoresPorAlias.get(String(transferencia.alias || "").trim().toLowerCase());
          const monto = parseFloat(transferencia.monto) || 0;
          if (proveedorId && monto > 0) {
            transferenciasPorProveedor.set(
              Number(proveedorId),
              (transferenciasPorProveedor.get(Number(proveedorId)) || 0) + monto
            );
          }
        }
      }
    }

    res.json(proveedores.map((proveedor) => ({
      ...proveedor.toJSON(),
      transferencias_historial: transferenciasPorProveedor.get(proveedor.id) || 0,
    })));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener proveedores", error: error.message });
  }
};

export const getProveedorById = async (req, res) => {
  try {
    const proveedor = await Proveedor.findByPk(req.params.id, {
      include: [{ model: Marca, include: [{ model: Producto }] }],
    });
    if (!proveedor) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }
    res.json(proveedor);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener proveedor", error: error.message });
  }
};

export const createProveedor = async (req, res) => {
  try {
    const { nombre, telefono, direccion, email, alias, tipo_producto } = req.body;

    const proveedor = await Proveedor.create({
      nombre,
      telefono,
      direccion,
      email,
      alias,
      tipo_producto,
    });

    res.status(201).json({ message: "Proveedor creado", proveedor });
  } catch (error) {
    res.status(500).json({ message: "Error al crear proveedor", error: error.message });
  }
};

export const updateProveedor = async (req, res) => {
  try {
    const proveedor = await Proveedor.findByPk(req.params.id);
    if (!proveedor) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    await proveedor.update(req.body);
    res.json({ message: "Proveedor actualizado", proveedor });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar proveedor", error: error.message });
  }
};

export const registrarMovimientoProveedor = async (req, res) => {
  try {
    const proveedor = await Proveedor.findByPk(req.params.id);
    if (!proveedor) return res.status(404).json({ message: "Proveedor no encontrado" });

    const compras = Math.abs(Number(req.body.mercaderias_compradas || 0));
    const ventas = Number(req.body.dinero_ventas || 0);
    if (!Number.isFinite(compras) || !Number.isFinite(ventas)) {
      return res.status(400).json({ message: "Los montos no son validos" });
    }
    const diferencia = ventas - compras;
    const movimiento = await ProveedorMovimiento.create({
      fecha: req.body.fecha || getFechaLocal(),
      proveedorId: proveedor.id,
      mercaderias_compradas: compras,
      dinero_ventas: ventas,
      diferencia,
    });
    await proveedor.update({
      mercaderias_compradas: 0,
      dinero_ventas: 0,
      diferencia_acumulada: (Number(proveedor.diferencia_acumulada) || 0) + diferencia,
    });
    res.status(201).json({ message: "Movimiento de proveedor registrado", movimiento });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar movimiento del proveedor", error: error.message });
  }
};

export const deleteProveedor = async (req, res) => {
  try {
    const proveedor = await Proveedor.findByPk(req.params.id);
    if (!proveedor) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    await proveedor.update({ activo: false });
    res.json({ message: "Proveedor desactivado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar proveedor", error: error.message });
  }
};
