import { CierreCaja, SalidaCamion, SalidaCamionItem, Producto, Venta, VentaItem, Cliente, User, Role, Proveedor, GastoDia, PagoEmpleado, ProveedorMovimiento } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";
import { Op } from "sequelize";

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
            include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "kg_por_caja"] }],
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
           include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "kg_por_caja"] }],
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
    const gastoDia = await GastoDia.findOne({ where: { fecha: today } });
    const pagosEmpleados = await PagoEmpleado.findAll({
      where: { fecha: today },
      include: [{ model: User, as: "empleado", attributes: ["id", "nombre"], include: [{ model: Role, attributes: ["nombre"] }] }],
    });
    const pagosEmpleadosSnapshot = pagosEmpleados.map((pago) => ({
      userId: pago.userId,
      nombre: pago.empleado?.nombre || "Empleado",
      rol: pago.empleado?.Role?.nombre || "-",
      monto: parseFloat(pago.monto) || 0,
    }));
    const now = new Date();
    const hora = now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const cierre = await CierreCaja.create({
      fecha: today,
      hora,
      total_ventas: totalGeneral.toFixed(2),
      salidas_count: salidasHoy.length,
      mercaderia_enviada: mercaderia_enviada.toFixed(2),
      mercaderia_devuelta: mercaderia_devuelta.toFixed(2),
      ventas_netas: ventas_netas.toFixed(2),
      usuario_cierre: req.user.nombre,
      gastos_combustible: gastoDia?.combustible || 0,
      gastos_otros: gastoDia?.otros || 0,
      descripcion_otros_gastos: gastoDia?.descripcion_otros || "",
      pagos_empleados: JSON.stringify(pagosEmpleadosSnapshot),
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

const parsePagosEmpleados = (valor) => {
  if (!valor) return [];
  try { return typeof valor === "string" ? JSON.parse(valor) : valor; } catch { return []; }
};

export const getHistorialGastos = async (req, res) => {
  try {
    const cierres = await CierreCaja.findAll({
      attributes: ["id", "fecha", "hora", "usuario_cierre", "gastos_combustible", "gastos_otros", "descripcion_otros_gastos"],
      order: [["fecha", "DESC"]],
    });
    res.json(cierres.map((cierre) => ({
      ...cierre.toJSON(),
      total: (parseFloat(cierre.gastos_combustible) || 0) + (parseFloat(cierre.gastos_otros) || 0),
    })));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de gastos", error: error.message });
  }
};

export const getHistorialPagosEmpleados = async (req, res) => {
  try {
    const cierres = await CierreCaja.findAll({
      attributes: ["id", "fecha", "hora", "usuario_cierre", "pagos_empleados"],
      order: [["fecha", "DESC"]],
    });
    res.json(cierres.map((cierre) => ({
      id: cierre.id,
      fecha: cierre.fecha,
      hora: cierre.hora,
      usuario_cierre: cierre.usuario_cierre,
      pagos: parsePagosEmpleados(cierre.pagos_empleados),
    })).filter((registro) => registro.pagos.length > 0));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de pagos a empleados", error: error.message });
  }
};

export const getResumenIngresosEgresos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return res.status(400).json({ message: "Debe indicar fechas validas desde y hasta" });
    }
    if (desde > hasta) {
      return res.status(400).json({ message: "La fecha desde no puede ser posterior a hasta" });
    }

    const cierres = await CierreCaja.findAll({
      where: { fecha: { [Op.between]: [desde, hasta] } },
      order: [["fecha", "ASC"]],
    });

    const ventas = await Venta.findAll({
      where: { fecha: { [Op.between]: [desde, hasta] }, estado: "completada" },
      attributes: ["fecha", "total"],
      include: [{ model: VentaItem, attributes: ["cantidad", "costo_unitario"], include: [{ model: Producto, attributes: ["costo"] }] }],
    });
    const costosPorFecha = {};
    const ventasPorFecha = {};
    for (const venta of ventas) {
      ventasPorFecha[venta.fecha] = (ventasPorFecha[venta.fecha] || 0) + (parseFloat(venta.total) || 0);
      costosPorFecha[venta.fecha] = (costosPorFecha[venta.fecha] || 0) + (venta.VentaItems || []).reduce((sum, item) => {
        const costo = parseFloat(item.costo_unitario) || parseFloat(item.Producto?.costo) || 0;
        return sum + costo * (item.cantidad || 0);
      }, 0);
    }
    const movimientos = await ProveedorMovimiento.findAll({ where: { fecha: { [Op.between]: [desde, hasta] } } });
    const comprasPorFecha = {};
    for (const movimiento of movimientos) {
      comprasPorFecha[movimiento.fecha] = (comprasPorFecha[movimiento.fecha] || 0) + (parseFloat(movimiento.mercaderias_compradas) || 0);
    }
    const cierresPorFecha = new Map(cierres.map((cierre) => [cierre.fecha, cierre]));
    const fechas = new Set([...cierres.map((cierre) => cierre.fecha), ...Object.keys(ventasPorFecha), ...Object.keys(comprasPorFecha)]);

    const detalle = [...fechas].sort().map((fecha) => {
      const cierre = cierresPorFecha.get(fecha);
      const combustible = parseFloat(cierre?.gastos_combustible) || 0;
      const otros = parseFloat(cierre?.gastos_otros) || 0;
      const pagos = parsePagosEmpleados(cierre?.pagos_empleados);
      const pagosTotal = pagos.reduce((sum, pago) => sum + (parseFloat(pago.monto) || 0), 0);
      const ingresos = cierre ? parseFloat(cierre.total_ventas) || 0 : ventasPorFecha[fecha] || 0;
      const costoMercaderia = costosPorFecha[fecha] || 0;
      const comprasProveedores = comprasPorFecha[fecha] || 0;
      return {
        fecha,
        usuario_cierre: cierre?.usuario_cierre || "-",
        ingresos,
        combustible,
        otros,
        costo_mercaderia: costoMercaderia,
        compras_proveedores: comprasProveedores,
        descripcion_otros: cierre?.descripcion_otros_gastos || "",
        pagos_empleados: pagos,
        pagos_empleados_total: pagosTotal,
        egresos: combustible + otros + pagosTotal + costoMercaderia + comprasProveedores,
        resultado: ingresos - combustible - otros - pagosTotal - costoMercaderia - comprasProveedores,
      };
    });

    const resumen = detalle.reduce((totales, dia) => ({
      ingresos: totales.ingresos + dia.ingresos,
      combustible: totales.combustible + dia.combustible,
      otros: totales.otros + dia.otros,
      costo_mercaderia: totales.costo_mercaderia + dia.costo_mercaderia,
      compras_proveedores: totales.compras_proveedores + dia.compras_proveedores,
      pagos_empleados: totales.pagos_empleados + dia.pagos_empleados_total,
      egresos: totales.egresos + dia.egresos,
      resultado: totales.resultado + dia.resultado,
    }), { ingresos: 0, combustible: 0, otros: 0, costo_mercaderia: 0, compras_proveedores: 0, pagos_empleados: 0, egresos: 0, resultado: 0 });

    res.json({ desde, hasta, cierres: cierres.length, resumen, detalle });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener ingresos y egresos", error: error.message });
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
          include: [{ model: Producto, attributes: ["id", "nombre", "precio", "unidad", "kg_por_caja"] }],
        },
      ],
    });

    const ventasHoy = await Venta.findAll({
      where: { fecha, estado: "completada" },
      attributes: ["id", "fecha", "hora", "datos_transferencia", "datos_tarjeta", "medio_pago", "total", "tipo_venta", "proveedorId"],
      include: [{ model: Proveedor, attributes: ["id", "nombre", "alias"] }],
    });
    const proveedores = await Proveedor.findAll({ attributes: ["id", "nombre", "alias"] });
    const proveedoresPorId = new Map(proveedores.map((p) => [p.id, { id: p.id, nombre: p.nombre, alias: p.alias }]));

    let kg_enviados = 0;
    let kg_devueltos = 0;

    const calcularKilos = (item) => {
      const cantidad = Number(item.cantidad) || 0;
      const kgPorCaja = Number(item.Producto?.kg_por_caja) || 0;
      const unidad = String(item.Producto?.unidad || "").toLowerCase();
      if (kgPorCaja > 0) return cantidad * kgPorCaja;
      return unidad === "kilogramo" || unidad === "kg" ? cantidad : 0;
    };

    for (const salida of salidasHoy) {
      for (const item of salida.SalidaCamionItems || []) {
        kg_enviados += calcularKilos(item);
        if (item.cantidad_devuelta) {
          kg_devueltos += calcularKilos({ ...item.toJSON(), cantidad: item.cantidad_devuelta });
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
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Transferencia",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_tarjeta)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Tarjeta",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      if (venta.medio_pago === "efectivo" && (!venta.datos_transferencia || parseDatos(venta.datos_transferencia).length === 0) && (!venta.datos_tarjeta || parseDatos(venta.datos_tarjeta).length === 0)) {
        pagos.push({
          tipo: "Efectivo",
          fecha_hora: `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: "-",
          monto: monto,
          banco: "-",
          proveedor: null,
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
      gastos_combustible: cierre.gastos_combustible,
      gastos_otros: cierre.gastos_otros,
      descripcion_otros_gastos: cierre.descripcion_otros_gastos,
      pagos_empleados: parsePagosEmpleados(cierre.pagos_empleados),
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
    const proveedores = await Proveedor.findAll({ attributes: ["id", "nombre", "alias"] });
    const proveedoresPorId = new Map(proveedores.map((p) => [p.id, { id: p.id, nombre: p.nombre, alias: p.alias }]));

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
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Transferencia",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorPago || null,
        });
      }

      for (const t of parseDatos(venta.datos_tarjeta)) {
        const proveedorPago = t.proveedorId ? proveedoresPorId.get(Number(t.proveedorId)) : proveedorInfo;
        pagos.push({
          tipo: "Tarjeta",
          fecha_hora: t.fecha_hora || `${venta.fecha} ${venta.hora}`,
          nombre_cuenta: t.nombre_cuenta || "-",
          monto: parseFloat(t.monto || 0),
          banco: t.banco || "-",
          proveedor: proveedorPago || null,
        });
      }

    }

    res.json(pagos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pagos del dia", error: error.message });
  }
};

export { checkDayClosed };
