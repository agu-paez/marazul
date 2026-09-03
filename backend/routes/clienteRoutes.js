import { Router } from "express";
import {
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  updateMontosCliente,
  getHistorialCuentaCorriente,
  getHistorialDeudas,
  registrarPagoCuentaCorriente,
  deletePagoCuentaCorriente,
  revisarCliente,
  deleteCliente,
  registrarReintegro,
  getHistorialReintegros,
} from "../controllers/clienteController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllClientes);
router.get("/historial-deudas", getHistorialDeudas);
router.get("/reintegros", authorize("admin", "operador", "repartidor"), getHistorialReintegros);
router.get("/:id", getClienteById);
router.get("/:id/historial-cc", getHistorialCuentaCorriente);
router.post("/", createCliente);
router.post("/:id/pago-cc", authorize("admin", "operador", "repartidor"), registrarPagoCuentaCorriente);
router.post("/:id/reintegros", authorize("admin", "operador", "repartidor"), registrarReintegro);
router.delete("/:id/pago-cc/:pagoId", authorize("admin", "operador", "repartidor"), deletePagoCuentaCorriente);
router.put("/:id", updateCliente);
router.put("/:id/montos", authorize("admin"), updateMontosCliente);
router.put("/:id/revisar", authorize("admin", "operador"), revisarCliente);
router.delete("/:id", deleteCliente);

export default router;
