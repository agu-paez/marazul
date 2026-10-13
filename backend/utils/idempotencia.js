import { UniqueConstraintError } from "sequelize";
import OperacionIdempotente from "../models/OperacionIdempotente.js";

// La clave la envia el cliente en el header Idempotency-Key. Sin ella se marca
// como unica solo para esta llamada, asi la operacion sigue siendo atomicamente
// idempotente aunque el cliente no participe del esquema.
export const claveIdempotencia = (req) => {
  const enviada = req.get("Idempotency-Key");
  return typeof enviada === "string" && enviada.trim() !== ""
    ? enviada.trim().slice(0, 64)
    : `sin-clave-${req.ip}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// Registra la clave dentro de la transaccion de la escritura. Si la clave ya
// existe en estado "completada", devuelve el resultado original en lugar de
// aplicar el delta por segunda vez.
export const iniciarOperacionIdempotente = async ({ clave, operacion, transaction }) => {
  const existente = await OperacionIdempotente.findOne({
    where: { clave },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (existente) {
    if (existente.estado === "completada" && existente.resultado) {
      return { repetida: true, resultado: JSON.parse(existente.resultado) };
    }
    // Quedo en "en_proceso" por una corrida anterior que no pudo revertirse
    // del todo: se reclama y se reintenta desde cero.
    existente.estado = "en_proceso";
    existente.resultado = null;
    existente.operacion = operacion;
    await existente.save({ transaction });
    return { repetida: false, id: existente.id };
  }

  try {
    const creada = await OperacionIdempotente.create({ clave, operacion }, { transaction });
    return { repetida: false, id: creada.id };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    // Otra transaccion cerro la misma clave al mismo tiempo.
    const otra = await OperacionIdempotente.findOne({ where: { clave }, transaction });
    if (otra && otra.estado === "completada" && otra.resultado) {
      return { repetida: true, resultado: JSON.parse(otra.resultado) };
    }
    throw new Error("La operacion esta en curso; reintente en unos segundos");
  }
};

export const finalizarOperacionIdempotente = async ({ id, resultado, transaction }) => {
  if (id === undefined || id === null) return;
  await OperacionIdempotente.update(
    { estado: "completada", resultado: JSON.stringify(resultado) },
    { where: { id }, transaction }
  );
};

// Reenvia una respuesta repetida respetando el mismo shape HTTP.
export const responderOperacionRepetida = (res, resultado) => {
  res.status(200).json({
    ...resultado,
    idempotente: true,
    detalle: "Solicitud ya procesada: no se aplico ninguna modificacion nueva",
  });
};
