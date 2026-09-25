import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ProductoDescuento = sequelize.define("ProductoDescuento", {
  productoId: { type: DataTypes.INTEGER, primaryKey: true },
  descuentoId: { type: DataTypes.INTEGER, primaryKey: true },
  porcentaje: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
});

export default ProductoDescuento;
