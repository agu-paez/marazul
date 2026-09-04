import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Proveedor = sequelize.define("Proveedor", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  alias: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Alias de transferencia bancaria",
  },
  tipo_producto: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Ej: pollos, garnacha, bebidas, etc.",
  },
  mercaderias_compradas: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    allowNull: true,
  },
  dinero_ventas: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    allowNull: true,
  },
  diferencia_acumulada: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    allowNull: true,
    comment: "Diferencia acumulada de movimientos guardados",
  },
  transferencias_liquidadas: {
    type: DataTypes.DECIMAL(13, 2),
    defaultValue: 0,
    allowNull: false,
    comment: "Transferencias incluidas en pagos de proveedor",
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

export default Proveedor;
