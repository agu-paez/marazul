import { Venta, VentaItem, VentaPago, Producto, User, Cliente, ClientePago, Proveedor, CierreCaja, SalidaCamion, SalidaCamionItem } from "../models/index.js";
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import { getFechaLocal } from "../utils/fecha.js";

const esKilogramo = (producto) => ["kg", "kilogramo"].includes(String(producto?.unidad || "").toLowerCase());
const obtenerDatosPago = (pago) => ({
  nombre_cuenta: String(pago.nombre_cuenta || "").trim(),
  banco: String(pago.banco || "").trim(),
  monto: Number(pago.monto) || 0,
  proveedorId: pago.proveedorId ? Number(pago.proveedorId) : null,
  alias: String(pago.alias || "").trim(),
  fecha_hora: pago.fecha_hora || new Date().toISOString(),
});

const generarNumeroComprobante = async () => {
  const today = getFechaLocal();
  const count = await Venta.count({
    where: { fecha: today },
  });
  let num = count + 1;
  let numero = `VTA-${today.replace(/-/g, "")}-${String(num).padStart(4, "0")}`;
  while (await Venta.count({ where: { numero_comprobante: numero } })) {
    num += 1;
    numero = `VTA-${today.replace(/-/g, "")}-${String(num).padStart(4, "0")}`;
  }
  return numero;
};

export const crearVenta = async (req, res) => {
  try {
    const fechaVenta = getFechaLocal();
    if (await CierreCaja.findOne({ where: { fecha: fechaVenta } })) {
      return res.status(400).json({ message: "No se pueden registrar ventas: la caja del día ya fue cerrada" });
    }

    const {
      tipo_venta,
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
      datos_cheque,
      datos_ercheck,
      proveedorId,
      porcentaje_aumento,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Debe agregar al menos un producto" });
    }
    if (!Array.isArray(pagos) || pagos.length === 0) {
      return res.status(400).json({ message: "La venta debe registrarse con pago dividido" });
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
    let productosPorId = new Map();

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

      const productoIds = [...new Set([
        ...items.map((item) => item.productoId),
        ...salidaCamion.SalidaCamionItems.map((item) => item.productoId),
      ])];
      const productos = await Producto.findAll({ where: { id: { [Op.in]: productoIds } } });
      productosPorId = new Map(productos.map((producto) => [String(producto.id), producto]));

      const ventasExistentes = await Venta.findAll({
        where: { salidaCamionId: salidaCamion.id, estado: "completada" },
          include: [{ model: VentaItem, attributes: ["productoId", "cantidad"] }],
      });

      const stockCamion = {};
      for (const item of salidaCamion.SalidaCamionItems) {
        stockCamion[item.productoId] = (stockCamion[item.productoId] || 0) + Number(item.cantidad) - Number(item.cantidad_devuelta || 0);
      }
      for (const v of ventasExistentes) {
        for (const vi of v.VentaItems) {
          if (stockCamion[vi.productoId] !== undefined) {
            stockCamion[vi.productoId] -= Number(vi.cantidad);
          }
        }
      }

      for (const item of items) {
        const producto = productosPorId.get(String(item.productoId));
        if (!producto) {
          return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
        }
        const cantidad = Number(item.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0 || (!esKilogramo(producto) && !Number.isInteger(cantidad))) {
          return res.status(400).json({ message: `La cantidad de "${producto.nombre}" no es válida` });
        }
        const disp = stockCamion[item.productoId] || 0;
        if (disp < cantidad) {
          return res.status(400).json({
            message: `Stock insuficiente en camion "${salidaCamion.camion}" para "${producto.nombre}": disponible ${disp}, solicitado ${cantidad}`,
          });
        }
      }
    } else {
      const productoIds = [...new Set(items.map((item) => item.productoId))];
      const productos = await Producto.findAll({ where: { id: { [Op.in]: productoIds } } });
      productosPorId = new Map(productos.map((producto) => [String(producto.id), producto]));
      for (const item of items) {
        const producto = productosPorId.get(String(item.productoId));
        if (!producto) {
          return res.status(400).json({ message: `Producto ID ${item.productoId} no encontrado` });
        }
        const cantidad = Number(item.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0 || (!esKilogramo(producto) && !Number.isInteger(cantidad))) {
          return res.status(400).json({ message: `La cantidad de "${producto.nombre}" no es válida` });
        }
        if (producto.stock < cantidad) {
          return res.status(400).json({
            message: `Stock insuficiente para "${producto.nombre}": disponible ${producto.stock}, solicitado ${cantidad}`,
          });
        }
      }
    }

    let subtotalCalc = 0;
    const stockPorProducto = new Map();
    for (const item of items) {
      const producto = productosPorId.get(String(item.productoId));
      const precioPersonalizado = Number(item.precio_unitario);
      if (item.precio_unitario !== undefined && (!Number.isFinite(precioPersonalizado) || precioPersonalizado <= 0)) {
        return res.status(400).json({ message: `El precio de "${producto.nombre}" no es válido` });
      }
      const precioBase = Number(producto.precio);
      const precioUnitario = Number.isFinite(precioPersonalizado) && precioPersonalizado > 0
        ? precioPersonalizado
        : precioBase;
      subtotalCalc += precioUnitario * Number(item.cantidad);
    }

    const esPagoDividido = pagos && pagos.length > 0;
    let sobranteFavor = 0;
    let montoCC = 0;

    if (esPagoDividido) {
      const sumaPagos = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
      const montoDeudaPagar = pagar_deuda && monto_deuda ? parseFloat(monto_deuda) : 0;
      const totalEsperado = subtotalCalc + montoDeudaPagar;
      if (sumaPagos < totalEsperado - 0.01) {
        const faltante = Number((totalEsperado - sumaPagos).toFixed(2));
        pagos.push({ medio_pago: "cuenta_corriente", monto: faltante });
      }
      sobranteFavor = Math.max(0, sumaPagos - totalEsperado);

      montoCC = pagos
        .filter((p) => p.medio_pago === "cuenta_corriente")
        .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);

      if (montoCC > 0) {
        const deudaOriginal = parseFloat(cliente.saldo_pendiente) || 0;
        const favorOriginal = parseFloat(cliente.saldo_favor) || 0;
        const saldoPendiente = Math.max(0, deudaOriginal - favorOriginal);
        const saldoFavor = Math.max(0, favorOriginal - deudaOriginal);
        const creditoAplicado = Math.min(saldoFavor, montoCC);
        const nuevoSaldo = saldoPendiente + montoCC - creditoAplicado;
        await cliente.update({
          saldo_pendiente: nuevoSaldo.toFixed(2),
          saldo_favor: (saldoFavor - creditoAplicado).toFixed(2),
        });
      }

      if (sobranteFavor > 0) {
        const clienteActual = await Cliente.findByPk(cliente.id);
        const deudaActual = Math.max(0, parseFloat(clienteActual.saldo_pendiente) || 0);
        const favorActual = Math.max(0, parseFloat(clienteActual.saldo_favor) || 0);
        const descontado = Math.min(deudaActual, sobranteFavor);
        await clienteActual.update({
          saldo_pendiente: (deudaActual - descontado).toFixed(2),
          saldo_favor: (favorActual + sobranteFavor - descontado).toFixed(2),
        });
      }
    } else {
      if (medio_pago === "cuenta_corriente") {
        const deudaOriginal = parseFloat(cliente.saldo_pendiente) || 0;
        const favorOriginal = parseFloat(cliente.saldo_favor) || 0;
        const saldoPendiente = Math.max(0, deudaOriginal - favorOriginal);
        const saldoFavor = Math.max(0, favorOriginal - deudaOriginal);
        const creditoAplicado = Math.min(saldoFavor, subtotalCalc);
        const nuevoSaldo = saldoPendiente + subtotalCalc - creditoAplicado;
        await cliente.update({
          saldo_pendiente: nuevoSaldo.toFixed(2),
          saldo_favor: (saldoFavor - creditoAplicado).toFixed(2),
        });
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
      datos_cheque: datos_cheque || null,
      datos_ercheck: datos_ercheck || null,
      monto_deuda_pagado: pagar_deuda && monto_deuda ? parseFloat(monto_deuda) : null,
      monto_sobrante: sobranteFavor.toFixed(2),
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
      const producto = productosPorId.get(String(item.productoId));
       const precioPersonalizado = Number(item.precio_unitario);
       const precioBase = Number(producto.precio);
       const precioUnitario = Number.isFinite(precioPersonalizado) && precioPersonalizado > 0
         ? precioPersonalizado
         : precioBase;
      await VentaItem.create({
        ventaId: venta.id,
        productoId: item.productoId,
         cantidad: Number(item.cantidad),
        precio_unitario: precioUnitario,
         costo_unitario: parseFloat(producto.costo) || 0,
      });
      if (!esReparto) {
        const cantidadStock = Number(item.cantidad);
        stockPorProducto.set(producto.id, (stockPorProducto.get(producto.id) || 0) + cantidadStock);
      }
    }

    for (const [productoId, cantidadStock] of stockPorProducto) {
      const producto = productosPorId.get(String(productoId));
      await producto.update({ stock: parseFloat(producto.stock) - cantidadStock });
    }

    const ventaCompleta = await Venta.findByPk(venta.id, {
      include: [
        {
           model: VentaItem,
            include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad"] }],
        },
        { model: VentaPago },
        { model: User, as: "vendedor", attributes: ["id", "nombre"] },
         { model: Cliente, as: "cliente", attributes: ["id", "nombre", "saldo_pendiente", "saldo_favor", "limite_credito"] },
      ],
    });

    res.status(201).json({ message: "Venta registrada", venta: ventaCompleta });
  } catch (error) {
    const detalle = error.parent?.sqlMessage || error.original?.sqlMessage || error.message;
    console.error("Error al crear venta:", { message: error.message, detalle, code: error.parent?.code, sql: error.sql || error.parent?.sql });
    res.status(500).json({ message: `Error al crear venta: ${detalle}`, error: detalle });
  }
};

export const getVentas = async (req, res) => {
  try {
    const where = {};

    if (req.userRole === "operador" || req.userRole === "repartidor") {
      where.usuarioId = req.user.id;
    }

    if (req.query.fecha) where.fecha = req.query.fecha;
    if (req.query.tipo_venta) where.tipo_venta = req.query.tipo_venta;
    if (req.query.usuarioId && req.userRole === "admin") where.usuarioId = req.query.usuarioId;
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
          include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad"] }],
        },
        { model: VentaPago },
         { model: User, as: "vendedor", attributes: ["id", "nombre"] },
         { model: User, as: "pago_modificado_por", attributes: ["id", "nombre"] },
         { model: User, as: "productos_modificado_por", attributes: ["id", "nombre"] },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre", "saldo_pendiente", "saldo_favor"] },
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
         { model: User, as: "pago_modificado_por", attributes: ["id", "nombre"] },
         { model: User, as: "productos_modificado_por", attributes: ["id", "nombre"] },
        { model: Cliente, as: "cliente" },
        { model: SalidaCamion, as: "salida_camion", attributes: ["id", "camion"] },
      ],
    });

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (req.userRole !== "admin" && venta.usuarioId !== req.user.id) {
      return res.status(403).json({ message: "No tienes permisos para ver esta venta" });
    }

    res.json(venta);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener venta", error: error.message });
  }
};

export const getVentasStats = async (req, res) => {
  try {
    const today = getFechaLocal();

    const where = { fecha: req.query.fecha || today, estado: "completada" };

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

export const modificarPagoVenta = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { pagos } = req.body;
    if (!Array.isArray(pagos) || pagos.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe indicar al menos un pago" });
    }

    const venta = await Venta.findByPk(req.params.id, { transaction });
    if (!venta || venta.estado !== "completada") {
      await transaction.rollback();
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (req.userRole !== "admin" && venta.usuarioId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ message: "Solo puedes modificar tus propias facturas" });
    }
    if (venta.fecha !== getFechaLocal()) {
      await transaction.rollback();
      return res.status(400).json({ message: "Solo se pueden modificar facturas del día" });
    }

    const cierre = await CierreCaja.findOne({ where: { fecha: venta.fecha }, transaction });
    if (cierre) {
      await transaction.rollback();
      return res.status(400).json({ message: "No se puede modificar el pago: la caja de ese día ya fue cerrada" });
    }

    const pagosNuevos = pagos.map((pago) => ({
      medio_pago: pago.medio_pago,
      monto: Number(pago.monto),
      nombre_cuenta: String(pago.nombre_cuenta || "").trim(),
      banco: String(pago.banco || "").trim(),
      proveedorId: pago.proveedorId ? Number(pago.proveedorId) : null,
      alias: String(pago.alias || "").trim(),
      fecha_hora: pago.fecha_hora || new Date().toISOString(),
    }));
    if (pagosNuevos.some((pago) => !["efectivo", "transferencia", "tarjeta", "cheque", "ercheck", "cuenta_corriente", "otro"].includes(pago.medio_pago) || !Number.isFinite(pago.monto) || pago.monto < 0)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Los pagos indicados no son válidos" });
    }
    if (pagosNuevos.some((pago) => ["transferencia", "tarjeta", "cheque", "ercheck", "otro"].includes(pago.medio_pago) && (!pago.nombre_cuenta || !pago.banco))) {
      await transaction.rollback();
      return res.status(400).json({ message: "Transferencia, tarjeta, cheque, ER check y otros pagos requieren nombre y banco" });
    }
    if (pagosNuevos.some((pago) => ["transferencia", "tarjeta", "cheque", "ercheck", "otro"].includes(pago.medio_pago) && !pago.proveedorId)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Debe seleccionar el proveedor destino para transferencia, tarjeta, cheque, ER check u otro pago" });
    }
    const proveedorIds = [...new Set(pagosNuevos.map((pago) => pago.proveedorId).filter(Boolean))];
    const proveedoresValidos = await Proveedor.findAll({ where: { id: { [Op.in]: proveedorIds } }, transaction });
    if (proveedoresValidos.length !== proveedorIds.length) {
      await transaction.rollback();
      return res.status(400).json({ message: "El proveedor seleccionado no existe" });
    }
    const proveedoresPorId = new Map(proveedoresValidos.map((proveedor) => [proveedor.id, proveedor]));
    pagosNuevos.forEach((pago) => {
      if (pago.proveedorId) pago.alias = proveedoresPorId.get(pago.proveedorId)?.alias || pago.alias;
    });

    const totalEsperado = (parseFloat(venta.total) || 0) + (parseFloat(venta.monto_deuda_pagado) || 0);
    const sobranteAnterior = parseFloat(venta.monto_sobrante) || 0;
    let totalNuevo = pagosNuevos.reduce((sum, pago) => sum + pago.monto, 0);
    if (totalNuevo < totalEsperado - 0.01) {
      if (!venta.clienteId) {
        await transaction.rollback();
        return res.status(400).json({ message: `La suma de los pagos ($${totalNuevo.toFixed(2)}) es menor al total ($${totalEsperado.toFixed(2)}) y la venta no tiene cliente para registrar el faltante en cuenta corriente` });
      }
      const faltante = Number((totalEsperado - totalNuevo).toFixed(2));
      pagosNuevos.push({
        medio_pago: "cuenta_corriente",
        monto: faltante,
        nombre_cuenta: "",
        banco: "",
        proveedorId: null,
        alias: "",
        fecha_hora: new Date().toISOString(),
      });
      totalNuevo += faltante;
    }
    const sobranteNuevo = Math.max(0, totalNuevo - totalEsperado);

    const pagosAnteriores = await VentaPago.findAll({ where: { ventaId: venta.id }, transaction });
    const creditoAnterior = pagosAnteriores
      .filter((pago) => pago.medio_pago === "cuenta_corriente")
      .reduce((sum, pago) => sum + (parseFloat(pago.monto) || 0), 0);
    const creditoNuevo = pagosNuevos
      .filter((pago) => pago.medio_pago === "cuenta_corriente")
      .reduce((sum, pago) => sum + pago.monto, 0);
    const pagosAnterioresDetalle = pagosAnteriores.map((pago) => ({ medio_pago: pago.medio_pago, monto: Number(pago.monto) || 0 }));
    const pagosNuevosDetalle = pagosNuevos.map((pago) => ({ medio_pago: pago.medio_pago, monto: pago.monto, nombre_cuenta: pago.nombre_cuenta, banco: pago.banco, proveedorId: pago.proveedorId, alias: pago.alias }));

    if (venta.clienteId && Math.abs(sobranteNuevo - sobranteAnterior) > 0.01) {
      const clienteSobrante = await Cliente.findByPk(venta.clienteId, { transaction });
      if (clienteSobrante) {
        await clienteSobrante.update({
          saldo_favor: Math.max(0, (parseFloat(clienteSobrante.saldo_favor) || 0) + (sobranteNuevo - sobranteAnterior)).toFixed(2),
        }, { transaction });
      }
    }

    if (venta.clienteId && Math.abs(creditoNuevo - creditoAnterior) > 0.01) {
      const cliente = await Cliente.findByPk(venta.clienteId, { transaction });
      if (cliente) {
        const saldo = (parseFloat(cliente.saldo_pendiente) || 0) - (parseFloat(cliente.saldo_favor) || 0) + creditoNuevo - creditoAnterior;
        await cliente.update({
          saldo_pendiente: Math.max(0, saldo).toFixed(2),
          saldo_favor: Math.max(0, -saldo).toFixed(2),
        }, { transaction });
      }
    }

    await VentaPago.destroy({ where: { ventaId: venta.id }, transaction });
    await VentaPago.bulkCreate(pagosNuevos.map((pago) => ({
      ventaId: venta.id,
      medio_pago: pago.medio_pago,
      monto: pago.monto.toFixed(2),
    })), { transaction });

    const ahora = new Date();
    await venta.update({
      medio_pago: pagosNuevos.length > 1 ? "dividido" : pagosNuevos[0].medio_pago,
      pago_dividido: pagosNuevos.length > 1,
      datos_transferencia: pagosNuevos.filter((pago) => pago.medio_pago === "transferencia").map(obtenerDatosPago),
      datos_tarjeta: pagosNuevos.filter((pago) => pago.medio_pago === "tarjeta").map(obtenerDatosPago),
      datos_cheque: pagosNuevos.filter((pago) => pago.medio_pago === "cheque").map(obtenerDatosPago),
      datos_ercheck: pagosNuevos.filter((pago) => pago.medio_pago === "ercheck").map(obtenerDatosPago),
      datos_otro: pagosNuevos.filter((pago) => pago.medio_pago === "otro").map(obtenerDatosPago),
      pago_modificado_por_id: req.user.id,
      pago_modificado_en: ahora,
      monto_sobrante: sobranteNuevo.toFixed(2),
      pago_modificacion_detalle: JSON.stringify({ anteriores: pagosAnterioresDetalle, nuevos: pagosNuevosDetalle }),
    }, { transaction });
    await transaction.commit();

    const ventaActualizada = await Venta.findByPk(venta.id, {
      include: [
        { model: VentaPago },
        { model: User, as: "vendedor", attributes: ["id", "nombre"] },
        { model: User, as: "pago_modificado_por", attributes: ["id", "nombre"] },
      ],
    });
    res.json({ message: "Pago de venta actualizado", venta: ventaActualizada });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Error al modificar el pago", error: error.message });
  }
};

export const modificarProductosVenta = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "La factura debe conservar al menos un producto" });
    }

    const venta = await Venta.findByPk(req.params.id, { include: [{ model: VentaItem, include: [{ model: Producto, attributes: ["id", "nombre"] }] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!venta || venta.estado !== "completada") {
      await transaction.rollback();
      return res.status(404).json({ message: "Venta no encontrada" });
    }
    if (req.userRole !== "admin" && venta.usuarioId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ message: "Solo puedes modificar tus propias facturas" });
    }
    if (venta.fecha !== getFechaLocal()) {
      await transaction.rollback();
      return res.status(400).json({ message: "Solo se pueden modificar facturas del día" });
    }
    if (await CierreCaja.findOne({ where: { fecha: venta.fecha }, transaction })) {
      await transaction.rollback();
      return res.status(400).json({ message: "No se puede modificar la factura: la caja de ese día ya fue cerrada" });
    }

    const esReparto = venta.tipo_venta === "reparto";
    const productosAnterioresDetalle = venta.VentaItems.map((item) => ({
      productoId: item.productoId,
      nombre: item.Producto?.nombre || "Producto",
      cantidad: Number(item.cantidad),
    }));
    const productosNuevos = [];
    for (const item of items) {
      const producto = await Producto.findByPk(item.productoId, { transaction });
      const cantidad = Number(item.cantidad);
      if (!producto || !Number.isFinite(cantidad) || cantidad <= 0 || (!esKilogramo(producto) && !Number.isInteger(cantidad))) {
        await transaction.rollback();
        return res.status(400).json({ message: `El producto o cantidad de la factura no es válido` });
      }
       const cantidadStock = cantidad;
      const originalesProducto = venta.VentaItems.filter((v) => v.productoId === producto.id);
       const originalMismaUnidad = originalesProducto[0];
      let precio;
      if (originalMismaUnidad) {
        precio = Number(originalMismaUnidad.precio_unitario);
       } else if (originalesProducto.length > 0) {
         precio = Number(originalesProducto[0].precio_unitario);
       } else {
         precio = Number(producto.precio);
      }
      if (!Number.isFinite(precio) || precio <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `No se pudo determinar el precio de "${producto.nombre}"` });
      }
       productosNuevos.push({ producto, cantidad, cantidadStock, precio });
    }

    if (!esReparto) {
      for (const item of venta.VentaItems) {
        const producto = await Producto.findByPk(item.productoId, { transaction, lock: transaction.LOCK.UPDATE });
        if (producto) {
           await producto.increment("stock", { by: Number(item.cantidad), transaction });
        }
      }
      const stockDisponible = new Map();
      const stockDevuelto = new Map();
      for (const item of venta.VentaItems) {
         const cantidadStock = Number(item.cantidad);
        stockDevuelto.set(item.productoId, (stockDevuelto.get(item.productoId) || 0) + cantidadStock);
      }
      for (const item of productosNuevos) {
        const stock = stockDisponible.has(item.producto.id)
          ? stockDisponible.get(item.producto.id)
          : Number(item.producto.stock) + (stockDevuelto.get(item.producto.id) || 0);
        const stockRestante = stock - item.cantidadStock;
        if (stockRestante < 0) {
          await transaction.rollback();
          return res.status(400).json({ message: `Stock insuficiente para "${item.producto.nombre}"` });
        }
        stockDisponible.set(item.producto.id, stockRestante);
      }
      for (const item of productosNuevos) {
        await item.producto.decrement("stock", { by: item.cantidadStock, transaction });
      }
    }

    const subtotalNuevo = productosNuevos.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    const pagosAnteriores = await VentaPago.findAll({ where: { ventaId: venta.id }, transaction });
    const pagosNoCC = pagosAnteriores.filter((pago) => pago.medio_pago !== "cuenta_corriente").map((pago) => ({ medio_pago: pago.medio_pago, monto: Number(pago.monto) || 0 }));
    const totalEsperado = subtotalNuevo + (Number(venta.monto_deuda_pagado) || 0);
    const totalNoCC = pagosNoCC.reduce((sum, pago) => sum + pago.monto, 0);
    const creditoAnterior = pagosAnteriores.filter((pago) => pago.medio_pago === "cuenta_corriente").reduce((sum, pago) => sum + (Number(pago.monto) || 0), 0);
    const creditoNuevo = Math.max(0, totalEsperado - totalNoCC);
    const sobranteNuevo = Math.max(0, totalNoCC - totalEsperado);
    const sobranteAnterior = Number(venta.monto_sobrante) || 0;

    if (venta.clienteId && Math.abs(creditoNuevo - creditoAnterior) > 0.01 || venta.clienteId && Math.abs(sobranteNuevo - sobranteAnterior) > 0.01) {
      const cliente = await Cliente.findByPk(venta.clienteId, { transaction, lock: transaction.LOCK.UPDATE });
      if (cliente) {
        const saldo = (Number(cliente.saldo_pendiente) || 0) - (Number(cliente.saldo_favor) || 0)
          + creditoNuevo - creditoAnterior - sobranteNuevo + sobranteAnterior;
        await cliente.update({ saldo_pendiente: Math.max(0, saldo).toFixed(2), saldo_favor: Math.max(0, -saldo).toFixed(2) }, { transaction });
      }
    }

    await VentaItem.destroy({ where: { ventaId: venta.id }, transaction });
    await VentaItem.bulkCreate(productosNuevos.map((item) => ({
      ventaId: venta.id,
      productoId: item.producto.id,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
       costo_unitario: Number(item.producto.costo) || 0,
    })), { transaction });

    await VentaPago.destroy({ where: { ventaId: venta.id }, transaction });
    await VentaPago.bulkCreate([
      ...pagosNoCC,
      ...(creditoNuevo > 0 ? [{ medio_pago: "cuenta_corriente", monto: creditoNuevo }] : []),
    ].map((pago) => ({ ventaId: venta.id, medio_pago: pago.medio_pago, monto: pago.monto.toFixed(2) })), { transaction });

    await venta.update({
      subtotal: subtotalNuevo.toFixed(2),
      total: subtotalNuevo.toFixed(2),
      monto_sobrante: sobranteNuevo.toFixed(2),
      productos_modificado_por_id: req.user.id,
      productos_modificado_en: new Date(),
      productos_modificacion_detalle: JSON.stringify({
        anteriores: productosAnterioresDetalle,
        nuevos: productosNuevos.map((item) => ({
          productoId: item.producto.id,
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
        })),
      }),
    }, { transaction });
    await transaction.commit();
    const ventaActualizada = await Venta.findByPk(venta.id, {
      include: [
          { model: VentaItem, include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad"] }] },
         { model: VentaPago },
         { model: User, as: "vendedor", attributes: ["id", "nombre"] },
         { model: User, as: "productos_modificado_por", attributes: ["id", "nombre"] },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre", "saldo_pendiente", "saldo_favor", "limite_credito"] },
      ],
    });
    res.json({ message: "Productos de la factura actualizados", venta: ventaActualizada });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    res.status(500).json({ message: "Error al modificar los productos de la factura", error: error.message });
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

        const sobranteVenta = parseFloat(venta.monto_sobrante) || 0;
        if (sobranteVenta > 0) {
          const nuevoFavor = Math.max(0, (parseFloat(cliente.saldo_favor) || 0) - sobranteVenta);
          await cliente.update({ saldo_favor: nuevoFavor.toFixed(2) });
        }
      }
    }

    for (const item of venta.VentaItems) {
      if (!venta.salidaCamionId) {
        const prod = await Producto.findByPk(item.productoId);
         if (prod) {
            await prod.update({ stock: Number(prod.stock) + Number(item.cantidad) });
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
