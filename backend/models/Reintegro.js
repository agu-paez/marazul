import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Reintegro = sequelize.define("Reintegro", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monto: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  precio: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  producto_nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  hora: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  registradoPorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

export default Reintegro;
