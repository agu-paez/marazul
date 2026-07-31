import { Router } from "express";
import {
  getResumenDelDia,
  cerrarCaja,
  getHistorialCierres,
  getPagosHoy,
  getDetalleCierre,
} from "../controllers/cierreCajaController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/resumen-hoy", getResumenDelDia);
router.get("/historial", authorize("admin", "operador"), getHistorialCierres);
router.get("/pagos-hoy", authorize("admin", "operador"), getPagosHoy);
router.get("/detalle-cierre", authorize("admin", "operador"), getDetalleCierre);
router.post("/cerrar", authorize("admin", "operador"), cerrarCaja);

export default router;
