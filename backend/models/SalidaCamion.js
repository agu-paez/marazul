import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SalidaCamion = sequelize.define("SalidaCamion", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  camion: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "Identificación del camión (placa o número)",
  },
  destino: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cliente_nombre: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cliente_direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cliente_telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  precio_total: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
    defaultValue: 0,
  },
  estado: {
    type: DataTypes.STRING,
    defaultValue: "pendiente",
    validate: {
      isIn: [["pendiente", "en_camino", "entregado", "cancelado", "sobrante"]],
    },
  },
  monto_salida: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
    defaultValue: 0,
    comment: "Monto con el que salió el camión",
  },
  monto_regreso: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
    defaultValue: 0,
    comment: "Monto con el que regresó el camión",
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Cliente registrado (opcional)",
  },
  autorizadoPorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Usuario (admin/operador) que autorizo la salida al marcarla como en camino",
  },
});

export default SalidaCamion;
