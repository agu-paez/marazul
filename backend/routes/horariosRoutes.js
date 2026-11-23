import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  actualizarConfiguracionHorarios,
  actualizarDiasNoLaborables,
  crearFeriado,
  eliminarFeriado,
  getDiasNoLaborables,
  getCodigoHoy,
  getMiAsistenciaHoy,
  getResumenHorarios,
  marcarIngreso,
} from "../controllers/horariosController.js";

const router = Router();

router.use(authenticate);
router.get("/codigo-hoy", authorize("admin"), getCodigoHoy);
router.get("/mi-asistencia-hoy", authorize("repartidor", "operador"), getMiAsistenciaHoy);
router.post("/marcar-ingreso", authorize("repartidor", "operador"), marcarIngreso);
router.get("/", authorize("admin"), getResumenHorarios);
router.get("/dias-no-laborables", authorize("admin"), getDiasNoLaborables);
router.put("/dias-no-laborables", authorize("admin"), actualizarDiasNoLaborables);
router.post("/feriados", authorize("admin"), crearFeriado);
router.delete("/feriados/:id", authorize("admin"), eliminarFeriado);
router.put("/configuracion", authorize("admin"), actualizarConfiguracionHorarios);

export default router;
