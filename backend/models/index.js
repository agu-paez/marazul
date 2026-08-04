import User from "./User.js";
import Role from "./Role.js";
import Proveedor from "./Proveedor.js";
import Marca from "./Marca.js";
import Producto from "./Producto.js";
import Reparto from "./Reparto.js";
import RepartoItem from "./RepartoItem.js";
import SalidaCamion from "./SalidaCamion.js";
import SalidaCamionItem from "./SalidaCamionItem.js";
import CierreCaja from "./CierreCaja.js";
import Venta from "./Venta.js";
import VentaItem from "./VentaItem.js";
import VentaPago from "./VentaPago.js";
import Cliente from "./Cliente.js";
import ClientePago from "./ClientePago.js";
import Banco from "./Banco.js";
import Produccion from "./Produccion.js";

User.belongsTo(Role, { foreignKey: "roleId" });
Role.hasMany(User, { foreignKey: "roleId" });

Proveedor.hasMany(Marca, { foreignKey: "proveedorId" });
Marca.belongsTo(Proveedor, { foreignKey: "proveedorId" });

Marca.hasMany(Producto, { foreignKey: "marcaId" });
Producto.belongsTo(Marca, { foreignKey: "marcaId" });

RepartoItem.belongsTo(Reparto, { foreignKey: "repartoId" });
Reparto.hasMany(RepartoItem, { foreignKey: "repartoId" });

RepartoItem.belongsTo(Producto, { foreignKey: "productoId" });
Producto.hasMany(RepartoItem, { foreignKey: "productoId" });

Reparto.belongsTo(User, { foreignKey: "userId", as: "creado_por" });
User.hasMany(Reparto, { foreignKey: "userId" });

SalidaCamionItem.belongsTo(SalidaCamion, { foreignKey: "salidaCamionId" });
SalidaCamion.hasMany(SalidaCamionItem, { foreignKey: "salidaCamionId" });

SalidaCamionItem.belongsTo(Producto, { foreignKey: "productoId" });
Producto.hasMany(SalidaCamionItem, { foreignKey: "productoId" });

SalidaCamion.belongsTo(User, { foreignKey: "asignadoRepartidorId", as: "repartidor_asignado" });
User.hasMany(SalidaCamion, { foreignKey: "asignadoRepartidorId" });

SalidaCamion.belongsTo(User, { foreignKey: "creadoPorId", as: "creado_por" });
User.hasMany(SalidaCamion, { foreignKey: "creadoPorId" });

SalidaCamion.belongsTo(Cliente, { foreignKey: "clienteId", as: "cliente" });
Cliente.hasMany(SalidaCamion, { foreignKey: "clienteId" });

VentaItem.belongsTo(Venta, { foreignKey: "ventaId" });
Venta.hasMany(VentaItem, { foreignKey: "ventaId" });

VentaItem.belongsTo(Producto, { foreignKey: "productoId" });
Producto.hasMany(VentaItem, { foreignKey: "productoId" });

VentaPago.belongsTo(Venta, { foreignKey: "ventaId" });
Venta.hasMany(VentaPago, { foreignKey: "ventaId" });

Venta.belongsTo(User, { foreignKey: "usuarioId", as: "vendedor" });
User.hasMany(Venta, { foreignKey: "usuarioId" });

Venta.belongsTo(Cliente, { foreignKey: "clienteId", as: "cliente" });
Cliente.hasMany(Venta, { foreignKey: "clienteId" });

Venta.belongsTo(SalidaCamion, { foreignKey: "salidaCamionId", as: "salida_camion" });
SalidaCamion.hasMany(Venta, { foreignKey: "salidaCamionId" });

ClientePago.belongsTo(Cliente, { foreignKey: "clienteId" });
Cliente.hasMany(ClientePago, { foreignKey: "clienteId" });

Venta.belongsTo(Proveedor, { foreignKey: "proveedorId" });
Proveedor.hasMany(Venta, { foreignKey: "proveedorId" });

export { User, Role, Proveedor, Marca, Producto, Reparto, RepartoItem, SalidaCamion, SalidaCamionItem, CierreCaja, Venta, VentaItem, VentaPago, Cliente, ClientePago, Banco, Produccion };
