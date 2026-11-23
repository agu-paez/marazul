import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const HorarioCodigo = sequelize.define("HorarioCodigo", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  codigo: { type: DataTypes.STRING(6), allowNull: false, unique: true },
});

export default HorarioCodigo;
