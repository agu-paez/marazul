import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ConteoVentasLocal = sequelize.define("ConteoVentasLocal", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true,
    comment: "Dia de las ventas de mostrador (tipo_venta = local) al que pertenece el conteo",
  },
  conteo_billetes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "JSON con la cantidad de billetes contada para el dia",
  },
  gastos_combustible: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
    defaultValue: 0,
  },
  gastos_otros: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
    defaultValue: 0,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Usuario que registro el conteo",
  },
});

export default ConteoVentasLocal;