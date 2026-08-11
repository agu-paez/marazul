import { Router } from "express";
import {
  getEstadisticasProduccion,
  getHistorialProduccion,
  descargarHistorialProduccionPdf,
  createProduccion,
} from "../controllers/produccionController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin"), getEstadisticasProduccion);
router.get("/historial", authorize("admin"), getHistorialProduccion);
router.get("/historial/:semana/pdf", authorize("admin"), descargarHistorialProduccionPdf);
router.post("/", authorize("admin"), createProduccion);

export default router;
