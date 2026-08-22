import { Router } from "express";
import {
  getAllProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getLowStock,
  actualizarPreciosPorcentaje,
  actualizarDescuentos,
  descontarStock,
} from "../controllers/productoController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.put("/actualizar-precios", authorize("admin"), actualizarPreciosPorcentaje);
router.put("/actualizar-descuentos", authorize("admin"), actualizarDescuentos);
router.get("/low-stock", authorize("admin"), getLowStock);
router.post("/:id/descontar-stock", authorize("admin"), descontarStock);
router.get("/", getAllProductos);
router.post("/", authorize("admin"), createProducto);
router.put("/:id", authorize("admin"), updateProducto);
router.delete("/:id", authorize("admin"), deleteProducto);

export default router;
