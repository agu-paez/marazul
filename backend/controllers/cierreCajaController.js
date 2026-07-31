import { CierreCaja, SalidaCamion, SalidaCamionItem, Producto, Venta, VentaItem, Cliente, User, Proveedor } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

const checkDayClosed = async (fecha) => {
  const cierre = await CierreCaja.findOne({ where: { fecha } });
  return !!cierre;
};

export const getResumenDelDia = async (req, res) => {
  try {
    const today = getFechaLocal();

    const salidasHoy = await SalidaCamion.findAll({
      where: { fecha: today },
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
        { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
        { model: User, as: "repartidor_asignado", attributes: ["id", "nombre"] },
      ],
    });

    let mercaderia_enviada = 0;
    let mercaderia_devuelta = 0;
    const detalle_enviadas = [];
    const detalle_devueltas = [];

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        const valor = parseFloat(item.precio_unitario) * item.cantidad;
        mercaderia_enviada += valor;
        detalle_enviadas.push({
          producto: item.Producto?.nombre || "Desconocido",
          cantidad: item.cantidad,
          precio_unitario: parseFloat(item.precio_unitario),
          subtotal: valor,
          camion: salida.camion,
          salida_id: salida.id,
          repartidor: salida.repartidor_asignado?.nombre || "Sin asignar",
        });
        if (item.cantidad_devuelta && item.cantidad_devuelta > 0) {
          const valorDevuelto = parseFloat(item.precio_unitario) * item.cantidad_devuelta;
          mercaderia_devuelta += valorDevuelto;
          detalle_devueltas.push({
            producto: item.Producto?.nombre || "Desconocido",
            cantidad: item.cantidad_devuelta,
            precio_unitario: parseFloat(item.precio_unitario),
            subtotal: valorDevuelto,
            camion: salida.camion,
            salida_id: salida.id,
            repartidor: salida.repartidor_asignado?.nombre || "Sin asignar",
          });
        }
      }
    }

    const ventasHoy = await Venta.findAll({
      where: { fecha: today, estado: "completada" },
      include: [
        {
          model: VentaItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
      ],
    });

    let localMonto = 0;
    let localCount = 0;
    let repartoMonto = 0;
    let repartoCount = 0;

    for (const venta of ventasHoy) {
      const monto = parseFloat(venta.total) || 0;
      if (venta.tipo_venta === "local") {
        localMonto += monto;
        localCount++;
      } else {
        repartoMonto += monto;
        repartoCount++;
      }
    }

    const totalGeneral = localMonto + repartoMonto;
    const ventas_netas = mercaderia_enviada - mercaderia_devuelta;

    const cierreExistente = await CierreCaja.findOne({ where: { fecha: today } });

    res.json({
      fecha: today,
      salidas_count: salidasHoy.length,
      mercaderia_enviada: mercaderia_enviada.toFixed(2),
      mercaderia_devuelta: mercaderia_devuelta.toFixed(2),
      ventas_netas_envio: ventas_netas.toFixed(2),
      local_monto: localMonto.toFixed(2),
      local_count: localCount,
      reparto_monto: repartoMonto.toFixed(2),
      reparto_count: repartoCount,
      total_general: totalGeneral.toFixed(2),
      cerrado: !!cierreExistente,
      cierre: cierreExistente || null,
      detalle_enviadas,
      detalle_devueltas,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener resumen del dia", error: error.message });
  }
};

export const cerrarCaja = async (req, res) => {
  try {
    const today = getFechaLocal();

    const cierreExistente = await CierreCaja.findOne({ where: { fecha: today } });
    if (cierreExistente) {
      return res.status(400).json({ message: "La caja ya fue cerrada para este dia" });
    }

    const salidasHoy = await SalidaCamion.findAll({
      where: { fecha: today },
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
      ],
    });

    let mercaderia_enviada = 0;
    let mercaderia_devuelta = 0;

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        const valor = parseFloat(item.precio_unitario) * item.cantidad;
        mercaderia_enviada += valor;
        if (item.cantidad_devuelta && item.cantidad_devuelta > 0) {
          mercaderia_devuelta += parseFloat(item.precio_unitario) * item.cantidad_devuelta;
        }
      }
    }

    const ventasHoy = await Venta.findAll({
      where: { fecha: today, estado: "completada" },
    });

    let localMonto = 0;
    let localCount = 0;
    let repartoMonto = 0;
    let repartoCount = 0;

    for (const venta of ventasHoy) {
      const monto = parseFloat(venta.total) || 0;
      if (venta.tipo_venta === "local") {
        localMonto += monto;
        localCount++;
      } else {
        repartoMonto += monto;
        repartoCount++;
      }
    }

    const totalGeneral = localMonto + repartoMonto;
    const ventas_netas = mercaderia_enviada - mercaderia_devuelta;
    const now = new Date();
    const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const cierre = await CierreCaja.create({
      fecha: today,
      hora,
      total_ventas: totalGeneral.toFixed(2),
      salidas_count: salidasHoy.length,
      mercaderia_enviada: mercaderia_enviada.toFixed(2),
      mercaderia_devuelta: mercaderia_devuelta.toFixed(2),
      ventas_netas: ventas_netas.toFixed(2),
      usuario_cierre: req.user.nombre,
    });

    const salidasEnCamino = await SalidaCamion.findAll({
      where: { fecha: today, estado: "en_camino" },
    });
    for (const salida of salidasEnCamino) {
      await salida.update({ estado: "sobrante" });
    }

    res.status(201).json({ message: "Caja cerrada exitosamente", cierre });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar caja", error: error.message });
  }
};

export const getHistorialCierres = async (req, res) => {
  try {
    const cierres = await CierreCaja.findAll({
      order: [["fecha", "DESC"], ["createdAt", "DESC"]],
    });
    res.json(cierres);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial", error: error.message });
  }
};

export const getDetalleCierre = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();

    const cierre = await CierreCaja.findOne({ where: { fecha } });
    if (!cierre) {
      return res.status(404).json({ message: "No existe cierre para esa fecha" });
    }

    const salidasHoy = await SalidaCamion.findAll({
      where: { fecha },
      include: [
        {
          model: SalidaCamionItem,
          include: [{ model: Producto, attributes: ["id", "nombre", "precio"] }],
        },
      ],
    });

    const ventasHoy = await Venta.findAll({
      where: { fecha, estado: "completada" },
      attributes: ["id", "fecha", "hora", "datos_transferencia", "datos_tarjeta", "medio_pago", "total", "tipo_venta", "proveedorId"],
      include: [{ model: Proveedor, attributes: ["id", "nombre", "alias"] }],
    });

    let kg_enviados = 0;
    let kg_devueltos = 0;

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        kg_enviados += item.cantidad || 0;
        if (item.cantidad_devuelta) {
          kg_devueltos += item.cantidad_devuelta;
        }
      }
    }

    const parseDatos = (datos) => {
      if (!datos) return [];
      if (typeof datos === "string") {
        try { return JSON.parse(datos); } catch { return []; }
      }
      if (Array.isArray(datos)) return datos;
      return [];
    };

    const pagos = [];
    let localMonto = 0;
    let localCount = 0;
    let repartoMonto = 0;
    let repartoCount = 0;

    for (const venta of ventasHoy) {
      const monto = parseFloat(venta.total) || 0;
      if (venta.tipo_venta === "local") {
        localMonto += monto;
        localCount++;
      } else {
        repartoMonto += monto;
        repartoCount++;
      }

      const proveedor = venta.Proveedor;
      const proveedorInfo = proveedor ? { id: proveedor.id, nombre: proveedor.nombre, alias: proveedor.alias } : null;

      for (const t of parseDatos(venta.datos_transferencia)) {
        pagos.push({
          tipo: "Transferencia",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorInfo,
        });
      }

      for (const t of parseDatos(venta.datos_tarjeta)) {
        pagos.push({
          tipo: "Tarjeta",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorInfo,
        });
      }

      if (venta.medio_pago === "efectivo" && (!venta.datos_transferencia || parseDatos(venta.datos_transferencia).length === 0) && (!venta.datos_tarjeta || parseDatos(venta.datos_tarjeta).length === 0)) {
        pagos.push({
          tipo: "Efectivo",
          fecha_hora: `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: "-",
          monto: monto,
          banco: "-",
          proveedor: proveedorInfo,
        });
      }
    }

    res.json({
      fecha: cierre.fecha,
      hora: cierre.hora,
      usuario_cierre: cierre.usuario_cierre,
      salidas_count: cierre.salidas_count,
      mercaderia_enviada: cierre.mercaderia_enviada,
      mercaderia_devuelta: cierre.mercaderia_devuelta,
      ventas_netas: cierre.ventas_netas,
      total_ventas: cierre.total_ventas,
      local_monto: localMonto.toFixed(2),
      local_count: localCount,
      reparto_monto: repartoMonto.toFixed(2),
      reparto_count: repartoCount,
      kg_pollos: kg_enviados,
      kg_devueltos: kg_devueltos,
      pagos,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener detalle del cierre", error: error.message });
  }
};

export const getPagosHoy = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();

    const ventasHoy = await Venta.findAll({
      where: { fecha, estado: "completada" },
      attributes: ["id", "fecha", "hora", "datos_transferencia", "datos_tarjeta", "medio_pago", "total", "proveedorId"],
      include: [{ model: Proveedor, attributes: ["id", "nombre", "alias"] }],
    });

    const pagos = [];

    const parseDatos = (datos) => {
      if (!datos) return [];
      if (typeof datos === "string") {
        try { return JSON.parse(datos); } catch { return []; }
      }
      if (Array.isArray(datos)) return datos;
      return [];
    };

    for (const venta of ventasHoy) {
      const proveedor = venta.Proveedor;
      const proveedorInfo = proveedor ? { id: proveedor.id, nombre: proveedor.nombre, alias: proveedor.alias } : null;

      for (const t of parseDatos(venta.datos_transferencia)) {
        pagos.push({
          tipo: "Transferencia",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorInfo,
        });
      }

      for (const t of parseDatos(venta.datos_tarjeta)) {
        pagos.push({
          tipo: "Tarjeta",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorInfo,
        });
      }

      if (venta.medio_pago === "efectivo" && (!venta.datos_transferencia || parseDatos(venta.datos_transferencia).length === 0) && (!venta.datos_tarjeta || parseDatos(venta.datos_tarjeta).length === 0)) {
        pagos.push({
          tipo: "Efectivo",
          fecha_hora: `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: "-",
          monto: parseFloat(venta.total || 0),
          banco: "-",
          proveedor: proveedorInfo,
        });
      }
    }

    res.json(pagos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pagos del dia", error: error.message });
  }
};

export { checkDayClosed };
