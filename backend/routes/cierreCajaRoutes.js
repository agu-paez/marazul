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
  abrirCaja,
  eliminarCierre,
} from "../controllers/cierreCajaController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/resumen-hoy", getResumenDelDia);
router.get("/historial", authorize("admin"), getHistorialCierres);
router.get("/pagos-hoy", authorize("admin", "operador"), getPagosHoy);
router.get("/detalle-cierre", authorize("admin", "operador"), getDetalleCierre);
router.get("/historial-gastos", authorize("admin"), getHistorialGastos);
router.get("/historial-pagos-empleados", authorize("admin"), getHistorialPagosEmpleados);
router.get("/ingresos-egresos", authorize("admin"), getResumenIngresosEgresos);
router.post("/cerrar", authorize("admin", "operador"), cerrarCaja);
router.post("/:fecha/abrir", authorize("admin", "operador"), abrirCaja);
router.delete("/:fecha", authorize("admin"), eliminarCierre);

export default router;
