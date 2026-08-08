import { Router } from "express";
import {
  getEstadisticasProduccion,
  getHistorialProduccion,
  descargarHistorialProduccionPdf,
  createProduccion,
} from "../controllers/produccionController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getEstadisticasProduccion);
router.get("/historial", getHistorialProduccion);
router.get("/historial/:semana/pdf", descargarHistorialProduccionPdf);
router.post("/", createProduccion);

export default router;
