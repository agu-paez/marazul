import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const VentaItem = sequelize.define("VentaItem", {
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
  precio_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  costo_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  unidad_venta: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "unidad",
    comment: "Unidad elegida para la venta: caja o unidad",
  },
  unidades_por_caja: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Contenido de la caja al momento de la venta",
  },
  cantidad_unidades: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Cantidad vendida expresada en unidades individuales",
  },
});

export default VentaItem;
