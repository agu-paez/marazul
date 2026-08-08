import sequelize from "../config/database.js";
import { Proveedor, Cliente, Producto, Venta, VentaItem, VentaPago } from "../models/index.js";
import logger from "../utils/logger.js";
import { getFechaLocal } from "../utils/fecha.js";

const hoy = new Date();

const fechaDiasAtras = (n) => {
  const d = new Date(hoy);
  d.setDate(d.getDate() - n);
  return getFechaLocal(d);
};

const datosBancarios = {
  "Granja del sol": { nombre_cuenta: "Granja del Sol SA", banco: "Banco Nación" },
  "Distribuidora San Martín": { nombre_cuenta: "San Martín Distribuciones", banco: "Banco Provincia" },
  "Carnes La Estancia": { nombre_cuenta: "Estancia Carnes SRL", banco: "Banco Macro" },
  "Avícola La Blanquita": { nombre_cuenta: "Avícola La Blanquita", banco: "Mercado Pago" },
};

const seedTransferencias = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("Conectado");

    const proveedores = await Proveedor.findAll();
    const porNombre = new Map(proveedores.map((p) => [p.nombre, p]));
    const porId = new Map(proveedores.map((p) => [p.id, p]));
    const clientes = await Cliente.findAll();
    const cliente = (nombre) => clientes.find((c) => c.nombre === nombre);
    const productos = await Producto.findAll();
    const producto = (nombre) => productos.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase());

    const bancoDe = (proveedor) => datosBancarios[proveedor?.nombre] || { nombre_cuenta: proveedor?.nombre || "-", banco: "Banco Nación" };

    let actualizadas = 0;
    const ventasTransfer = await Venta.findAll({
      where: sequelize.literal(`(medio_pago = 'transferencia' OR pago_dividido = 1)`),
    });
    for (const venta of ventasTransfer) {
      const yaTiene = venta.datos_transferencia && JSON.stringify(venta.datos_transferencia) !== "[]";
      if (yaTiene) continue;
      const proveedor = porId.get(venta.proveedorId);
      if (!proveedor) continue;
      const { nombre_cuenta, banco } = bancoDe(proveedor);
      await venta.update({
        datos_transferencia: [
          {
            proveedorId: proveedor.id,
            nombre_cuenta,
            banco,
            monto: parseFloat(venta.total || 0),
            fecha_hora: `${venta.fecha}T09:30:00`,
          },
        ],
      });
      actualizadas++;
    }
    console.log(`Ventas de transferencia actualizadas: ${actualizadas}`);

    const transferNuevas = [
      { d: 0, h: "08:50", cliente: "Panadería El Trigo", proveedor: "Granja del sol", items: [[producto("Huevos x 30"), 6, 6800]], banco: "Banco Nación" },
      { d: 0, h: "10:40", cliente: "Verdulería La Huerta", proveedor: "Distribuidora San Martín", items: [[producto("Coca Cola 2.25L"), 24, 3200], [producto("Agua mineral 2L"), 12, 1500]], banco: "Banco Provincia" },
      { d: 1, h: "11:20", cliente: "Supermercado El Sol", proveedor: "Carnes La Estancia", items: [[producto("Bife de chorizo"), 6, 8900], [producto("Vacío"), 4, 7600]], banco: "Banco Macro" },
      { d: 1, h: "16:10", cliente: "Frigorífico San Cayetano", proveedor: "Avícola La Blanquita", items: [[producto("Milanesa de pollo"), 15, 2800], [producto("Papas fritas bolsa"), 20, 900]], banco: "Mercado Pago" },
      { d: 2, h: "09:15", cliente: "Almacén La Esperanza", proveedor: "Granja del sol", items: [[producto("Pollo entero"), 12, 4200]], banco: "Brubank" },
      { d: 2, h: "15:30", cliente: "Supermercado La Frontera", proveedor: "Distribuidora San Martín", items: [[producto("Coca Cola 2.25L"), 18, 3200]], banco: "Banco Nación" },
      { d: 3, h: "12:05", cliente: "Carnicería Don Luis", proveedor: "Carnes La Estancia", items: [[producto("Bife de chorizo"), 5, 8900], [producto("Vacío"), 3, 7600]], banco: "Banco Provincia" },
      { d: 4, h: "17:45", cliente: "Kiosco El Barrio", proveedor: "Avícola La Blanquita", items: [[producto("Milanesa de pollo"), 8, 2800]], banco: "Mercado Pago" },
      { d: 5, h: "10:00", cliente: "Pollería La Criolla", proveedor: "Granja del sol", items: [[producto("Pollo entero"), 15, 4200], [producto("Coca Cola 2.25L"), 10, 3200]], banco: "Banco Nación", divididoProveedores: true },
    ];

    let creadas = 0;
    for (let i = 0; i < transferNuevas.length; i++) {
      const t = transferNuevas[i];
      const fecha = fechaDiasAtras(t.d);
      const numero = `TR-${String(i + 1).padStart(4, "0")}`;
      const existe = await Venta.findOne({ where: { numero_comprobante: numero } });
      if (existe) continue;

      const cli = cliente(t.cliente);
      if (!cli) continue;
      const proveedor = porNombre.get(t.proveedor);
      if (!proveedor) continue;
      const items = t.items.filter(([p]) => p);
      const total = items.reduce((s, [, cant, precio]) => s + cant * precio, 0);
      const { nombre_cuenta } = bancoDe(proveedor);

      let datos;
      if (t.divididoProveedores) {
        const proveedor2 = porNombre.get("Distribuidora San Martín");
        const montoGranja = items.filter(([p]) => p.nombre === "Pollo entero").reduce((s, [, c, pr]) => s + c * pr, 0);
        const montoBebidas = total - montoGranja;
        datos = [
          { proveedorId: proveedor.id, nombre_cuenta, banco: t.banco, monto: montoGranja, fecha_hora: `${fecha}T${t.h}:00` },
          { proveedorId: proveedor2.id, nombre_cuenta: "San Martín Distribuciones", banco: "Banco Provincia", monto: montoBebidas, fecha_hora: `${fecha}T${t.h}:05` },
        ];
      } else {
        datos = [
          { proveedorId: proveedor.id, nombre_cuenta, banco: t.banco, monto: total, fecha_hora: `${fecha}T${t.h}:00` },
        ];
      }

      const venta = await Venta.create({
        numero_comprobante: numero,
        fecha,
        hora: `${t.h}:00`,
        tipo_venta: "reparto",
        cliente_nombre: cli.nombre,
        cliente_direccion: `Zona ${cli.zona}`,
        cliente_telefono: null,
        medio_pago: "transferencia",
        pago_dividido: false,
        subtotal: total,
        total,
        notas: "Pago por transferencia",
        clienteId: cli.id,
        salidaCamionId: null,
        estado: "completada",
        datos_transferencia: datos,
        datos_tarjeta: null,
        proveedorId: proveedor.id,
        porcentaje_aumento: 0,
      });

      for (const [p, cant, precio] of items) {
        await VentaItem.create({ cantidad: cant, precio_unitario: precio, ventaId: venta.id, productoId: p.id });
      }
      await VentaPago.create({ ventaId: venta.id, medio_pago: "transferencia", monto: total });
      creadas++;
    }
    console.log(`Transferencias nuevas creadas: ${creadas}`);

    const totalTransfer = await Venta.count({
      where: sequelize.literal(`datos_transferencia IS NOT NULL AND json_valid(datos_transferencia) AND json_array_length(datos_transferencia) > 0`),
    });
    console.log(`Total ventas con transferencias (JSON): ${totalTransfer}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error("Error en seed de transferencias", { error: error.stack || error.message });
    await sequelize.close();
    process.exit(1);
  }
};

seedTransferencias();
