import { Router } from "express";
import {
  getResumenDelDia,
  cerrarCaja,
  getHistorialCierres,
  getPagosHoy,
  getDetalleCierre,
  getHistorialGastos,
  getHistorialPagosEmpleados,
  getResumenIngresosEgresos,
} from "../controllers/cierreCajaController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/resumen-hoy", getResumenDelDia);
router.get("/historial", authorize("admin", "operador"), getHistorialCierres);
router.get("/pagos-hoy", authorize("admin", "operador"), getPagosHoy);
router.get("/detalle-cierre", authorize("admin", "operador"), getDetalleCierre);
router.get("/historial-gastos", authorize("admin", "operador"), getHistorialGastos);
router.get("/historial-pagos-empleados", authorize("admin", "operador"), getHistorialPagosEmpleados);
router.get("/ingresos-egresos", authorize("admin", "operador"), getResumenIngresosEgresos);
router.post("/cerrar", authorize("admin", "operador"), cerrarCaja);

export default router;
