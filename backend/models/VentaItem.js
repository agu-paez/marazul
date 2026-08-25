import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const VentaItem = sequelize.define("VentaItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cantidad: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
    defaultValue: 1,
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  costo_unitario: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
    defaultValue: 0,
  },
});

export default VentaItem;
