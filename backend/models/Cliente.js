import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Cliente = sequelize.define("Cliente", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  zona: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Zona asignada para el reparto",
  },
  saldo_pendiente: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: "Deuda acumulada en cuenta corriente",
  },
  limite_credito: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 30000,
    comment: "Limite de credito en cuenta corriente",
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

export default Cliente;
