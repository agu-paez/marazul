import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Descuento = sequelize.define("Descuento", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

export default Descuento;
