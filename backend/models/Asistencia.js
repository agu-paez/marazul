import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Asistencia = sequelize.define("Asistencia", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  hora_ingreso: { type: DataTypes.STRING(8), allowNull: true },
  estado: { type: DataTypes.ENUM("puntual", "tarde", "ausente"), allowNull: false },
  minutos_tarde: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  indexes: [{ unique: true, fields: ["userId", "fecha"] }],
});

export default Asistencia;
