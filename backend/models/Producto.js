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
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  descuento: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Descuento porcentual configurable por el administrador para aplicar en ventas",
  },
  descuento_mayorista: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Descuento porcentual automatico para ventas mayoristas",
  },
  descuento_nuevo: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Descuento porcentual para clientes nuevos",
  },
  costo: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Costo unitario del producto",
  },
  stock: {
    type: DataTypes.DECIMAL(13, 2),
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
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
  },
  codigo_barras: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  excluir_de_lista_pdf: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  permitir_modificar_precio: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: "Permite modificar el precio del producto al registrar una venta",
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
