import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import sequelize from "./config/database.js";
import "./models/index.js";
import { Banco, User, Role } from "./models/index.js";

import authRoutes from "./routes/authRoutes.js";
import proveedorRoutes from "./routes/proveedorRoutes.js";
import marcaRoutes from "./routes/marcaRoutes.js";
import productoRoutes from "./routes/productoRoutes.js";
import repartoRoutes from "./routes/repartoRoutes.js";
import salidaCamionRoutes from "./routes/salidaCamionRoutes.js";
import cierreCajaRoutes from "./routes/cierreCajaRoutes.js";
import ventaRoutes from "./routes/ventaRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import clienteRoutes from "./routes/clienteRoutes.js";
import bancoRoutes from "./routes/bancoRoutes.js";
import produccionRoutes from "./routes/produccionRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/proveedores", proveedorRoutes);
app.use("/api/marcas", marcaRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/repartos", repartoRoutes);
app.use("/api/salidas-camion", salidaCamionRoutes);
app.use("/api/cierre-caja", cierreCajaRoutes);
app.use("/api/ventas", ventaRoutes);
app.use("/api/usuarios", userRoutes);
app.use("/api/clientes", clienteRoutes);
app.use("/api/bancos", bancoRoutes);
app.use("/api/produccion", produccionRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "Mar Azul API - Funcionando!" });
});

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Base de datos conectada");

    await sequelize.sync();
    console.log("Modelos sincronizados");

    const [cols] = await sequelize.query("PRAGMA table_info(Venta)");
    const hasSalidaCamionId = cols.some((c) => c.name === "salidaCamionId");
    if (!hasSalidaCamionId) {
      await sequelize.query("ALTER TABLE Venta ADD COLUMN salidaCamionId INTEGER REFERENCES SalidaCamions(id)");
      console.log("Columna salidaCamionId agregada a Venta");
    }
    const hasDatosTransferencia = cols.some((c) => c.name === "datos_transferencia");
    if (!hasDatosTransferencia) {
      await sequelize.query("ALTER TABLE Venta ADD COLUMN datos_transferencia TEXT");
      console.log("Columna datos_transferencia agregada a Venta");
    }
    const hasDatosTarjeta = cols.some((c) => c.name === "datos_tarjeta");
    if (!hasDatosTarjeta) {
      await sequelize.query("ALTER TABLE Venta ADD COLUMN datos_tarjeta TEXT");
      console.log("Columna datos_tarjeta agregada a Venta");
    }
    const hasMontoDeudaPagado = cols.some((c) => c.name === "monto_deuda_pagado");
    if (!hasMontoDeudaPagado) {
      await sequelize.query("ALTER TABLE Venta ADD COLUMN monto_deuda_pagado DECIMAL(10,2)");
      console.log("Columna monto_deuda_pagado agregada a Venta");
    }
    const hasPorcentajeAumento = cols.some((c) => c.name === "porcentaje_aumento");
    if (!hasPorcentajeAumento) {
      await sequelize.query("ALTER TABLE Venta ADD COLUMN porcentaje_aumento DECIMAL(5,2) DEFAULT 0");
      console.log("Columna porcentaje_aumento agregada a Venta");
    }

    const [productoCols] = await sequelize.query("PRAGMA table_info(Productos)");
    const hasMarcaId = productoCols.some((c) => c.name === "marcaId");
    if (!hasMarcaId) {
      await sequelize.query("ALTER TABLE Productos ADD COLUMN marcaId INTEGER REFERENCES Marcas(id)");
      console.log("Columna marcaId agregada a Productos");
    }

    const [proveedorCols] = await sequelize.query("PRAGMA table_info(Proveedors)");
    const hasMercaderias = proveedorCols.some((c) => c.name === "mercaderias_compradas");
    if (!hasMercaderias) {
      await sequelize.query("ALTER TABLE Proveedors ADD COLUMN mercaderias_compradas FLOAT DEFAULT 0");
      console.log("Columna mercaderias_compradas agregada a Proveedors");
    }
    const hasDineroVentas = proveedorCols.some((c) => c.name === "dinero_ventas");
    if (!hasDineroVentas) {
      await sequelize.query("ALTER TABLE Proveedors ADD COLUMN dinero_ventas FLOAT DEFAULT 0");
      console.log("Columna dinero_ventas agregada a Proveedors");
    }
    const hasDiferenciaAcumulada = proveedorCols.some((c) => c.name === "diferencia_acumulada");
    if (!hasDiferenciaAcumulada) {
      await sequelize.query("ALTER TABLE Proveedors ADD COLUMN diferencia_acumulada FLOAT DEFAULT 0");
      console.log("Columna diferencia_acumulada agregada a Proveedors");
    }

    const bancosDefault = ["Banco Nación", "Banco Provincia", "Banco Galicia", "Banco Santander", "Banco BBVA", "Banco Macro", "Banco Ciudad", "Banco Patagonia", "Banco Supervielle", "Banco Hipotecario"];
    for (const nombre of bancosDefault) {
      await Banco.findOrCreate({ where: { nombre }, defaults: { nombre } });
    }
    console.log("Bancos por defecto verificados");

    const roles = ["admin", "operador", "repartidor"];
    for (const nombre of roles) {
      await Role.findOrCreate({ where: { nombre }, defaults: { nombre } });
    }
    console.log("Roles verificados");

    const adminRole = await Role.findOne({ where: { nombre: "admin" } });
    const repartidorRole = await Role.findOne({ where: { nombre: "repartidor" } });

    const usuariosDefault = [
      { nombre: "Ariel", password: "ariel123", roleId: adminRole.id },
      { nombre: "Agustin", password: "agustin123", roleId: repartidorRole.id },
      { nombre: "Santiago", password: "santiago123", roleId: repartidorRole.id },
    ];

    for (const usuario of usuariosDefault) {
      const [user, created] = await User.findOrCreate({
        where: { nombre: usuario.nombre },
        defaults: usuario,
      });
      if (created) {
        console.log(`Usuario "${usuario.nombre}" creado`);
      }
    }
    console.log("Usuarios por defecto verificados");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("Error al iniciar servidor:", error);
    process.exit(1);
  }
};

start();
