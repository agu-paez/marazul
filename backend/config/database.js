import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const dialect = process.env.DB_DIALECT || "sqlite";
if (dialect === "mysql" && (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_HOST)) {
  throw new Error("Faltan DB_NAME, DB_USER o DB_HOST para la conexión MySQL");
}
const baseOptions = {
  dialect,
  logging: false,
  define: { timestamps: true },
};

const sequelize = dialect === "mysql"
  ? new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...baseOptions,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      }
    )
  : new Sequelize({
      ...baseOptions,
      storage: path.join(__dirname, "..", "database.sqlite"),
    });

export default sequelize;
