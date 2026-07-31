import { Router } from "express";
import {
  getMarcas,
  getMarcasByProveedor,
  getMarcaById,
  createMarca,
  updateMarca,
  deleteMarca,
  generarPDFMarcasProductos,
} from "../controllers/marcaController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getMarcas);
router.get("/pdf", generarPDFMarcasProductos);
router.get("/proveedor/:proveedorId", getMarcasByProveedor);
router.get("/:id", getMarcaById);
router.post("/", authorize("admin"), createMarca);
router.put("/:id", authorize("admin"), updateMarca);
router.delete("/:id", authorize("admin"), deleteMarca);

export default router;
