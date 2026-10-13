import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SaldoAjuste = sequelize.define("SaldoAjuste", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Cliente cuyo saldo fue ajustado",
  },
  ventaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Venta desde la que se aplico el ajuste, null si fue ajuste directo de cuenta",
  },
  operacionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Peticion idempotente que produjo este ajuste",
  },
  origen: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: "Origen del ajuste: saldos_venta, montos_cliente, productos, pagos",
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  saldo_anterior: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  saldo_nuevo: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
  favor_consumido: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
    defaultValue: 0,
  },
  detalle: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

export default SaldoAjuste;
