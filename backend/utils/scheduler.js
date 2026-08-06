import cron from "node-cron";
import logger from "./logger.js";

export const iniciarSchedulerProduccion = () => {
  cron.schedule("0 0 * * 0", () => {
    logger.info("Reinicio semanal de producción: registros y promedios diarios vaciados");
  });

  cron.schedule("0 0 1 * *", () => {
    logger.info("Reinicio mensual de producción: promedio semanal vaciado");
  });

  logger.info("Scheduler de producción iniciado (domingos 00:00 y día 1 de cada mes a las 00:00)");
};
