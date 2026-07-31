import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

try {
  await sequelize.query("ALTER TABLE Venta ADD COLUMN proveedorId INTEGER REFERENCES Proveedors(id)");
  console.log('Columna proveedorId agregada a Venta correctamente');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('La columna proveedorId ya existe');
  } else {
    console.error('Error:', e.message);
  }
}

try {
  await sequelize.query("ALTER TABLE Proveedors ADD COLUMN alias VARCHAR(255)");
  console.log('Columna alias agregada a Proveedors correctamente');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('La columna alias ya existe');
  } else {
    console.error('Error:', e.message);
  }
}

try {
  await sequelize.query("ALTER TABLE Productos ADD COLUMN codigo_barras VARCHAR(255) UNIQUE");
  console.log('Columna codigo_barras agregada correctamente');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('La columna codigo_barras ya existe');
  } else {
    console.error('Error:', e.message);
  }
}

try {
  await sequelize.query("ALTER TABLE SalidaCamionItems ADD COLUMN cantidad_devuelta INTEGER NOT NULL DEFAULT 0");
  console.log('Columna cantidad_devuelta agregada correctamente');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('La columna ya existe');
  } else {
    console.error('Error:', e.message);
  }
}
await sequelize.close();
