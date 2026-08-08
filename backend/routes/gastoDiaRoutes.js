import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getGastoDia, guardarGastoDia } from "../controllers/gastoDiaController.js";

const router = Router();
router.use(authenticate, authorize("admin", "operador"));
router.get("/hoy", getGastoDia);
router.put("/hoy", guardarGastoDia);
export default router;
