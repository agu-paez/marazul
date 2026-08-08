import { Router } from "express";
import {
  getAllProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getLowStock,
  actualizarPreciosPorcentaje,
} from "../controllers/productoController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.put("/actualizar-precios", actualizarPreciosPorcentaje);
router.get("/low-stock", getLowStock);
router.get("/", getAllProductos);
router.post("/", createProducto);
router.put("/:id", updateProducto);
router.delete("/:id", deleteProducto);

export default router;
