import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listarDescuentos, crearDescuento, aplicarDescuento } from "../controllers/descuentoController.js";

const router = Router();
router.use(authenticate);
router.get("/", listarDescuentos);
router.post("/", authorize("admin"), crearDescuento);
router.put("/:id/aplicar", authorize("admin"), aplicarDescuento);
export default router;
