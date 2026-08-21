import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SalidaCamionItem = sequelize.define("SalidaCamionItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cantidad: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
  cantidad_devuelta: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  unidades_por_caja: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Contenido de la caja al cargar el camion",
  },
  cantidad_unidades: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Cantidad cargada expresada en unidades individuales",
  },
  cantidad_devuelta_unidades: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Cantidad devuelta expresada en unidades individuales",
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});

export default SalidaCamionItem;
