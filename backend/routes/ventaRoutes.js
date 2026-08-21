import { Router } from "express";
import {
  crearVenta,
  getVentas,
  getVentaById,
  getVentasStats,
  deleteVenta,
  modificarPagoVenta,
} from "../controllers/ventaController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/stats", authorize("admin"), getVentasStats);

router.get("/", getVentas);
router.get("/:id", getVentaById);

router.post("/", authorize("admin", "operador", "repartidor"), crearVenta);

router.delete("/:id", authorize("admin"), deleteVenta);
router.put("/:id/pago", authorize("admin", "operador", "repartidor"), modificarPagoVenta);

export default router;
