import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const HorarioConfiguracion = sequelize.define("HorarioConfiguracion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
  max_minutos_tarde: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

export default HorarioConfiguracion;
