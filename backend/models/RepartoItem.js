import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const RepartoItem = sequelize.define("RepartoItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
});

export default RepartoItem;
