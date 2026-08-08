import sequelize from "../config/database.js";
import {
  Role,
  User,
  Proveedor,
  Marca,
  Producto,
  Cliente,
  ClientePago,
  Venta,
  VentaItem,
  VentaPago,
  Reparto,
  RepartoItem,
  SalidaCamion,
  SalidaCamionItem,
  CierreCaja,
  Produccion,
} from "../models/index.js";
import logger from "../utils/logger.js";
import { getFechaLocal } from "../utils/fecha.js";

const hoy = new Date();

const diasAtras = (n, hora = "08:00:00 a. m.") => {
  const d = new Date(hoy);
  d.setDate(d.getDate() - n);
  return { fecha: getFechaLocal(d), hora };
};

const horaPara = (n, h) => {
  const d = new Date(hoy);
  d.setDate(d.getDate() - n);
  return { fecha: getFechaLocal(d), hora: h };
};

const seedData = async () => {
  try {
    await sequelize.authenticate();
    console.log("Conectado a la base de datos");

    await sequelize.sync();
    console.log("Modelos sincronizados");

    const admin = await User.findOne({ where: { id: 1 } });
    const repartidores = await User.findAll({ where: { roleId: 3 } });
    const roles = await Role.findAll();
    const rolOperador = roles.find((r) => r.nombre === "operador");
    const rolRepartidor = roles.find((r) => r.nombre === "repartidor");
    const operador = await User.findOne({ where: { id: 2 } }) || null;

    let proveedores = await Proveedor.findAll();
    const proveedorNuevos = [
      { nombre: "Avícola La Blanquita", telefono: "3515551010", direccion: "Ruta 9 km 320", email: "blanquita@email.com", alias: "blanquita.mp", tipo_producto: "pollos" },
      { nombre: "Distribuidora San Martín", telefono: "3515552020", direccion: "Av. Vélez Sarsfield 900", email: "sanjorge@email.com", alias: "sanjorge.mp", tipo_producto: "bebidas" },
      { nombre: "Carnes La Estancia", telefono: "3515553030", direccion: "Camino 60 Cuadras 1500", email: "estancia@email.com", alias: "estancia.mp", tipo_producto: "carnes" },
    ];
    for (const p of proveedorNuevos) {
      const existe = proveedores.some((pr) => pr.nombre.toLowerCase() === p.nombre.toLowerCase());
      if (!existe) proveedores.push(await Proveedor.create(p));
    }
    console.log(`Proveedores: ${proveedores.length}`);

    const marcasNuevas = [
      { nombre: "pollos del valle", proveedorId: 1 },
      { nombre: "bebidas cordoba", proveedorId: proveedores.find((p) => p.nombre === "Distribuidora San Martín")?.id },
      { nombre: "carnes premium", proveedorId: proveedores.find((p) => p.nombre === "Carnes La Estancia")?.id },
      { nombre: "granja selecta", proveedorId: proveedores.find((p) => p.nombre === "Avícola La Blanquita")?.id },
    ];
    const marcasExistentes = await Marca.findAll();
    const marcas = [...marcasExistentes];
    for (const m of marcasNuevas) {
      if (!m.proveedorId) continue;
      const existe = marcas.some((mc) => mc.nombre === m.nombre && mc.proveedorId === m.proveedorId);
      if (!existe) marcas.push(await Marca.create(m));
    }
    console.log(`Marcas: ${marcas.length}`);

    const marca = (nombre) => marcas.find((mc) => mc.nombre === nombre);
    const productosNuevos = [
      { nombre: "Pollo entero", descripcion: "Pollo entero fresco", precio: 4200, stock: 80, unidad: "pieza", kg_por_caja: 12, marcaId: marca("pollos")?.id },
      { nombre: "Medio pollo", descripcion: "Medio pollo fresco", precio: 2300, stock: 120, unidad: "pieza", kg_por_caja: 12, marcaId: marca("pollos")?.id },
      { nombre: "Pata muslo", descripcion: "Pata muslo por kg", precio: 1900, stock: 60, unidad: "kilogramo", kg_por_caja: 10, marcaId: marca("pollos")?.id },
      { nombre: "Alitas", descripcion: "Alitas por kg", precio: 1700, stock: 55, unidad: "kilogramo", kg_por_caja: 8, marcaId: marca("pollos")?.id },
      { nombre: "Pechuga", descripcion: "Pechuga por kg", precio: 5200, stock: 40, unidad: "kilogramo", kg_por_caja: 10, marcaId: marca("pollos")?.id },
      { nombre: "Coca Cola 2.25L", descripcion: "Gaseosa coca cola", precio: 3200, stock: 150, unidad: "botella", marcaId: marca("bebidas cordoba")?.id },
      { nombre: "Agua mineral 2L", descripcion: "Agua sin gas", precio: 1500, stock: 180, unidad: "botella", marcaId: marca("bebidas cordoba")?.id },
      { nombre: "Bife de chorizo", descripcion: "Bife por kg", precio: 8900, stock: 25, unidad: "kilogramo", marcaId: marca("carnes premium")?.id },
      { nombre: "Vacío", descripcion: "Vacío por kg", precio: 7600, stock: 30, unidad: "kilogramo", marcaId: marca("carnes premium")?.id },
      { nombre: "Papas fritas bolsa", descripcion: "Papas fritas", precio: 900, stock: 200, unidad: "bolsa", marcaId: marca("granja selecta")?.id },
      { nombre: "Milanesa de pollo", descripcion: "Milanesa lista", precio: 2800, stock: 45, unidad: "pieza", marcaId: marca("granja selecta")?.id },
      { nombre: "Huevos x 30", descripcion: "Maple de huevos", precio: 6800, stock: 35, unidad: "maple", marcaId: marca("sancor")?.id },
    ];

    const productosExistentes = await Producto.findAll();
    const productos = [...productosExistentes];
    for (const p of productosNuevos) {
      const existe = productos.some((pr) => pr.nombre.toLowerCase() === p.nombre.toLowerCase());
      if (!existe) productos.push(await Producto.create(p));
    }
    console.log(`Productos: ${productos.length}`);

    const producto = (nombre) => productos.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase());

    const zonas = ["Centro", "Norte", "Sur", "Este", "Oeste", "Noreste", "Suroeste"];
    const nombresPorZona = {
      Centro: ["Panadería El Trigo", "Almacén Central", "Verdulería La Huerta", "Carnicería Don Luis"],
      Norte: ["Rotisería La Nonna", "Supermercado Norte Sur", "Kiosco El Barrio", "Pollería Los Andes"],
      Sur: ["Almacén La Estrella", "Frigorífico San Cayetano", "Despensa La Villa", "Almacén El Progreso"],
      Este: ["Pollería La Criolla", "Verdulería Del Este", "Supermercado La Frontera", "Rotisería El Pato"],
      Oeste: ["Almacén La Esperanza", "Carnicería El Gaucho", "Despensa La Rosa", "Pollería El Federal"],
      Noreste: ["Supermercado El Sol", "Almacén La Union", "Rotisería Doña Rosa", "Kiosco La Esquina"],
      Suroeste: ["Pollería San Pedro", "Despensa La Campana", "Almacén El Amigo", "Frigorífico La Plata"],
    };

    const clienteExistente = await Cliente.count();
    if (clienteExistente === 0) {
      const clientes = [];
      for (const zona of zonas) {
        for (let i = 0; i < nombresPorZona[zona].length; i++) {
          const nombre = nombresPorZona[zona][i];
          const conDeuda = (i % 3) === 0;
          clientes.push(
            await Cliente.create({
              nombre,
              zona,
              saldo_pendiente: conDeuda ? 45000 + i * 3500 : 0,
              limite_credito: 120000,
              activo: true,
              zona_pendiente: false,
            })
          );
        }
      }
      console.log(`Clientes creados: ${clientes.length}`);
    } else {
      console.log(`Clientes ya existentes: ${clienteExistente}, se omiten`);
    }

    const clientes = await Cliente.findAll();
    const cliente = (nombre) => clientes.find((c) => c.nombre === nombre);
    const clientePorZona = (zona) => clientes.find((c) => c.zona === zona);

    const ventaExistente = await Venta.count();
    if (ventaExistente === 0) {
      const ventasPlan = [
        { d: 0, h: "09:12:00 a. m.", tipo: "local", cliente: "Almacén Central", pago: "efectivo", items: [[producto("Pollo entero"), 5, 4200], [producto("Coca Cola 2.25L"), 6, 3200]] },
        { d: 0, h: "10:05:00 a. m.", tipo: "local", cliente: "Verdulería La Huerta", pago: "transferencia", items: [[producto("Medio pollo"), 8, 2300], [producto("Pata muslo"), 10, 1900]] },
        { d: 0, h: "11:40:00 a. m.", tipo: "reparto", cliente: "Pollería Los Andes", pago: "efectivo", items: [[producto("Pollo entero"), 10, 4200]] },
        { d: 0, h: "13:20:00 p. m.", tipo: "local", cliente: "Carnicería Don Luis", pago: "tarjeta", items: [[producto("Bife de chorizo"), 8, 8900], [producto("Vacío"), 5, 7600]] },
        { d: 0, h: "15:45:00 p. m.", tipo: "reparto", cliente: "Supermercado Norte Sur", pago: "cuenta_corriente", items: [[producto("Pechuga"), 6, 5200], [producto("Alitas"), 8, 1700]] },
        { d: 0, h: "17:30:00 p. m.", tipo: "local", cliente: "Kiosco La Esquina", pago: "dividido", items: [[producto("Papas fritas bolsa"), 20, 900], [producto("Coca Cola 2.25L"), 10, 3200], [producto("Huevos x 30"), 4, 6800]] },
        { d: 0, h: "18:15:00 p. m.", tipo: "reparto", cliente: "Almacén La Estrella", pago: "efectivo", items: [[producto("Milanesa de pollo"), 15, 2800]] },
        { d: 1, h: "09:00:00 a. m.", tipo: "local", cliente: "Panadería El Trigo", pago: "efectivo", items: [[producto("Huevos x 30"), 6, 6800]] },
        { d: 1, h: "12:10:00 p. m.", tipo: "reparto", cliente: "Rotisería La Nonna", pago: "transferencia", items: [[producto("Pollo entero"), 12, 4200], [producto("Medio pollo"), 6, 2300]] },
        { d: 2, h: "10:30:00 a. m.", tipo: "local", cliente: "Supermercado El Sol", pago: "cuenta_corriente", items: [[producto("Coca Cola 2.25L"), 24, 3200]] },
        { d: 2, h: "16:00:00 p. m.", tipo: "reparto", cliente: "Pollería La Criolla", pago: "efectivo", items: [[producto("Pollo entero"), 15, 4200], [producto("Alitas"), 12, 1700]] },
        { d: 3, h: "09:45:00 a. m.", tipo: "local", cliente: "Almacén La Esperanza", pago: "tarjeta", items: [[producto("Papas fritas bolsa"), 30, 900], [producto("Agua mineral 2L"), 20, 1500]] },
        { d: 3, h: "14:30:00 p. m.", tipo: "reparto", cliente: "Despensa La Villa", pago: "transferencia", items: [[producto("Milanesa de pollo"), 10, 2800], [producto("Pata muslo"), 8, 1900]] },
        { d: 4, h: "11:00:00 a. m.", tipo: "local", cliente: "Frigorífico San Cayetano", pago: "efectivo", items: [[producto("Bife de chorizo"), 10, 8900]] },
        { d: 4, h: "17:20:00 p. m.", tipo: "reparto", cliente: "Almacén El Progreso", pago: "cuenta_corriente", items: [[producto("Pechuga"), 5, 5200], [producto("Vacío"), 4, 7600]] },
        { d: 5, h: "09:30:00 a. m.", tipo: "local", cliente: "Verdulería Del Este", pago: "efectivo", items: [[producto("Pollo entero"), 8, 4200], [producto("Huevos x 30"), 3, 6800]] },
        { d: 5, h: "15:10:00 p. m.", tipo: "reparto", cliente: "Supermercado La Frontera", pago: "tarjeta", items: [[producto("Coca Cola 2.25L"), 18, 3200]] },
        { d: 6, h: "10:15:00 a. m.", tipo: "local", cliente: "Carnicería El Gaucho", pago: "transferencia", items: [[producto("Vacío"), 6, 7600], [producto("Bife de chorizo"), 4, 8900]] },
        { d: 6, h: "16:45:00 p. m.", tipo: "reparto", cliente: "Rotisería El Pato", pago: "efectivo", items: [[producto("Pollo entero"), 20, 4200]] },
        { d: 7, h: "09:05:00 a. m.", tipo: "local", cliente: "Despensa La Rosa", pago: "efectivo", items: [[producto("Alitas"), 10, 1700], [producto("Pata muslo"), 6, 1900]] },
        { d: 7, h: "13:40:00 p. m.", tipo: "reparto", cliente: "Almacén La Union", pago: "cuenta_corriente", items: [[producto("Pollo entero"), 9, 4200], [producto("Medio pollo"), 8, 2300]] },
        { d: 8, h: "11:25:00 a. m.", tipo: "local", cliente: "Pollería San Pedro", pago: "tarjeta", items: [[producto("Pechuga"), 7, 5200]] },
        { d: 8, h: "18:00:00 p. m.", tipo: "reparto", cliente: "Almacén El Amigo", pago: "efectivo", items: [[producto("Papas fritas bolsa"), 25, 900], [producto("Agua mineral 2L"), 12, 1500]] },
        { d: 9, h: "09:50:00 a. m.", tipo: "local", cliente: "Rotisería Doña Rosa", pago: "transferencia", items: [[producto("Milanesa de pollo"), 12, 2800], [producto("Huevos x 30"), 5, 6800]] },
        { d: 10, h: "12:30:00 p. m.", tipo: "reparto", cliente: "Frigorífico La Plata", pago: "efectivo", items: [[producto("Bife de chorizo"), 12, 8900], [producto("Vacío"), 8, 7600]] },
        { d: 11, h: "16:20:00 p. m.", tipo: "local", cliente: "Kiosco El Barrio", pago: "dividido", items: [[producto("Coca Cola 2.25L"), 12, 3200], [producto("Papas fritas bolsa"), 15, 900]] },
      ];

      for (let i = 0; i < ventasPlan.length; i++) {
        const v = ventasPlan[i];
        const { fecha, hora } = horaPara(v.d, v.h);
        const cli = cliente(v.cliente) || clientePorZona("Centro");
        let subtotal = 0;
        const items = v.items.filter(([p]) => p);
        const total = items.reduce((sum, [p, cant, precio]) => sum + cant * precio, 0);

        let proveedorId = null;
        const primerProducto = items[0]?.[0];
        if (primerProducto) {
          const marca = marcas.find((mc) => mc.id === primerProducto.marcaId);
          if (marca) proveedorId = marca.proveedorId;
        }

        const pagoDividido = v.pago === "dividido";
        const medioPago = pagoDividido ? "efectivo" : v.pago;
        const venta = await Venta.create({
          numero_comprobante: `V-${String(i + 1).padStart(4, "0")}`,
          fecha,
          hora,
          tipo_venta: v.tipo,
          cliente_nombre: cli.nombre,
          cliente_direccion: `Zona ${cli.zona}`,
          cliente_telefono: `351-555-${String(1000 + i).slice(-4)}`,
          medio_pago: medioPago,
          pago_dividido: pagoDividido,
          subtotal,
          total,
          notas: "",
          clienteId: cli.id,
          salidaCamionId: null,
          estado: "completada",
          usuarioId: v.tipo === "reparto" && repartidores.length ? repartidores[i % repartidores.length].id : admin.id,
          proveedorId,
          porcentaje_aumento: 0,
        });

        for (const [p, cant, precio] of items) {
          await VentaItem.create({ cantidad: cant, precio_unitario: precio, ventaId: venta.id, productoId: p.id });
          if (v.tipo === "local") {
            await p.update({ stock: Math.max(0, p.stock - cant) });
          }
        }

        if (pagoDividido) {
          const mitad = total / 2;
          await VentaPago.create({ ventaId: venta.id, medio_pago: "efectivo", monto: Math.round(mitad * 100) / 100 });
          await VentaPago.create({ ventaId: venta.id, medio_pago: "transferencia", monto: total - Math.round(mitad * 100) / 100 });
        } else {
          await VentaPago.create({ ventaId: venta.id, medio_pago: v.pago, monto: total });
        }

        if (v.pago === "cuenta_corriente" && cli) {
          await cli.update({ saldo_pendiente: (parseFloat(cli.saldo_pendiente) + total).toFixed(2) });
        }
      }
      console.log(`Ventas creadas: ${ventasPlan.length}`);
    } else {
      console.log(`Ventas ya existentes: ${ventaExistente}, se omiten`);
    }

    const repartoExistente = await Reparto.count();
    if (repartoExistente === 0) {
      const repartosPlan = [
        { d: 0, h: "08:00:00 a. m.", cliente: "Panadería El Trigo", zona: "Centro", estado: "entregado", items: [[producto("Pollo entero"), 6, 4200]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 0, h: "08:45:00 a. m.", cliente: "Rotisería La Nonna", zona: "Norte", estado: "en_camino", items: [[producto("Pollo entero"), 8, 4200], [producto("Medio pollo"), 4, 2300]], repartidor: repartidores[1]?.nombre || "Santiago" },
        { d: 0, h: "09:30:00 a. m.", cliente: "Supermercado Norte Sur", zona: "Norte", estado: "pendiente", items: [[producto("Coca Cola 2.25L"), 10, 3200]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 0, h: "10:15:00 a. m.", cliente: "Almacén La Estrella", zona: "Sur", estado: "en_camino", items: [[producto("Milanesa de pollo"), 8, 2800]], repartidor: repartidores[1]?.nombre || "Santiago" },
        { d: 0, h: "11:00:00 a. m.", cliente: "Pollería La Criolla", zona: "Este", estado: "pendiente", items: [[producto("Pollo entero"), 12, 4200]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 1, h: "08:30:00 a. m.", cliente: "Almacén El Progreso", zona: "Sur", estado: "entregado", items: [[producto("Pechuga"), 5, 5200]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 1, h: "09:10:00 a. m.", cliente: "Verdulería Del Este", zona: "Este", estado: "entregado", items: [[producto("Huevos x 30"), 4, 6800]], repartidor: repartidores[1]?.nombre || "Santiago" },
        { d: 2, h: "08:00:00 a. m.", cliente: "Supermercado La Frontera", zona: "Este", estado: "entregado", items: [[producto("Pollo entero"), 10, 4200]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 2, h: "10:00:00 a. m.", cliente: "Almacén La Esperanza", zona: "Oeste", estado: "cancelado", items: [[producto("Papas fritas bolsa"), 20, 900]], repartidor: repartidores[1]?.nombre || "Santiago" },
        { d: 3, h: "09:00:00 a. m.", cliente: "Despensa La Villa", zona: "Sur", estado: "entregado", items: [[producto("Milanesa de pollo"), 10, 2800]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 4, h: "08:45:00 a. m.", cliente: "Carnicería El Gaucho", zona: "Oeste", estado: "entregado", items: [[producto("Vacío"), 6, 7600]], repartidor: repartidores[1]?.nombre || "Santiago" },
        { d: 5, h: "09:30:00 a. m.", cliente: "Pollería San Pedro", zona: "Suroeste", estado: "entregado", items: [[producto("Pollo entero"), 9, 4200]], repartidor: repartidores[0]?.nombre || "Agustin" },
        { d: 6, h: "08:00:00 a. m.", cliente: "Almacén La Union", zona: "Noreste", estado: "entregado", items: [[producto("Pollo entero"), 7, 4200], [producto("Medio pollo"), 6, 2300]], repartidor: repartidores[1]?.nombre || "Santiago" },
        { d: 7, h: "09:00:00 a. m.", cliente: "Frigorífico La Plata", zona: "Suroeste", estado: "entregado", items: [[producto("Bife de chorizo"), 8, 8900]], repartidor: repartidores[0]?.nombre || "Agustin" },
      ];

      for (let i = 0; i < repartosPlan.length; i++) {
        const r = repartosPlan[i];
        const { fecha, hora } = horaPara(r.d, r.h);
        const cli = cliente(r.cliente);
        const items = r.items.filter(([p]) => p);
        const precioTotal = items.reduce((sum, [p, cant, precio]) => sum + cant * precio, 0);
        const reparto = await Reparto.create({
          fecha,
          cliente_nombre: cli?.nombre || r.cliente,
          cliente_direccion: cli ? `Zona ${cli.zona}` : null,
          cliente_telefono: null,
          cantidad: items.reduce((sum, [, cant]) => sum + cant, 0),
          precio_total: precioTotal,
          estado: r.estado,
          notas: "",
          repartidor: r.repartidor,
          userId: repartidores[i % repartidores.length]?.id || admin.id,
        });
        for (const [p, cant, precio] of items) {
          await RepartoItem.create({ cantidad: cant, precio_unitario: precio, repartoId: reparto.id, productoId: p.id });
        }
      }
      console.log(`Repartos creados: ${repartosPlan.length}`);
    } else {
      console.log(`Repartos ya existentes: ${repartoExistente}, se omiten`);
    }

    const salidaExistente = await SalidaCamion.count();
    if (salidaExistente === 0) {
      const salidasPlan = [
        { d: 0, cliente: "Rotisería La Nonna", zona: "Norte", camion: "ABC-123", estado: "entregado", montoSalida: 120000, montoRegreso: 25000, items: [[producto("Pollo entero"), 20, 4200], [producto("Medio pollo"), 10, 2300]] },
        { d: 0, cliente: "Supermercado Norte Sur", zona: "Norte", camion: "DEF-456", estado: "en_camino", montoSalida: 90000, montoRegreso: 0, items: [[producto("Coca Cola 2.25L"), 15, 3200], [producto("Agua mineral 2L"), 12, 1500]] },
        { d: 0, cliente: "Almacén La Estrella", zona: "Sur", camion: "GHI-789", estado: "en_camino", montoSalida: 60000, montoRegreso: 0, items: [[producto("Milanesa de pollo"), 12, 2800]] },
        { d: 0, cliente: "Pollería La Criolla", zona: "Este", camion: "JKL-012", estado: "pendiente", montoSalida: 0, montoRegreso: 0, items: [[producto("Pollo entero"), 25, 4200]] },
        { d: 1, cliente: "Supermercado La Frontera", zona: "Este", camion: "ABC-123", estado: "entregado", montoSalida: 110000, montoRegreso: 15000, items: [[producto("Pollo entero"), 16, 4200], [producto("Pechuga"), 6, 5200]] },
        { d: 2, cliente: "Almacén La Esperanza", zona: "Oeste", camion: "DEF-456", estado: "cancelado", montoSalida: 0, montoRegreso: 0, items: [[producto("Papas fritas bolsa"), 30, 900]] },
        { d: 3, cliente: "Despensa La Villa", zona: "Sur", camion: "GHI-789", estado: "entregado", montoSalida: 70000, montoRegreso: 8000, items: [[producto("Milanesa de pollo"), 14, 2800], [producto("Pata muslo"), 8, 1900]] },
        { d: 4, cliente: "Carnicería El Gaucho", zona: "Oeste", camion: "ABC-123", estado: "entregado", montoSalida: 150000, montoRegreso: 30000, items: [[producto("Bife de chorizo"), 10, 8900], [producto("Vacío"), 8, 7600]] },
        { d: 5, cliente: "Pollería San Pedro", zona: "Suroeste", camion: "DEF-456", estado: "entregado", montoSalida: 95000, montoRegreso: 12000, items: [[producto("Pollo entero"), 18, 4200]] },
        { d: 6, cliente: "Almacén La Union", zona: "Noreste", camion: "GHI-789", estado: "sobrante", montoSalida: 80000, montoRegreso: 5000, items: [[producto("Pollo entero"), 12, 4200], [producto("Medio pollo"), 8, 2300]] },
      ];

      for (let i = 0; i < salidasPlan.length; i++) {
        const s = salidasPlan[i];
        const { fecha } = horaPara(s.d, "08:00:00 a. m.");
        const cli = cliente(s.cliente);
        const items = s.items.filter(([p]) => p);
        const precioTotal = items.reduce((sum, [p, cant, precio]) => sum + cant * precio, 0);
        const salida = await SalidaCamion.create({
          fecha,
          camion: s.camion,
          destino: cli ? cli.zona : s.zona,
          cliente_nombre: cli?.nombre || s.cliente,
          cliente_direccion: cli ? `Zona ${cli.zona}` : null,
          cliente_telefono: null,
          precio_total: precioTotal,
          estado: s.estado,
          monto_salida: s.montoSalida,
          monto_regreso: s.montoRegreso,
          notas: "",
          clienteId: cli?.id || null,
          asignadoRepartidorId: repartidores[i % repartidores.length]?.id || null,
          creadoPorId: admin.id,
        });
        for (const [p, cant, precio] of items) {
          const cantidadDevuelta = s.estado === "entregado" ? Math.floor(cant / 8) : 0;
          await SalidaCamionItem.create({
            cantidad: cant,
            cantidad_devuelta: cantidadDevuelta,
            precio_unitario: precio,
            salidaCamionId: salida.id,
            productoId: p.id,
          });
        }
      }
      console.log(`Salidas de camión creadas: ${salidasPlan.length}`);
    } else {
      console.log(`Salidas de camión ya existentes: ${salidaExistente}, se omiten`);
    }

    const produccionExistente = await Produccion.count();
    if (produccionExistente === 0) {
      const producciones = [
        { d: 0, cajones: 12, alitas: 18.5, pechugas: 22.0, pata_muslo: 30.5, menudos: 8.0 },
        { d: 1, cajones: 10, alitas: 15.0, pechugas: 20.0, pata_muslo: 28.0, menudos: 7.0 },
        { d: 2, cajones: 11, alitas: 16.5, pechugas: 21.5, pata_muslo: 29.0, menudos: 7.5 },
        { d: 3, cajones: 13, alitas: 20.0, pechugas: 24.0, pata_muslo: 32.0, menudos: 9.0 },
        { d: 4, cajones: 9, alitas: 14.0, pechugas: 19.0, pata_muslo: 26.0, menudos: 6.5 },
        { d: 5, cajones: 12, alitas: 18.0, pechugas: 22.5, pata_muslo: 31.0, menudos: 8.5 },
        { d: 6, cajones: 14, alitas: 21.0, pechugas: 25.0, pata_muslo: 33.0, menudos: 10.0 },
        { d: 7, cajones: 11, alitas: 17.0, pechugas: 21.0, pata_muslo: 29.5, menudos: 7.5 },
      ];
      for (const p of producciones) {
        const { fecha } = diasAtras(p.d);
        await Produccion.create({ fecha, ...p });
      }
      console.log(`Producción creada: ${producciones.length} registros`);
    } else {
      console.log(`Producción ya existente: ${produccionExistente}, se omiten`);
    }

    const cierreExistente = await CierreCaja.count();
    if (cierreExistente === 0) {
      const cierres = [
        { d: 0, h: "19:30:00 p. m.", totalVentas: 187500, salidasCount: 4, mercaderiaEnviada: 270000, mercaderiaDevuelta: 25000, ventasNetas: 162500, usuario: "Ariel" },
        { d: 1, h: "19:45:00 p. m.", totalVentas: 165000, salidasCount: 3, mercaderiaEnviada: 240000, mercaderiaDevuelta: 30000, ventasNetas: 135000, usuario: "Ariel" },
        { d: 2, h: "20:00:00 p. m.", totalVentas: 142000, salidasCount: 3, mercaderiaEnviada: 210000, mercaderiaDevuelta: 22000, ventasNetas: 120000, usuario: "Agustin" },
        { d: 3, h: "19:15:00 p. m.", totalVentas: 178000, salidasCount: 4, mercaderiaEnviada: 260000, mercaderiaDevuelta: 18000, ventasNetas: 160000, usuario: "Santiago" },
        { d: 4, h: "20:10:00 p. m.", totalVentas: 159000, salidasCount: 3, mercaderiaEnviada: 230000, mercaderiaDevuelta: 20000, ventasNetas: 139000, usuario: "Ariel" },
        { d: 5, h: "19:40:00 p. m.", totalVentas: 171000, salidasCount: 4, mercaderiaEnviada: 250000, mercaderiaDevuelta: 28000, ventasNetas: 143000, usuario: "Agustin" },
      ];
      for (const c of cierres) {
        const { fecha } = diasAtras(c.d);
        await CierreCaja.create({
          fecha,
          hora: c.h,
          total_ventas: c.totalVentas,
          salidas_count: c.salidasCount,
          mercaderia_enviada: c.mercaderiaEnviada,
          mercaderia_devuelta: c.mercaderiaDevuelta,
          ventas_netas: c.ventasNetas,
          usuario_cierre: c.usuario,
        });
      }
      console.log(`Cierres de caja creados: ${cierres.length}`);
    } else {
      console.log(`Cierres de caja ya existentes: ${cierreExistente}, se omiten`);
    }

    const clientepagoExistente = await ClientePago.count();
    if (clientepagoExistente === 0) {
      const pagos = [
        { d: 1, cliente: "Almacén Central", monto: 30000, medio: "transferencia", h: "10:30:00 a. m." },
        { d: 1, cliente: "Supermercado El Sol", monto: 50000, medio: "efectivo", h: "11:00:00 a. m." },
        { d: 2, cliente: "Almacén La Esperanza", monto: 25000, medio: "transferencia", h: "09:20:00 a. m." },
        { d: 3, cliente: "Frigorífico San Cayetano", monto: 40000, medio: "efectivo", h: "16:00:00 p. m." },
        { d: 4, cliente: "Almacén La Union", monto: 60000, medio: "transferencia", h: "12:00:00 p. m." },
        { d: 5, cliente: "Almacén El Progreso", monto: 35000, medio: "efectivo", h: "15:30:00 p. m." },
        { d: 6, cliente: "Carnicería El Gaucho", monto: 20000, medio: "transferencia", h: "10:45:00 a. m." },
        { d: 7, cliente: "Despensa La Villa", monto: 15000, medio: "efectivo", h: "17:00:00 p. m." },
      ];
      for (const p of pagos) {
        const cli = cliente(p.cliente);
        if (!cli) continue;
        const { fecha } = diasAtras(p.d);
        await ClientePago.create({
          clienteId: cli.id,
          monto: p.monto,
          medio_pago: p.medio,
          fecha,
          hora: p.h,
          notas: "",
        });
        await cli.update({ saldo_pendiente: Math.max(0, parseFloat(cli.saldo_pendiente) - p.monto).toFixed(2) });
      }
      console.log(`Pagos de clientes creados: ${pagos.length}`);
    } else {
      console.log(`Pagos de clientes ya existentes: ${clientepagoExistente}, se omiten`);
    }

    console.log("\n--- Resumen de carga ---");
    console.log(`Clientes: ${await Cliente.count()}`);
    console.log(`Ventas: ${await Venta.count()}`);
    console.log(`Repartos: ${await Reparto.count()}`);
    console.log(`Salidas de camión: ${await SalidaCamion.count()}`);
    console.log(`Producción: ${await Produccion.count()}`);
    console.log(`Cierres de caja: ${await CierreCaja.count()}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error("Error en seed de datos", { error: error.stack || error.message });
    await sequelize.close();
    process.exit(1);
  }
};

seedData();
