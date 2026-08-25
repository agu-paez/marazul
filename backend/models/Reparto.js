import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Reparto = sequelize.define("Reparto", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  cliente_nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cliente_direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cliente_telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  precio_total: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
  },
  estado: {
    type: DataTypes.STRING,
    defaultValue: "pendiente",
    validate: {
      isIn: [["pendiente", "en_camino", "entregado", "cancelado"]],
    },
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  repartidor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

export default Reparto;
