import { CierreCaja, PagoEmpleado, Role, User } from "../models/index.js";
import { getFechaLocal } from "../utils/fecha.js";

export const getPagosEmpleadosHoy = async (req, res) => {
  try {
    const fecha = req.query.fecha || getFechaLocal();
    const pagos = await PagoEmpleado.findAll({
      where: { fecha },
      include: [{ model: User, as: "empleado", attributes: ["id", "nombre"], include: [{ model: Role, attributes: ["nombre"] }] }],
      order: [[{ model: User, as: "empleado" }, "nombre", "ASC"]],
    });
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pagos de empleados", error: error.message });
  }
};

export const guardarPagosEmpleadosHoy = async (req, res) => {
  try {
    const fecha = getFechaLocal();
    if (await CierreCaja.findOne({ where: { fecha } })) {
      return res.status(400).json({ message: "La caja del dia ya fue cerrada" });
    }
    const pagos = Array.isArray(req.body.pagos) ? req.body.pagos : [];
    const usuarios = await User.findAll({
      where: { activo: true },
      include: [{ model: Role, where: { nombre: ["repartidor", "operador"] }, attributes: [] }],
      attributes: ["id"],
    });
    const idsPermitidos = new Set(usuarios.map((usuario) => usuario.id));
    const montosRecibidos = pagos.map((pago) => ({ userId: Number(pago.userId), monto: Number(pago.monto || 0) }));
    if (montosRecibidos.some((pago) => !idsPermitidos.has(pago.userId) || !Number.isFinite(pago.monto) || pago.monto < 0)) {
      return res.status(400).json({ message: "Los montos deben ser validos" });
    }
    const normalizados = montosRecibidos.filter((pago) => pago.monto > 0);
    await PagoEmpleado.destroy({ where: { fecha } });
    if (normalizados.length > 0) {
      await PagoEmpleado.bulkCreate(normalizados.map((pago) => ({ ...pago, fecha, registradoPorId: req.user.id })));
    }
    res.json({ message: "Pagos de empleados guardados", pagos: normalizados });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar pagos de empleados", error: error.message });
  }
};
