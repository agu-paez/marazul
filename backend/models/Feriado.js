import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Feriado = sequelize.define("Feriado", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
});

export default Feriado;
