import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import winston from "winston";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../logs");
fs.mkdirSync(directory, { recursive: true });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(directory, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(directory, "combined.log") }),
  ],
});

// En produccion tambien se loguea a consola: los hosts (Hostinger) muestran
// ese stream en el activity log de la aplicacion.
logger.add(new winston.transports.Console({ format: winston.format.simple() }));

export default logger;
