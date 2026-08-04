import sequelize from "../config/database.js";
import { Role, User, Proveedor, Producto } from "../models/index.js";
import logger from "../utils/logger.js";

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log("Conectado a la base de datos");

    await sequelize.sync({ force: true });
    console.log("Base de datos sincronizada");

    const roles = await Role.bulkCreate([
      { nombre: "admin", descripcion: "Administrador del sistema" },
      { nombre: "operador", descripcion: "Operador de repartos" },
      { nombre: "repartidor", descripcion: "Repartidor" },
    ]);
    console.log("Roles creados");

    await User.create({ nombre: "Admin Pollos", email: "admin@lospollos.com", password: "admin123", roleId: roles[0].id });
    await User.create({ nombre: "Carlos Operador", email: "carlos@lospollos.com", password: "operador123", roleId: roles[1].id });
    await User.create({ nombre: "Miguel Repartidor", email: "miguel@lospollos.com", password: "repartidor123", roleId: roles[2].id });
    console.log("Usuarios creados");

    const prov1 = await Proveedor.create({ nombre: "Avícola El Rancho", telefono: "555-0101", direccion: "Camino Viejo km 12", email: "rancho@email.com", tipo_producto: "pollos" });
    const prov2 = await Proveedor.create({ nombre: "Bebidas Don Pepe", telefono: "555-0202", direccion: "Av. Central 456", email: "donpepe@email.com", tipo_producto: "bebidas" });
    const prov3 = await Proveedor.create({ nombre: "Abarrotes La Esquina", telefono: "555-0303", direccion: "Calle 5 #789", email: "esquina@email.com", tipo_producto: "miscelaneos" });
    console.log("Proveedores creados");

    await Producto.create({ nombre: "Pollo entero", descripcion: "Pollo entero asado", precio: 120.00, stock: 50, unidad: "pieza", proveedorId: prov1.id });
    await Producto.create({ nombre: "Pollo medio", descripcion: "Medio pollo asado", precio: 65.00, stock: 80, unidad: "pieza", proveedorId: prov1.id });
    await Producto.create({ nombre: "Pierna de pollo", descripcion: "Pierna BBQ", precio: 45.00, stock: 100, unidad: "pieza", proveedorId: prov1.id });
    await Producto.create({ nombre: "Pechuga de pollo", descripcion: "Pechuga a la plancha", precio: 55.00, stock: 60, unidad: "pieza", proveedorId: prov1.id });
    await Producto.create({ nombre: "Coca-Cola 600ml", descripcion: "Coca-Cola botella", precio: 18.00, stock: 200, unidad: "pieza", proveedorId: prov2.id });
    await Producto.create({ nombre: "Agua 1L", descripcion: "Agua purificada", precio: 12.00, stock: 300, unidad: "pieza", proveedorId: prov2.id });
    await Producto.create({ nombre: "Papas fritas", descripcion: "Bolsa de papas", precio: 25.00, stock: 150, unidad: "bolsa", proveedorId: prov3.id });
    await Producto.create({ nombre: "Tortillas 1kg", descripcion: "Tortillas de maíz", precio: 22.00, stock: 100, unidad: "kilogramo", proveedorId: prov3.id });
    console.log("Productos creados");

    console.log("\n--- Usuarios ---");
    console.log("  admin@lospollos.com / admin123");
    console.log("  carlos@lospollos.com / operador123");
    console.log("  miguel@lospollos.com / repartidor123");

    process.exit(0);
  } catch (error) {
    logger.error("Error en seed", { error: error.stack || error.message });
    process.exit(1);
  }
};

seed();
