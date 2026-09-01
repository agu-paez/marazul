import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Venta = sequelize.define("Venta", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  numero_comprobante: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  hora: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tipo_venta: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "local",
    validate: { isIn: [["local", "reparto"]] },
  },
  cliente_nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cliente_direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cliente_telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  medio_pago: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "efectivo",
    validate: { isIn: [["efectivo", "transferencia", "tarjeta", "cheque", "ercheck", "otro", "cuenta_corriente", "dividido"]] },
  },
  pago_dividido: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Indica si la venta tiene multiples medios de pago",
  },
  subtotal: {
    type: DataTypes.DECIMAL(13, 2),
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(13, 2),
    defaultValue: 0,
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Cliente registrado (siempre requerido)",
  },
  salidaCamionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Salida de camion asociada (solo ventas por reparto)",
  },
  estado: {
    type: DataTypes.STRING,
    defaultValue: "completada",
    validate: { isIn: [["completada", "cancelada"]] },
  },
  datos_transferencia: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Array de datos bancarios para pagos por transferencia",
  },
  datos_tarjeta: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Array de datos bancarios para pagos por tarjeta",
  },
  datos_otro: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Datos identificatorios de otros medios de pago",
  },
  datos_cheque: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Datos de pagos por cheque",
  },
  datos_ercheck: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Datos de pagos por ER Check",
  },
  monto_deuda_pagado: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
    defaultValue: null,
    comment: "Monto pagado de deuda incluido en esta venta",
  },
  monto_sobrante: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
    defaultValue: 0,
    comment: "Excedente del pago dividido registrado como saldo a favor del cliente",
  },
  saldo_anterior_manual: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
  },
  saldo_actualizado_manual: {
    type: DataTypes.DECIMAL(13, 2),
    allowNull: true,
  },
  proveedorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Proveedor al que se transfiere el pago",
  },
  porcentaje_aumento: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    comment: "Porcentaje de aumento aplicado a los precios",
  },
  pago_modificado_por_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  pago_modificado_en: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pago_modificacion_detalle: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  productos_modificado_por_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  productos_modificado_en: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  productos_modificacion_detalle: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

export default Venta;
