import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ProveedorMovimiento = sequelize.define("ProveedorMovimiento", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  proveedorId: { type: DataTypes.INTEGER, allowNull: false },
  mercaderias_compradas: { type: DataTypes.DECIMAL(13, 2), allowNull: false, defaultValue: 0 },
  dinero_ventas: { type: DataTypes.DECIMAL(13, 2), allowNull: false, defaultValue: 0 },
  diferencia: { type: DataTypes.DECIMAL(13, 2), allowNull: false, defaultValue: 0 },
});

export default ProveedorMovimiento;
