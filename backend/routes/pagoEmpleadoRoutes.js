import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getPagosEmpleadosHoy, guardarPagosEmpleadosHoy } from "../controllers/pagoEmpleadoController.js";

const router = Router();
router.use(authenticate, authorize("admin", "operador"));
router.get("/hoy", getPagosEmpleadosHoy);
router.put("/hoy", guardarPagosEmpleadosHoy);
export default router;
