import { Router } from "express";
import {
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  updateMontosCliente,
  getHistorialCuentaCorriente,
  registrarPagoCuentaCorriente,
  revisarCliente,
  deleteCliente,
} from "../controllers/clienteController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllClientes);
router.get("/:id", getClienteById);
router.get("/:id/historial-cc", getHistorialCuentaCorriente);
router.post("/", createCliente);
router.post("/:id/pago-cc", authorize("admin", "operador", "repartidor"), registrarPagoCuentaCorriente);
router.put("/:id", updateCliente);
router.put("/:id/montos", authorize("admin"), updateMontosCliente);
router.put("/:id/revisar", authorize("admin", "operador"), revisarCliente);
router.delete("/:id", deleteCliente);

export default router;
