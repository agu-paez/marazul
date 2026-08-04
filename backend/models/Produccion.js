import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Produccion = sequelize.define("Produccion", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  cajones: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  alitas: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  pechugas: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  pata_muslo: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  menudos: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
});

export default Produccion;
