import { Venta, CierreCaja, CierreAjuste } from "../models/index.js";

// Recalcula solo el total_ventas de un cierre a partir de las ventas actuales.
// Es el unico campo del cierre que depende de Venta.total; ventas_netas sale de
// la mercaderia enviada/devuelta (SalidaCamion), no de las ventas, asi que no
// se toca. Si el llamado vino de una propagacion de saldos (que no cambia
// totales), no hay nada que recalcular y esto devuelve null sin escribir.
export const recalcularCierrePorFecha = async ({ fecha, transaction, ventaId = null, usuarioId = null, operacionId = null, detalle = null }) => {
  const cierre = await CierreCaja.findOne({ where: { fecha }, transaction });
  if (!cierre) return null;

  const ventas = await Venta.findAll({
    where: { fecha, estado: "completada" },
    attributes: ["total"],
    transaction,
  });
  const totalActual = ventas.reduce((sum, venta) => sum + (parseFloat(venta.total) || 0), 0);
  const totalAnterior = parseFloat(cierre.total_ventas) || 0;

  if (Math.abs(totalActual - totalAnterior) > 0.009) {
    await cierre.update({ total_ventas: totalActual.toFixed(2) }, { transaction });

    await CierreAjuste.create({
      cierreId: cierre.id,
      ventaId,
      fecha,
      total_anterior: totalAnterior.toFixed(2),
      total_nuevo: totalActual.toFixed(2),
      operacionId,
      usuarioId,
      detalle,
    }, { transaction });

    return { total_anterior: totalAnterior.toFixed(2), total_nuevo: totalActual.toFixed(2) };
  }

  return null;
};