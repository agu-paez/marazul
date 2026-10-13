import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

// Registro de una peticion logica de escritura. La clave la envia el cliente y
// es unica por operacion: si llega dos veces la misma clave, la segunda se
// detecta y se devuelve el resultado original sin volver a aplicar el delta.
const OperacionIdempotente = sequelize.define(
  "OperacionIdempotente",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    clave: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: "Idempotency-Key enviada por el cliente",
    },
    operacion: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Endpoint logico, por ejemplo modificar_saldos_venta",
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "en_proceso",
      comment: "en_proceso o completada",
    },
    resultado: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Respuesta original serializada, para replay identico",
    },
  },
  { updatedAt: false }
);

export default OperacionIdempotente;