import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { DataTypes } from "sequelize";
import { errorHandler, sanitizeErrorResponses } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";

import sequelize from "./config/database.js";
import "./models/index.js";
import { Banco, User, Role, Venta, Producto, Cliente, Proveedor } from "./models/index.js";

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
const isProduction = process.env.NODE_ENV === "production";
// Hostinger places the Node process behind a reverse proxy.
app.set("trust proxy", 1);
const trustedOrigins = (process.env.CORS_ORIGINS || [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
].join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isPrivateDevelopmentOrigin = (origin) => {
  try {
    const { protocol, hostname, port } = new URL(origin);
    const developmentPort = ["3000", "4173"].includes(port);
    const privateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
    return protocol === "http:" && developmentPort && privateIpv4;
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Requests without an Origin header (for example, health checks) are allowed.
    if (!origin || trustedOrigins.includes(origin) || (!isProduction && isPrivateDevelopmentOrigin(origin))) {
      return callback(null, true);
    }
    logger.warn("CORS origin rejected", { origin });
    return callback(new Error("Origen no permitido"));
  },
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_MAX) || (isProduction ? 100 : 1000),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intenta nuevamente más tarde." },
  skip: (req) => req.path === "/health",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isProduction ? 10 : 50),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Demasiados intentos. Intenta nuevamente más tarde." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use(sanitizeErrorResponses);

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

app.use(errorHandler);

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Base de datos conectada");

    await sequelize.sync();
    console.log("Modelos sincronizados");

    const queryInterface = sequelize.getQueryInterface();
    const ensureColumn = async (model, column, definition) => {
      const table = model.getTableName();
      const columns = await queryInterface.describeTable(table);
      if (!columns[column]) {
        await queryInterface.addColumn(table, column, definition);
        console.log(`Columna ${column} agregada a ${table}`);
      }
    };

    await ensureColumn(Venta, "salidaCamionId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "SalidaCamions", key: "id" },
    });
    await ensureColumn(Venta, "datos_transferencia", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Venta, "datos_tarjeta", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Venta, "monto_deuda_pagado", { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(Venta, "porcentaje_aumento", { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 });
    await ensureColumn(Producto, "marcaId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Marcas", key: "id" },
    });
    await ensureColumn(Cliente, "zona", { type: DataTypes.STRING, allowNull: true });
    await ensureColumn(Proveedor, "mercaderias_compradas", { type: DataTypes.FLOAT, defaultValue: 0 });
    await ensureColumn(Proveedor, "dinero_ventas", { type: DataTypes.FLOAT, defaultValue: 0 });
    await ensureColumn(Proveedor, "diferencia_acumulada", { type: DataTypes.FLOAT, defaultValue: 0 });

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
      const [, created] = await User.findOrCreate({
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
    logger.error("Error al iniciar servidor", { error: error.stack || error.message });
    process.exit(1);
  }
};

start();
