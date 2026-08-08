import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Producto = sequelize.define("Producto", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  costo: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Costo unitario del producto",
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  stock_minimo: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: "Stock minimo para alerta de poco inventario",
  },
  unidad: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "pieza",
  },
  kg_por_caja: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  codigo_barras: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  marcaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

export default Producto;
