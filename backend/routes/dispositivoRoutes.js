import { Router } from "express";
import {
  registrarUbicacion,
  listarDispositivos,
  crearDispositivo,
  actualizarDispositivo,
  regenerarToken,
  eliminarDispositivo,
} from "../controllers/dispositivoController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Ingesta de ubicación desde la app Android: se autentica con token de dispositivo.
router.post("/ubicacion", registrarUbicacion);

router.use(authenticate);

// Consulta del mapa: admins y operadores.
router.get("/", authorize("admin", "operador"), listarDispositivos);

// Gestión de dispositivos: solo admin.
router.post("/", authorize("admin"), crearDispositivo);
router.put("/:id", authorize("admin"), actualizarDispositivo);
router.put("/:id/token", authorize("admin"), regenerarToken);
router.delete("/:id", authorize("admin"), eliminarDispositivo);

export default router;
