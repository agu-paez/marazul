import { Op } from "sequelize";
import {
  CierreCaja,
  Cliente,
  ClientePago,
  ConteoVentasLocal,
  Producto,
  User,
  Venta,
  VentaItem,
  VentaPago,
} from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

const normalizarMonto = (valor) => {
  const monto = Number(valor);
  return Number.isFinite(monto) && monto >= 0 ? monto : 0;
};

const conDosDecimales = (monto) => normalizarMonto(monto).toFixed(2);

const esFechaValida = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""));

// Los datos bancarios se guardaron como JSON y luego como TEXT, asi que la
// columna puede devolver ambos formatos.
const parseDatos = (datos) => {
  if (!datos) return [];
  if (typeof datos === "string") {
    try {
      const parsed = JSON.parse(datos);
      if (typeof parsed === "string") return JSON.parse(parsed);
      return parsed;
    } catch {
      return [];
    }
  }
  if (Array.isArray(datos)) return datos;
  if (typeof datos === "object") return [datos];
  return [];
};

// Las ventas con pago dividido registran cada medio en VentaPagos. Las ventas
// antiguas sin VentaPagos conservan la clasificacion por Venta.medio_pago.
const pagosDeVenta = (venta) => {
  if (Array.isArray(venta.VentaPagos) && venta.VentaPagos.length > 0) {
    return venta.VentaPagos.map((pago) => ({ medio_pago: pago.medio_pago, monto: normalizarMonto(pago.monto) }));
  }
  return [{ medio_pago: venta.medio_pago || "efectivo", monto: normalizarMonto(venta.total) }];
};

const MEDIOS_RESUMEN = [
  { clave: "efectivo", etiqueta: "Efectivo" },
  { clave: "transferencia", etiqueta: "Transferencia" },
  { clave: "debito", etiqueta: "Débito" },
  { clave: "credito", etiqueta: "Crédito" },
  { clave: "tarjeta", etiqueta: "Tarjeta sin tipo" },
  { clave: "cheque", etiqueta: "Cheque" },
  { clave: "ercheck", etiqueta: "ER Check" },
  { clave: "cuenta_corriente", etiqueta: "Cuenta corriente" },
  { clave: "otro", etiqueta: "Otro" },
];

const clasificarMedio = (medio) => {
  const clave = String(medio || "otro").toLowerCase();
  if (clave === "debito" || clave === "débito") return "debito";
  if (clave === "credito" || clave === "crédito") return "credito";
  if (MEDIOS_RESUMEN.some((medio) => medio.clave === clave)) return clave;
  return "otro";
};

const resumenMediosInicial = () => ({
  efectivo: 0,
  transferencia: 0,
  debito: 0,
  credito: 0,
  tarjeta: 0,
  cheque: 0,
  ercheck: 0,
  cuenta_corriente: 0,
  otro: 0,
});

// Los pagos de deuda de los clientes mayoristas no cuelgan de una salida de
// camion, asi que para el mostrador se toman todos los del dia.
const pagosDeudaDelDia = async (fecha) => {
  const pagos = await ClientePago.findAll({
    where: { fecha },
    include: [{ model: Cliente, attributes: ["id", "nombre"] }],
  });
  return pagos.map((pago) => ({
    medio_pago: pago.medio_pago,
    monto: normalizarMonto(pago.monto),
    fecha,
    hora: pago.hora,
    datos_transferencia: parseDatos(pago.datos_transferencia),
    datos_tarjeta: parseDatos(pago.datos_tarjeta),
    datos_cheque: parseDatos(pago.datos_cheque),
    datos_ercheck: parseDatos(pago.datos_ercheck),
    titular: pago.titular,
    banco: pago.banco,
    cliente_nombre: pago.Cliente?.nombre || "-",
  }));
};

const construirTransferencias = (ventas = [], pagosDeuda = []) => {
  const transferencias = [];

  for (const venta of ventas) {
    const fecha = String(venta.fecha || "").slice(0, 10);
    for (const pago of pagosDeVenta(venta)) {
      if (clasificarMedio(pago.medio_pago) !== "transferencia") continue;
      const datos = parseDatos(venta.datos_transferencia);
      const totalTransferencia = datos.length > 0
        ? datos.reduce((suma, dato) => suma + (parseFloat(dato.monto) || 0), 0)
        : pago.monto;
      // Un pago de transferencia puede traer varias filas bancarias; se
      // reparten el monto del VentaPago para no duplicar el total.
      const count = Math.max(1, datos.length);
      const montoPorDato = totalTransferencia / count;
      if (datos.length === 0) {
        transferencias.push({
          fecha: `${fecha} ${venta.hora || ""}`.trim().slice(0, 16),
          banco: "-",
          cuenta: venta.cliente?.nombre || venta.cliente_nombre || "-",
          comprobante: venta.numero_comprobante,
          monto: pago.monto,
        });
        continue;
      }
      for (const dato of datos) {
        const monto = parseFloat(dato.monto || 0) || montoPorDato;
        if (monto <= 0) continue;
        transferencias.push({
          fecha: String(dato.fecha_hora || `${fecha} ${venta.hora || ""}`).replace("T", " ").trim().slice(0, 16),
          banco: dato.banco || dato.nombre_banco || "-",
          cuenta: dato.nombre_cuenta || dato.titular || dato.cuenta || venta.cliente?.nombre || "-",
          comprobante: venta.numero_comprobante,
          monto,
        });
      }
    }
  }

  for (const pago of pagosDeuda) {
    if (clasificarMedio(pago.medio_pago) !== "transferencia") continue;
    const datos = pago.datos_transferencia;
    if (datos.length === 0) {
      transferencias.push({
        fecha: `${pago.fecha} ${pago.hora || ""}`.trim().slice(0, 16),
        banco: pago.banco || "-",
        cuenta: pago.titular || pago.cliente_nombre || "-",
        comprobante: "Pago de deuda",
        monto: pago.monto,
      });
      continue;
    }
    for (const dato of datos) {
      const monto = parseFloat(dato.monto || 0) || pago.monto;
      if (monto <= 0) continue;
      transferencias.push({
        fecha: String(dato.fecha_hora || `${pago.fecha} ${pago.hora || ""}`).replace("T", " ").trim().slice(0, 16),
        banco: pago.banco || dato.banco || dato.nombre_banco || "-",
        cuenta: pago.titular || dato.nombre_cuenta || dato.titular || dato.cuenta || pago.cliente_nombre || "-",
        comprobante: "Pago de deuda",
        monto,
      });
    }
  }

  return transferencias;
};

const calcularResumenMedios = (ventas, pagosDeuda) => {
  const resumen = resumenMediosInicial();
  let cantidadTransferencias = 0;

  for (const venta of ventas) {
    for (const pago of pagosDeVenta(venta)) {
      const clave = clasificarMedio(pago.medio_pago);
      resumen[clave] += pago.monto;
      if (clave === "transferencia") cantidadTransferencias++;
    }
  }

  for (const pago of pagosDeuda) {
    const clave = clasificarMedio(pago.medio_pago);
    resumen[clave] += pago.monto;
    if (clave === "transferencia") cantidadTransferencias++;
  }

  return { resumen, cantidadTransferencias };
};

const armarInforme = (fecha, ventas, pagosDeuda, conteo, cierre) => {
  const { resumen, cantidadTransferencias } = calcularResumenMedios(ventas, pagosDeuda);
  const totalVentas = ventas.reduce((suma, venta) => suma + normalizarMonto(venta.total), 0);
  const redondear = (monto) => Math.round(monto * 100) / 100;

  const ventasItems = [];
  for (const venta of ventas) {
    for (const item of venta.VentaItems || []) {
      const precio = parseFloat(item.precio_unitario) || 0;
      const cantidad = Number(item.cantidad) || 0;
      ventasItems.push({
        comprobante: venta.numero_comprobante,
        cliente: venta.cliente?.nombre || venta.cliente_nombre || "-",
        producto: item.Producto?.nombre || "N/A",
        cantidad,
        precio,
        subtotal: cantidad * precio,
      });
    }
  }

  const notes = ventas.filter((venta) => venta.notas);
  const totalGastos = normalizarMonto(conteo?.gastos_combustible) + normalizarMonto(conteo?.gastos_otros);
  const efectivoNeto = redondear(resumen.efectivo - totalGastos);
  const totalConteo = Object.entries(conteo?.billetes || {}).reduce(
    (suma, [valor, cantidad]) => suma + Number(valor) * (Number(cantidad) || 0),
    0
  );

  return {
    fecha,
    hora_cierre: cierre?.hora || null,
    usuario_cierre: cierre?.usuario_cierre || null,
    cerrado: !!cierre,
    ventas_count: ventas.length,
    total_ventas: conDosDecimales(totalVentas),
    ventas_items: ventasItems,
    total_items: conDosDecimales(ventasItems.reduce((suma, item) => suma + item.subtotal, 0)),
    resumen_medios: MEDIOS_RESUMEN.map((medio) => ({ medio: medio.etiqueta, monto: conDosDecimales(resumen[medio.clave]) })),
    cantidad_transferencias: cantidadTransferencias,
    total_transferencias: conDosDecimales(resumen.transferencia),
    transferencias: construirTransferencias(ventas, pagosDeuda),
    conteo: conteo
      ? {
          billetes: conteo.billetes || {},
          gastos_combustible: conDosDecimales(conteo.gastos_combustible),
          gastos_otros: conDosDecimales(conteo.gastos_otros),
          total_gastos: conDosDecimales(totalGastos),
          total_conteo: conDosDecimales(totalConteo),
          efectivo_ventas: conDosDecimales(resumen.efectivo),
          efectivo_neto: conDosDecimales(efectivoNeto),
          diferencia: conDosDecimales(totalConteo - efectivoNeto),
        }
      : null,
    observaciones: notes.map((venta) => ({
      comprobante: venta.numero_comprobante,
      cliente: venta.cliente?.nombre || venta.cliente_nombre || "-",
      notas: venta.notas,
    })),
  };
};

const ventasLocalesDelDia = (fecha) =>
  Venta.findAll({
    where: { fecha, tipo_venta: "local", estado: "completada" },
    order: [["hora", "ASC"]],
    include: [
      {
        model: VentaItem,
        include: [{ model: Producto, attributes: ["id", "nombre", "unidad"] }],
      },
      { model: VentaPago },
      { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
      { model: User, as: "vendedor", attributes: ["id", "nombre"] },
    ],
  });

export const getDetalleVentasLocal = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();
    if (!esFechaValida(fecha)) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    const [ventas, pagosDeuda, registroConteo, cierre] = await Promise.all([
      ventasLocalesDelDia(fecha),
      pagosDeudaDelDia(fecha),
      ConteoVentasLocal.findOne({ where: { fecha } }),
      CierreCaja.findOne({ where: { fecha } }),
    ]);

    const conteo = registroConteo
      ? {
          billetes: parseDatos(registroConteo.conteo_billetes)[0] || {},
          gastos_combustible: normalizarMonto(registroConteo.gastos_combustible),
          gastos_otros: normalizarMonto(registroConteo.gastos_otros),
        }
      : null;

    res.json(armarInforme(fecha, ventas, pagosDeuda, conteo, cierre));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el historial de ventas por local", error: error.message });
  }
};

export const getHistorialVentasLocal = async (req, res) => {
  try {
    const { desde, hasta, buscar } = req.query;
    if (desde && !esFechaValida(desde)) {
      return res.status(400).json({ message: "Fecha 'desde' inválida" });
    }
    if (hasta && !esFechaValida(hasta)) {
      return res.status(400).json({ message: "Fecha 'hasta' inválida" });
    }

    const where = { tipo_venta: "local" };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha[Op.gte] = desde;
      if (hasta) where.fecha[Op.lte] = hasta;
    }

    const term = String(buscar || "").trim();
    if (term) {
      const usuarios = await User.findAll({ where: { nombre: { [Op.like]: `%${term}%` } }, attributes: ["id"] });
      const clientes = await Cliente.findAll({ where: { nombre: { [Op.like]: `%${term}%` } }, attributes: ["id"] });
      where[Op.or] = [
        { usuarioId: { [Op.in]: usuarios.map((usuario) => usuario.id) } },
        { clienteId: { [Op.in]: clientes.map((cliente) => cliente.id) } },
        { numero_comprobante: { [Op.like]: `%${term}%` } },
      ];
    }

    const [ventas, cierres, conteos, pagosDeuda] = await Promise.all([
      Venta.findAll({
        where,
        attributes: ["id", "fecha", "hora", "total", "medio_pago", "pago_dividido", "notas"],
        order: [["fecha", "DESC"]],
        include: [
          { model: VentaPago, attributes: ["medio_pago", "monto"] },
          { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
          { model: User, as: "vendedor", attributes: ["id", "nombre"] },
        ],
      }),
      CierreCaja.findAll({
        where: desde || hasta ? { fecha: where.fecha } : {},
        attributes: ["fecha", "hora", "usuario_cierre"],
      }),
      ConteoVentasLocal.findAll({
        where: desde || hasta ? { fecha: where.fecha } : {},
        attributes: ["fecha", "conteo_billetes", "gastos_combustible", "gastos_otros"],
      }),
      ClientePago.findAll({
        where: desde || hasta ? { fecha: where.fecha } : {},
        attributes: ["fecha", "monto", "medio_pago"],
      }),
    ]);

    // Con busqueda por texto solo se listan dias con ventas coincidentes: un cierre
// o un conteo sin coincidencias no debe aparecer en el historial filtrado.
const fechas = new Set([
      ...ventas.map((venta) => String(venta.fecha).slice(0, 10)),
      ...(term ? [] : [
        ...cierres.map((cierre) => String(cierre.fecha).slice(0, 10)),
        ...conteos.map((conteo) => String(conteo.fecha).slice(0, 10)),
        ...pagosDeuda.map((pago) => String(pago.fecha).slice(0, 10)),
      ]),
    ]);

    const ventasPorFecha = new Map();
    const pagosPorFecha = new Map();
    for (const venta of ventas) {
      const fecha = String(venta.fecha).slice(0, 10);
      if (!ventasPorFecha.has(fecha)) ventasPorFecha.set(fecha, []);
      ventasPorFecha.get(fecha).push(venta);
    }
    for (const pago of pagosDeuda) {
      const fecha = String(pago.fecha).slice(0, 10);
      if (!pagosPorFecha.has(fecha)) pagosPorFecha.set(fecha, []);
      pagosPorFecha.get(fecha).push(pago);
    }
    const cierrePorFecha = new Map(cierres.map((cierre) => [String(cierre.fecha).slice(0, 10), cierre]));
    const conteoPorFecha = new Map(conteos.map((conteo) => [String(conteo.fecha).slice(0, 10), conteo]));

    const registros = [...fechas]
      .sort((a, b) => b.localeCompare(a))
      .map((fecha) => {
        const ventasDia = ventasPorFecha.get(fecha) || [];
        const pagosDia = (pagosPorFecha.get(fecha) || []).map((pago) => ({
          medio_pago: pago.medio_pago,
          monto: normalizarMonto(pago.monto),
        }));
        const { resumen, cantidadTransferencias } = calcularResumenMedios(ventasDia, pagosDia);
        const conteo = conteoPorFecha.get(fecha);
        const cierre = cierrePorFecha.get(fecha);
        const vendedores = [...new Set(ventasDia.map((venta) => venta.vendedor?.nombre).filter(Boolean))];
        const notas = ventasDia
          .filter((venta) => venta.notas)
          .map((venta) => `${venta.numero_comprobante}: ${venta.notas}`);

        return {
          fecha,
          ventas_count: ventasDia.length,
          total_ventas: conDosDecimales(ventasDia.reduce((suma, venta) => suma + normalizarMonto(venta.total), 0)),
          efectivo: conDosDecimales(resumen.efectivo),
          transferencia: conDosDecimales(resumen.transferencia),
          cantidad_transferencias: cantidadTransferencias,
          otros_medios: conDosDecimales(
            resumen.tarjeta + resumen.cheque + resumen.ercheck + resumen.debito + resumen.credito + resumen.otro
          ),
          cuenta_corriente: conDosDecimales(resumen.cuenta_corriente),
          vendedores,
          notas,
          cerrado: !!cierre,
          hora_cierre: cierre?.hora || null,
          usuario_cierre: cierre?.usuario_cierre || null,
          tiene_conteo: !!conteo,
          conteo_billetes: conteo ? parseDatos(conteo.conteo_billetes)[0] || {} : null,
          gastos_combustible: conteo ? conDosDecimales(conteo.gastos_combustible) : "0.00",
          gastos_otros: conteo ? conDosDecimales(conteo.gastos_otros) : "0.00",
        };
      });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de ventas por local", error: error.message });
  }
};

export const guardarConteoVentasLocal = async (req, res) => {
  try {
    const { fecha } = req.params;
    if (!esFechaValida(fecha)) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    const { billetes, gastos_combustible, gastos_otros } = req.body || {};
    if (!billetes || typeof billetes !== "object" || Array.isArray(billetes)) {
      return res.status(400).json({ message: "El conteo de billetes no es válido" });
    }

    const combustible = Number(gastos_combustible || 0);
    const otros = Number(gastos_otros || 0);
    if (!Number.isFinite(combustible) || combustible < 0 || !Number.isFinite(otros) || otros < 0) {
      return res.status(400).json({ message: "Los gastos deben ser números mayores o iguales a cero" });
    }

    const [conteo] = await ConteoVentasLocal.findOrCreate({
      where: { fecha },
      defaults: {
        fecha,
        conteo_billetes: JSON.stringify(billetes),
        gastos_combustible: combustible.toFixed(2),
        gastos_otros: otros.toFixed(2),
        usuarioId: req.user?.id || null,
      },
    });

    await conteo.update({
      conteo_billetes: JSON.stringify(billetes),
      gastos_combustible: combustible.toFixed(2),
      gastos_otros: otros.toFixed(2),
      usuarioId: req.user?.id || null,
    });

    res.json({ message: "Conteo guardado", conteo });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar el conteo", error: error.message });
  }
};