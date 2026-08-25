import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const GastoDia = sequelize.define("GastoDia", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  combustible: { type: DataTypes.DECIMAL(13, 2), allowNull: false, defaultValue: 0 },
  otros: { type: DataTypes.DECIMAL(13, 2), allowNull: false, defaultValue: 0 },
  descripcion_otros: { type: DataTypes.TEXT, allowNull: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: true },
});

export default GastoDia;
