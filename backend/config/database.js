import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT } = process.env;
if (!DB_NAME || !DB_USER || !DB_HOST) {
  throw new Error("Faltan DB_NAME, DB_USER o DB_HOST para la conexión MySQL");
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  dialect: "mysql",
  host: DB_HOST,
  port: Number(DB_PORT || 3306),
  logging: false,
  define: { timestamps: true },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

export default sequelize;
