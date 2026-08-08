import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
  getRoles,
  getRepartidores,
  getUsuariosPago,
} from "../controllers/userController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/repartidores", getRepartidores);
router.get("/empleados-pago", authorize("admin", "operador"), getUsuariosPago);

router.use(authorize("admin"));

router.get("/roles", getRoles);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.put("/:id/reset-password", resetPassword);
router.delete("/:id", deleteUser);

export default router;
