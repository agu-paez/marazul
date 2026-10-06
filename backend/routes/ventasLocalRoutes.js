import { Router } from "express";
import {
  getHistorialVentasLocal,
  getDetalleVentasLocal,
  guardarConteoVentasLocal,
} from "../controllers/ventasLocalController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin", "operador"), getHistorialVentasLocal);
router.get("/detalle", authorize("admin", "operador"), getDetalleVentasLocal);
router.put("/:fecha/conteo", authorize("admin", "operador"), guardarConteoVentasLocal);

export default router;