import { Router } from "express";
import {
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  registrarMovimientoProveedor,
} from "../controllers/proveedorController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllProveedores);
router.get("/:id", getProveedorById);
router.post("/", createProveedor);
router.put("/:id", updateProveedor);
router.post("/:id/movimientos", registrarMovimientoProveedor);
router.delete("/:id", deleteProveedor);

export default router;
