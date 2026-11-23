import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const DiaNoLaboralSemana = sequelize.define("DiaNoLaboralSemana", {
  dia_semana: { type: DataTypes.INTEGER, primaryKey: true, validate: { min: 0, max: 6 } },
});

export default DiaNoLaboralSemana;
