import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Dispositivo = sequelize.define(
  "Dispositivo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Nombre visible de la tablet (ej: Tablet Camión 1)",
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Detalle opcional (patente, repartidor, etc.)",
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: "Token único que usa la app Android para autenticarse",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    precision: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Precisión del GPS en metros",
    },
    velocidad: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Velocidad en m/s",
    },
    direccion: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Rumbo en grados (0-360)",
    },
    bateria: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Nivel de batería 0-100",
    },
    proveedor: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Origen de la ubicación: gps / network",
    },
    ultima_conexion: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Fecha y hora del último reporte recibido",
    },
  },
  {
    indexes: [{ unique: true, fields: ["token"] }],
  }
);

export default Dispositivo;
