import { Router } from "express";
import {
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  registrarMovimientoProveedor,
  cambiarEstadoProveedor,
  getHistorialProveedores,
} from "../controllers/proveedorController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/historial", authorize("admin"), getHistorialProveedores);
router.get("/", getAllProveedores);
router.get("/:id", getProveedorById);
router.post("/", authorize("admin"), createProveedor);
router.put("/:id", authorize("admin"), updateProveedor);
router.post("/:id/movimientos", authorize("admin"), registrarMovimientoProveedor);
router.patch("/:id/estado", authorize("admin"), cambiarEstadoProveedor);
router.delete("/:id", authorize("admin"), deleteProveedor);

export default router;
