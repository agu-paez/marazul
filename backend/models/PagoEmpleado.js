import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PagoEmpleado = sequelize.define("PagoEmpleado", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  registradoPorId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [{ unique: true, fields: ["fecha", "userId"] }],
});

export default PagoEmpleado;
