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
    type: DataTypes.DECIMAL(13, 2),
    defaultValue: 0,
    comment: "Deuda acumulada en cuenta corriente",
  },
  tipo_descuento: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "producto",
    comment: "Tipo de descuento aplicado al cliente: producto, mayorista o nuevo",
  },
  saldo_favor: {
    type: DataTypes.DECIMAL(13, 2),
    defaultValue: 0,
    comment: "Credito a favor del cliente",
  },
  limite_credito: {
    type: DataTypes.DECIMAL(13, 2),
    defaultValue: 30000,
    comment: "Limite de credito en cuenta corriente",
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  pendiente_revision: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Cliente creado por repartidor pendiente de revision de admin u operador",
  },
});

export default Cliente;
