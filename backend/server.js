import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { Banco, User, Role, Venta, VentaItem, Producto, Cliente, ClientePago, Proveedor, CierreCaja, SalidaCamion, SalidaCamionItem } from "./models/index.js";

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
import gastoDiaRoutes from "./routes/gastoDiaRoutes.js";
import pagoEmpleadoRoutes from "./routes/pagoEmpleadoRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

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
  limit: Number(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intenta nuevamente más tarde." },
  skip: (req) => ["/health", "/auth/login", "/auth/register"].includes(req.path),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isProduction ? 50 : 200),
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
app.use("/api/gastos-dia", gastoDiaRoutes);
app.use("/api/pagos-empleados", pagoEmpleadoRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "Mar Azul API - Funcionando!" });
});

if (isProduction) {
  const distPath = path.join(__dirname, "..", "pollos_hermanos", "dist");
  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        // Hashed build assets never change: safe to cache forever.
        res.set("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.set("Cache-Control", "no-cache");
      }
    },
  }));
  // Missing static files (e.g. assets of a build not yet deployed) must return
  // 404 instead of the HTML shell, which causes MIME type module errors.
  app.get(/\.[a-zA-Z0-9]+$/, (req, res) => {
    res.status(404).json({ message: "Archivo no encontrado" });
  });
  // React Router needs the SPA entry point for direct visits and page reloads.
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use(errorHandler);

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Base de datos conectada");

    await sequelize.sync();
    console.log("Modelos sincronizados");
    await Cliente.update({ zona: "Mayorista" }, { where: { zona: "Zona 7" } });
    await SalidaCamion.update({ destino: "Mayorista" }, { where: { destino: "Zona 7" } });

    const queryInterface = sequelize.getQueryInterface();
    const ensureColumn = async (model, column, definition) => {
      const table = model.getTableName();
      const columns = await queryInterface.describeTable(table);
      if (!columns[column]) {
        await queryInterface.addColumn(table, column, definition);
        console.log(`Columna ${column} agregada a ${table}`);
      }
    };
    const ensureDecimalColumn = async (model, column, definition) => {
      const table = model.getTableName();
      const columns = await queryInterface.describeTable(table);
      if (columns[column] && /int/i.test(columns[column].type)) {
        await queryInterface.changeColumn(table, column, definition);
        console.log(`Columna ${column} convertida a decimal en ${table}`);
      }
    };

    await ensureColumn(Venta, "salidaCamionId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "SalidaCamions", key: "id" },
    });
    await ensureColumn(Venta, "datos_transferencia", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Venta, "datos_tarjeta", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Venta, "datos_otro", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Venta, "monto_deuda_pagado", { type: DataTypes.DECIMAL(10, 2), allowNull: true });
    await ensureColumn(Venta, "porcentaje_aumento", { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 });
    await ensureColumn(Venta, "pago_modificado_por_id", { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn(Venta, "pago_modificado_en", { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(Venta, "pago_modificacion_detalle", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Venta, "productos_modificado_por_id", { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn(Venta, "productos_modificado_en", { type: DataTypes.DATE, allowNull: true });
    await ensureColumn(Venta, "productos_modificacion_detalle", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(Producto, "marcaId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Marcas", key: "id" },
    });
    await ensureColumn(Cliente, "zona", { type: DataTypes.STRING, allowNull: true });
    await ensureColumn(Cliente, "tipo_descuento", { type: DataTypes.STRING, allowNull: false, defaultValue: "producto" });
    await ensureColumn(Cliente, "saldo_favor", { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 });
    await ensureColumn(Cliente, "pendiente_revision", { type: DataTypes.BOOLEAN, defaultValue: false });
    await ensureColumn(SalidaCamion, "autorizadoPorId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
    });
    await ensureColumn(Proveedor, "mercaderias_compradas", { type: DataTypes.FLOAT, defaultValue: 0 });
    await ensureColumn(Proveedor, "dinero_ventas", { type: DataTypes.FLOAT, defaultValue: 0 });
    await ensureColumn(Proveedor, "diferencia_acumulada", { type: DataTypes.FLOAT, defaultValue: 0 });
    await ensureColumn(Producto, "costo", { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 });
    await ensureColumn(Producto, "excluir_de_lista_pdf", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    await ensureColumn(Producto, "descuento", { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 });
    await ensureColumn(Producto, "descuento_mayorista", { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 });
    await ensureColumn(Producto, "descuento_nuevo", { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 });
    await ensureColumn(Producto, "permitir_modificar_precio", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    await ensureColumn(VentaItem, "costo_unitario", { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 });
    await ensureDecimalColumn(VentaItem, "cantidad", { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 });
    await ensureDecimalColumn(SalidaCamionItem, "cantidad", { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 });
    await ensureDecimalColumn(SalidaCamionItem, "cantidad_devuelta", { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 });
    await ensureColumn(Venta, "monto_sobrante", { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 });
    await ensureColumn(CierreCaja, "gastos_combustible", { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 });
    await ensureColumn(CierreCaja, "gastos_otros", { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 });
    await ensureColumn(CierreCaja, "descripcion_otros_gastos", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(CierreCaja, "pagos_empleados", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(ClientePago, "datos_transferencia", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(ClientePago, "datos_tarjeta", { type: DataTypes.TEXT, allowNull: true });
    await ensureColumn(ClientePago, "proveedorId", { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn(ClientePago, "titular", { type: DataTypes.STRING, allowNull: true });
    await ensureColumn(ClientePago, "banco", { type: DataTypes.STRING, allowNull: true });
    await ensureColumn(ClientePago, "fecha_pago", { type: DataTypes.DATEONLY, allowNull: true });

    const pagosClientes = await ClientePago.findAll({ where: { titular: null } });
    for (const pago of pagosClientes) {
      const datosTexto = pago.datos_transferencia || pago.datos_tarjeta;
      if (!datosTexto) continue;
      try {
        let datos = typeof datosTexto === "string" ? JSON.parse(datosTexto) : datosTexto;
        if (typeof datos === "string") datos = JSON.parse(datos);
        if (Array.isArray(datos)) datos = datos[0];
        if (datos && typeof datos === "object") {
          await pago.update({
            titular: datos.titular || datos.nombre_cuenta || datos.cuenta || null,
            banco: datos.banco || datos.nombre_banco || null,
            proveedorId: pago.proveedorId || datos.proveedorId || null,
          });
        }
      } catch {
        logger.warn(`No se pudieron migrar los datos bancarios del pago ${pago.id}`);
      }
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
