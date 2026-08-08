import { Venta, VentaItem, VentaPago, Producto, User, Cliente, ClientePago, SalidaCamion, SalidaCamionItem } from "../models/index.js";
import { Op } from "sequelize";
import { getFechaLocal } from "../utils/fecha.js";

const generarNumeroComprobante = async () => {
  const today = getFechaLocal();
  const count = await Venta.count({
    where: { fecha: today },
  });
  const num = String(count + 1).padStart(4, "0");
  return `VTA-${today.replace(/-/g, "")}-${num}`;
};

export const crearVenta = async (req, res) => {
  try {
    const {
      tipo_venta,
      cliente_nombre,
      cliente_direccion,
      cliente_telefono,
      medio_pago,
      clienteId,
      pagos,
      notas,
      items,
      pagar_deuda,
      monto_deuda,
      salidaCamionId,
      datos_transferencia,
      datos_tarjeta,
      proveedorId,
      porcentaje_aumento,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Debe agregar al menos un producto" });
    }

    if (!clienteId) {
      return res.status(400).json({ message: "Debe seleccionar un cliente registrado" });
    }

    const cliente = await Cliente.findByPk(clienteId);
    if (!cliente) {
      return res.status(400).json({ message: "Cliente no encontrado" });
    }

    const esReparto = tipo_venta === "reparto";
    let salidaCamion = null;

    if (esReparto) {
      if (!salidaCamionId) {
        return res.status(400).json({ message: "Debe seleccionar un camion para venta por reparto" });
      }
      salidaCamion = await SalidaCamion.findByPk(salidaCamionId, {
        include: [{ model: SalidaCamionItem }],
      });
      if (!salidaCamion) {
        return res.status(400).json({ message: "Salida de camion no encontrada" });
      }
      if (salidaCamion.destino && cliente.zona !== salidaCamion.destino) {
        return res.status(400).json({ message: "El cliente no pertenece a la zona del camion seleccionado" });
      }
      if (!["en_camino", "entregado", "sobrante"].includes(salidaCamion.estado)) {
        return res.status(400).json({ message: "El camion no esta disponible para ventas" });
      }

      const ventasExistentes = await Venta.findAll({
        where: { salidaCamionId: salidaCamion.id, estado: "completada" },
        include: [{ model: VentaItem, attributes: ["productoId", "cantidad"] }],
      });

      const stockCamion = {};
      for (const item of salidaCamion.SalidaCamionItems) {
        stockCamion[item.productoId] = item.cantidad - (item.cantidad_devuelta || 0);
      }
      for (const v of ventasExistentes) {
        for (const vi of v.VentaItems) {
          if (stockCamion[vi.productoId] !== undefined) {
            stockCamion[vi.productoId] -= vi.cantidad;
          }
        }
      }

      for (const item of items) {
        const producto = await Producto.findByPk(item.productoId);
        if (!producto) {
          return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
        }
        const disp = stockCamion[item.productoId] || 0;
        if (disp < item.cantidad) {
          return res.status(400).json({
            message: `Stock insuficiente en camion "${salidaCamion.camion}" para "${producto.nombre}": disponible ${disp}, solicitado ${item.cantidad}`,
          });
        }
      }
    } else {
      for (const item of items) {
        const producto = await Producto.findByPk(item.productoId);
        if (!producto) {
          return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
        }
        if (producto.stock < item.cantidad) {
          return res.status(400).json({
            message: `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, solicitado ${item.cantidad}`,
          });
        }
      }
    }

    let subtotalCalc = 0;
    for (const item of items) {
      const producto = await Producto.findByPk(item.productoId);
      const precioUnitario = item.precio_unitario !== undefined ? parseFloat(item.precio_unitario) : parseFloat(producto.precio);
      subtotalCalc += precioUnitario * item.cantidad;
    }

    const esPagoDividido = pagos && pagos.length > 0;

    if (esPagoDividido) {
      const sumaPagos = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
      const montoDeudaPagar = pagar_deuda && monto_deuda ? parseFloat(monto_deuda) : 0;
      const totalEsperado = subtotalCalc + montoDeudaPagar;
      if (Math.abs(sumaPagos - totalEsperado) > 0.01) {
        return res.status(400).json({
          message: `La suma de los pagos ($${sumaPagos.toFixed(2)}) no coincide con el total ($${totalEsperado.toFixed(2)})`,
        });
      }

      const montoCC = pagos
        .filter((p) => p.medio_pago === "cuenta_corriente")
        .reduce((sum, p) => sum + parseFloat(p.monto), 0);

      if (montoCC > 0) {
        const nuevoSaldo = parseFloat(cliente.saldo_pendiente) + montoCC;
        if (nuevoSaldo > parseFloat(cliente.limite_credito)) {
          return res.status(400).json({
            message: `El cliente excede su limite de credito. Debe actual: $${cliente.saldo_pendiente}, limite: $${cliente.limite_credito}, monto CC: $${montoCC.toFixed(2)}`,
          });
        }
        await cliente.update({ saldo_pendiente: nuevoSaldo.toFixed(2) });
      }
    } else {
      if (medio_pago === "cuenta_corriente") {
        const nuevoSaldo = parseFloat(cliente.saldo_pendiente) + subtotalCalc;
        if (nuevoSaldo > parseFloat(cliente.limite_credito)) {
          return res.status(400).json({
            message: `El cliente excede su limite de credito. Debe actual: $${cliente.saldo_pendiente}, limite: $${cliente.limite_credito}, compra: $${subtotalCalc.toFixed(2)}`,
          });
        }
        await cliente.update({ saldo_pendiente: nuevoSaldo.toFixed(2) });
      }
    }

    if (pagar_deuda && monto_deuda && parseFloat(monto_deuda) > 0) {
      const deudaPagar = parseFloat(monto_deuda);
      const saldoActual = parseFloat(cliente.saldo_pendiente);

      if (deudaPagar > saldoActual) {
        return res.status(400).json({
          message: `El monto a pagar ($${deudaPagar.toFixed(2)}) excede la deuda pendiente ($${saldoActual.toFixed(2)})`,
        });
      }

      const nuevoSaldo = Math.max(0, saldoActual - deudaPagar);
      await cliente.update({ saldo_pendiente: nuevoSaldo.toFixed(2) });

      const nowPago = new Date();
       const horaPago = nowPago.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      await ClientePago.create({
        clienteId: cliente.id,
        monto: deudaPagar.toFixed(2),
        medio_pago: medio_pago || "efectivo",
        fecha: getFechaLocal(nowPago),
        hora: horaPago,
        notas: `Pago de deuda incluido en venta`,
      });
    }

    const now = new Date();
    const hora = now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const numeroComprobante = await generarNumeroComprobante();

    const venta = await Venta.create({
      numero_comprobante: numeroComprobante,
      fecha: getFechaLocal(now),
      hora,
      tipo_venta: tipo_venta || "local",
      cliente_nombre: cliente.nombre,
      cliente_direccion,
      cliente_telefono,
      medio_pago: esPagoDividido ? "dividido" : (medio_pago || "efectivo"),
      pago_dividido: esPagoDividido,
      subtotal: subtotalCalc.toFixed(2),
      total: subtotalCalc.toFixed(2),
      clienteId,
      salidaCamionId: esReparto ? salidaCamionId : null,
      notas,
      usuarioId: req.user.id,
      datos_transferencia: datos_transferencia || null,
      datos_tarjeta: datos_tarjeta || null,
      monto_deuda_pagado: pagar_deuda && monto_deuda ? parseFloat(monto_deuda) : null,
      proveedorId: proveedorId || null,
      porcentaje_aumento: porcentaje_aumento || 0,
    });

    if (esPagoDividido) {
      for (const pago of pagos) {
        await VentaPago.create({
          ventaId: venta.id,
          medio_pago: pago.medio_pago,
          monto: parseFloat(pago.monto).toFixed(2),
        });
      }
    } else {
      await VentaPago.create({
        ventaId: venta.id,
        medio_pago: medio_pago || "efectivo",
        monto: subtotalCalc.toFixed(2),
      });
    }

    for (const item of items) {
      const producto = await Producto.findByPk(item.productoId);
      const precioUnitario = item.precio_unitario !== undefined ? parseFloat(item.precio_unitario) : parseFloat(producto.precio);
      await VentaItem.create({
        ventaId: venta.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        costo_unitario: parseFloat(producto.costo) || 0,
      });
      if (!esReparto) {
        await producto.update({ stock: producto.stock - item.cantidad });
      }
    }

    const ventaCompleta = await Venta.findByPk(venta.id, {
      include: [
        {
          model: VentaItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
        { model: VentaPago },
        { model: User, as: "vendedor", attributes: ["id", "nombre"] },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre", "saldo_pendiente", "limite_credito"] },
      ],
    });

    res.status(201).json({ message: "Venta registrada", venta: ventaCompleta });
  } catch (error) {
    res.status(500).json({ message: "Error al crear venta", error: error.message });
  }
};

export const getVentas = async (req, res) => {
  try {
    const where = {};

    if (req.userRole === "repartidor") {
      where.usuarioId = req.user.id;
    }

    if (req.query.fecha) where.fecha = req.query.fecha;
    if (req.query.tipo_venta) where.tipo_venta = req.query.tipo_venta;
    if (req.query.usuarioId) where.usuarioId = req.query.usuarioId;
    if (req.query.medio_pago) where.medio_pago = req.query.medio_pago;
    if (req.query.salidaCamionId) where.salidaCamionId = req.query.salidaCamionId;
    if (req.query.numero_comprobante) {
      where.numero_comprobante = { [Op.like]: `%${req.query.numero_comprobante}%` };
    }

    if (req.query.buscar) {
      const term = `%${req.query.buscar}%`;
      const users = await User.findAll({
        where: { nombre: { [Op.like]: term } },
        attributes: ["id"],
      });
      const salidas = await SalidaCamion.findAll({
        where: { camion: { [Op.like]: term } },
        attributes: ["id"],
      });
      const clientes = await Cliente.findAll({
        where: { nombre: { [Op.like]: term } },
        attributes: ["id"],
      });
      const userIds = users.map(u => u.id);
      const salidaIds = salidas.map(s => s.id);
      const clienteIds = clientes.map((cliente) => cliente.id);
      const ors = [];
      if (userIds.length) ors.push({ usuarioId: { [Op.in]: userIds } });
      if (salidaIds.length) ors.push({ salidaCamionId: { [Op.in]: salidaIds } });
      if (clienteIds.length) ors.push({ clienteId: { [Op.in]: clienteIds } });
      if (ors.length) where[Op.or] = ors;
      else where.id = -1;
    }

    const ventas = await Venta.findAll({
      where,
      include: [
        {
          model: VentaItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
        { model: VentaPago },
        { model: User, as: "vendedor", attributes: ["id", "nombre"] },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre", "saldo_pendiente"] },
        { model: SalidaCamion, as: "salida_camion", attributes: ["id", "camion"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(ventas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener ventas", error: error.message });
  }
};

export const getVentaById = async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id, {
      include: [
        {
          model: VentaItem,
          include: [{ model: Producto }],
        },
        { model: VentaPago },
        { model: User, as: "vendedor", attributes: ["id", "nombre"] },
        { model: Cliente, as: "cliente" },
        { model: SalidaCamion, as: "salida_camion", attributes: ["id", "camion"] },
      ],
    });

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json(venta);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener venta", error: error.message });
  }
};

export const getVentasStats = async (req, res) => {
  try {
    const today = getFechaLocal();

    const where = { fecha: today, estado: "completada" };

    const totalVentas = await Venta.count({ where });
    const localVentas = await Venta.count({ where: { ...where, tipo_venta: "local" } });
    const repartoVentas = await Venta.count({ where: { ...where, tipo_venta: "reparto" } });

    const todasHoy = await Venta.findAll({ where, attributes: ["total", "tipo_venta"] });

    let totalMonto = 0;
    let localMonto = 0;
    let repartoMonto = 0;

    for (const v of todasHoy) {
      const monto = parseFloat(v.total) || 0;
      totalMonto += monto;
      if (v.tipo_venta === "local") localMonto += monto;
      else repartoMonto += monto;
    }

    res.json({
      fecha: today,
      total_ventas: totalVentas,
      local_ventas: localVentas,
      reparto_ventas: repartoVentas,
      total_monto: totalMonto.toFixed(2),
      local_monto: localMonto.toFixed(2),
      reparto_monto: repartoMonto.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadisticas", error: error.message });
  }
};

export const deleteVenta = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ message: "Solo admin puede eliminar ventas" });
    }

    const venta = await Venta.findByPk(req.params.id, {
      include: [{ model: VentaItem }, { model: VentaPago }],
    });

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (venta.clienteId) {
      const cliente = await Cliente.findByPk(venta.clienteId);
      if (cliente) {
        let montoCC = 0;
        if (venta.pago_dividido && venta.VentaPagos) {
          montoCC = venta.VentaPagos
            .filter((p) => p.medio_pago === "cuenta_corriente")
            .reduce((sum, p) => sum + parseFloat(p.monto), 0);
        } else if (venta.medio_pago === "cuenta_corriente") {
          montoCC = parseFloat(venta.total);
        }

        if (montoCC > 0) {
          const nuevoSaldo = Math.max(0, parseFloat(cliente.saldo_pendiente) - montoCC);
          await cliente.update({ saldo_pendiente: nuevoSaldo.toFixed(2) });
        }
      }
    }

    for (const item of venta.VentaItems) {
      if (!venta.salidaCamionId) {
        const prod = await Producto.findByPk(item.productoId);
        if (prod) {
          await prod.update({ stock: prod.stock + item.cantidad });
        }
      }
    }

    await VentaPago.destroy({ where: { ventaId: venta.id } });
    await VentaItem.destroy({ where: { ventaId: venta.id } });
    await venta.destroy();

    res.json({ message: "Venta eliminada y stock restaurado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar venta", error: error.message });
  }
};
