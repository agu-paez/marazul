import { Router } from "express";
import { getEstadisticasProduccion, createProduccion } from "../controllers/produccionController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getEstadisticasProduccion);
router.post("/", createProduccion);

export default router;
