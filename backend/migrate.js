import sequelize from './config/database.js';
import logger from './utils/logger.js';
import './models/index.js';

await sequelize.authenticate();
await sequelize.sync();
console.log('Base de datos conectada y tablas verificadas');
await sequelize.query("UPDATE Clientes SET zona = 'Mayorista' WHERE zona = 'Zona 7'");
await sequelize.query("UPDATE SalidaCamions SET destino = 'Mayorista' WHERE destino = 'Zona 7'");

for (const [tabla, columna, definicion] of [
  ['VentaItems', 'cantidad', 'DECIMAL(13,2) NOT NULL DEFAULT 1'],
  ['SalidaCamionItems', 'cantidad', 'DECIMAL(13,2) NOT NULL DEFAULT 1'],
  ['SalidaCamionItems', 'cantidad_devuelta', 'DECIMAL(13,2) NOT NULL DEFAULT 0'],
]) {
  try {
    await sequelize.query(`ALTER TABLE ${tabla} MODIFY COLUMN ${columna} ${definicion}`);
    console.log(`Columna ${columna} convertida a decimal en ${tabla}`);
  } catch (e) {
    logger.error('Error convirtiendo columna decimal', { tabla, columna, error: e.stack || e.message });
  }
}

try {
  await sequelize.query("ALTER TABLE Venta ADD COLUMN proveedorId INTEGER REFERENCES Proveedors(id)");
  console.log('Columna proveedorId agregada a Venta correctamente');
} catch (e) {
  if (e.message.includes("duplicate column") || e.message.toLowerCase().includes("duplicate column name")) {
    console.log('La columna proveedorId ya existe');
  } else {
    logger.error('Error en migración', { error: e.stack || e.message });
  }
}

try {
  await sequelize.query("ALTER TABLE Proveedors ADD COLUMN alias VARCHAR(255)");
  console.log('Columna alias agregada a Proveedors correctamente');
} catch (e) {
  if (e.message.includes("duplicate column") || e.message.toLowerCase().includes("duplicate column name")) {
    console.log('La columna alias ya existe');
  } else {
    logger.error('Error en migración', { error: e.stack || e.message });
  }
}

try {
  await sequelize.query("ALTER TABLE Productos ADD COLUMN codigo_barras VARCHAR(255) UNIQUE");
  console.log('Columna codigo_barras agregada correctamente');
} catch (e) {
  if (e.message.includes("duplicate column") || e.message.toLowerCase().includes("duplicate column name")) {
    console.log('La columna codigo_barras ya existe');
  } else {
    logger.error('Error en migración', { error: e.stack || e.message });
  }
}

try {
  await sequelize.query("ALTER TABLE SalidaCamionItems ADD COLUMN cantidad_devuelta INTEGER NOT NULL DEFAULT 0");
  console.log('Columna cantidad_devuelta agregada correctamente');
} catch (e) {
  if (e.message.includes("duplicate column") || e.message.toLowerCase().includes("duplicate column name")) {
    console.log('La columna ya existe');
  } else {
    logger.error('Error en migración', { error: e.stack || e.message });
  }
}

const nuevasColumnasProductos = [
  ['kg_por_caja', 'DECIMAL(13,2)'],
  ['excluir_de_lista_pdf', 'BOOLEAN NOT NULL DEFAULT 0'],
  ['descuento_mayorista', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
  ['descuento_nuevo', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
  ['permitir_modificar_precio', 'BOOLEAN NOT NULL DEFAULT 0'],
];
for (const [columna, tipo] of nuevasColumnasProductos) {
  try {
    await sequelize.query(`ALTER TABLE Productos ADD COLUMN ${columna} ${tipo}`);
    console.log(`Columna ${columna} agregada a Productos correctamente`);
  } catch (e) {
    if (e.message.includes("duplicate column") || e.message.toLowerCase().includes("duplicate column name")) {
      console.log(`La columna ${columna} ya existe`);
    } else {
      console.error('Error:', e.message);
    }
  }
}

try {
  await sequelize.query("ALTER TABLE Clientes ADD COLUMN tipo_descuento VARCHAR(20) NOT NULL DEFAULT 'producto'");
  console.log('Columna tipo_descuento agregada a Clientes correctamente');
} catch (e) {
  if (!e.message.includes('duplicate column') && !e.message.toLowerCase().includes('duplicate column name')) console.error('Error:', e.message);
}

const nuevasColumnasVentaItems = [];
for (const [columna, tipo] of nuevasColumnasVentaItems) {
  try {
    await sequelize.query(`ALTER TABLE VentaItems ADD COLUMN ${columna} ${tipo}`);
    console.log(`Columna ${columna} agregada a VentaItems correctamente`);
  } catch (e) {
    if (!e.message.includes('duplicate column') && !e.message.toLowerCase().includes('duplicate column name')) console.error('Error:', e.message);
  }
}

const nuevasColumnasVentas = [
  ['datos_otro', 'TEXT'],
  ['pago_modificado_por_id', 'INTEGER'],
  ['pago_modificado_en', 'DATETIME'],
  ['pago_modificacion_detalle', 'TEXT'],
  ['productos_modificado_por_id', 'INTEGER'],
  ['productos_modificado_en', 'DATETIME'],
  ['productos_modificacion_detalle', 'TEXT'],
];
for (const [columna, tipo] of nuevasColumnasVentas) {
  try {
    await sequelize.query(`ALTER TABLE Ventas ADD COLUMN ${columna} ${tipo}`);
    console.log(`Columna ${columna} agregada a Ventas correctamente`);
  } catch (e) {
    if (!e.message.includes('duplicate column') && !e.message.toLowerCase().includes('duplicate column name')) console.error('Error:', e.message);
  }
}

const nuevasColumnasSalidaItems = [
];
for (const [columna, tipo] of nuevasColumnasSalidaItems) {
  try {
    await sequelize.query(`ALTER TABLE SalidaCamionItems ADD COLUMN ${columna} ${tipo}`);
    console.log(`Columna ${columna} agregada a SalidaCamionItems correctamente`);
  } catch (e) {
    if (!e.message.includes('duplicate column') && !e.message.toLowerCase().includes('duplicate column name')) console.error('Error:', e.message);
  }
}

const columnasAEliminar = [
  ['Productos', 'precio_por_kg'],
  ['Productos', 'precio_caja'],
  ['Productos', 'unidades_por_caja'],
  ['Productos', 'prod_sueltos'],
  ['VentaItems', 'unidad_venta'],
  ['VentaItems', 'unidades_por_caja'],
  ['VentaItems', 'cantidad_unidades'],
  ['SalidaCamionItems', 'unidades_por_caja'],
  ['SalidaCamionItems', 'cantidad_unidades'],
  ['SalidaCamionItems', 'cantidad_devuelta_unidades'],
];
for (const [tabla, columna] of columnasAEliminar) {
  try {
    await sequelize.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
    console.log(`Columna ${columna} eliminada de ${tabla} correctamente`);
  } catch (e) {
    if (e.message.includes('no such column') || e.message.toLowerCase().includes('unknown column')) {
      console.log(`La columna ${columna} no existe o ya fue eliminada`);
    } else {
      console.error('Error:', e.message);
    }
  }
}

const upgradeDecimal = [
  ['CierreCajas', ['total_ventas', 'mercaderia_enviada', 'mercaderia_devuelta', 'ventas_netas', 'gastos_combustible', 'gastos_otros']],
  ['Ventas', ['subtotal', 'total', 'monto_deuda_pagado', 'monto_sobrante']],
  ['SalidaCamions', ['precio_total', 'monto_salida', 'monto_regreso']],
  ['VentaItems', ['precio_unitario', 'costo_unitario']],
  ['SalidaCamionItems', ['precio_unitario']],
  ['Clientes', ['saldo_pendiente', 'saldo_favor', 'limite_credito']],
  ['VentaPagos', ['monto']],
  ['ClientePagos', ['monto']],
  ['PagoEmpleados', ['monto']],
  ['GastoDias', ['combustible', 'otros']],
  ['ProveedorMovimientoes', ['mercaderias_compradas', 'dinero_ventas', 'diferencia']],
  ['Repartos', ['precio_total']],
  ['RepartoItems', ['precio_unitario']],
  ['Productos', ['precio', 'costo', 'stock', 'kg_por_caja']],
];
for (const [tabla, columnas] of upgradeDecimal) {
  for (const columna of columnas) {
    try {
      await sequelize.query(`ALTER TABLE \`${tabla}\` MODIFY COLUMN \`${columna}\` DECIMAL(13,2) NOT NULL DEFAULT 0`);
      console.log(`Columna ${columna} de ${tabla} actualizada a DECIMAL(13,2)`);
    } catch (e) {
      if (!e.message.includes("Unknown column") && !e.message.toLowerCase().includes("doesn't exist")) {
        console.error(`Error actualizando ${tabla}.${columna}:`, e.message);
      }
    }
  }
}

await sequelize.close();
