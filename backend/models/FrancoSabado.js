import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const FrancoSabado = sequelize.define("FrancoSabado", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  cumplio_regla: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  indexes: [{ unique: true, fields: ["fecha", "userId"] }],
});

export default FrancoSabado;
