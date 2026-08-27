import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClientePago = sequelize.define("ClientePago", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monto: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  medio_pago: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [["efectivo", "transferencia", "tarjeta", "cheque", "ercheck", "otro"]] },
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  fecha_pago: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  hora: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  datos_transferencia: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  datos_tarjeta: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  datos_cheque: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  datos_ercheck: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  proveedorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  titular: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  banco: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

export default ClientePago;
