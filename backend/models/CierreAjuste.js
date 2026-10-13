import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

// Registra cada correccion automatica a un cierre de caja producida por un
// cambio posterior en el total de una venta. Guarda el valor antes y despues
// para poder reconstruir el historial del cierre.
const CierreAjuste = sequelize.define(
  "CierreAjuste",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cierreId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Cierre de caja corregido",
    },
    ventaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Venta cuyo cambio total disparo la correccion",
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    total_anterior: {
      type: DataTypes.DECIMAL(13, 2),
      allowNull: false,
    },
    total_nuevo: {
      type: DataTypes.DECIMAL(13, 2),
      allowNull: false,
    },
    operacionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    detalle: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  { updatedAt: false }
);

export default CierreAjuste;