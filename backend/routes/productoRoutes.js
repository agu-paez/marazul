import { Router } from "express";
import {
  getAllProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getLowStock,
  actualizarPreciosPorcentaje,
  descontarStock,
} from "../controllers/productoController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.put("/actualizar-precios", actualizarPreciosPorcentaje);
router.get("/low-stock", getLowStock);
router.post("/:id/descontar-stock", authorize("admin"), descontarStock);
router.get("/", getAllProductos);
router.post("/", createProducto);
router.put("/:id", updateProducto);
router.delete("/:id", deleteProducto);

export default router;
