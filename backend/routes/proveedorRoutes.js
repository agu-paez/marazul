import { Router } from "express";
import {
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  registrarMovimientoProveedor,
} from "../controllers/proveedorController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllProveedores);
router.get("/:id", getProveedorById);
router.post("/", authorize("admin"), createProveedor);
router.put("/:id", authorize("admin"), updateProveedor);
router.post("/:id/movimientos", authorize("admin"), registrarMovimientoProveedor);
router.delete("/:id", authorize("admin"), deleteProveedor);

export default router;
