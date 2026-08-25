import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const VentaPago = sequelize.define("VentaPago", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  medio_pago: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [["efectivo", "transferencia", "tarjeta", "cuenta_corriente", "otro"]] },
  },
  monto: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: false,
  },
});

export default VentaPago;
