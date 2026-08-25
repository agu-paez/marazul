import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SalidaCamionItem = sequelize.define("SalidaCamionItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cantidad: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
  cantidad_devuelta: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});

export default SalidaCamionItem;
