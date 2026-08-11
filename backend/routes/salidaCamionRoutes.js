import { Router } from "express";
import {
  getAllSalidas,
  getSalidaById,
  getMisSalidas,
  createSalida,
  updateSalidaStatus,
  updateSalidaCompleta,
  deleteSalida,
  getSalidasStats,
  registrarRegreso,
  getCamionesActivos,
  getStockCamion,
} from "../controllers/salidaCamionController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/stats", authorize("admin"), getSalidasStats);
router.get("/mis-salidas", getMisSalidas);
router.get("/activos", getCamionesActivos);
router.get("/:id/stock", getStockCamion);

router.get("/", authorize("admin", "operador"), getAllSalidas);
router.get("/:id", getSalidaById);

router.post("/", authorize("admin", "operador", "repartidor"), createSalida);

router.put("/:id/status", updateSalidaStatus);
router.put("/:id/regreso", registrarRegreso);
router.put("/:id", authorize("admin", "operador"), updateSalidaCompleta);

router.delete("/:id", authorize("admin"), deleteSalida);

export default router;
