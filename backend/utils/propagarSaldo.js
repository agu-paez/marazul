import { Op } from "sequelize";
import { Venta, ClientePago } from "../models/index.js";
import { esDeltaRelevante, redondear, tieneValor } from "./saldoBase.js";

const aNumero = (valor) => {
  if (!tieneValor(valor)) return null;
  const numero = parseFloat(valor);
  return Number.isFinite(numero) ? redondear(numero) : null;
};

const movimientoEntre = (anterior, actual) => {
  const desde = aNumero(anterior);
  const hasta = aNumero(actual);
  if (desde === null || hasta === null) return null;
  return redondear(hasta - desde);
};

/**
 * Encadena los snapshots posteriores a una venta editada.
 * Solo avanza en el tiempo: nunca toca movimientos anteriores al punto de corte,
 * sin importar si esos dias tienen la caja cerrada.
 *
 * A partir del saldo "de despues" de la venta editada (su saldo manual si
 * existe, si no el automatico), cada movimiento posterior del cliente toma su
 * saldo anterior del saldo actual de la factura/movimiento anterior. Asi una
 * factura nunca queda desalineada frente a la anterior, ni siquiera si tenia un
 * ajuste manual previo desfasado. El movimiento propio de cada fila (su
 * saldo_actual menos su saldo_anterior) se conserva, de modo que solo se
 * corrigen los enlaces de la cadena.
 */
export const propagarDeltaAdelante = async ({ clienteId, ventaCorte, delta, saldoCorte, transaction }) => {
  const resultado = { ventas: 0, pagos: 0 };

  if (!clienteId || !esDeltaRelevante(delta)) return resultado;

  const ventasPosteriores = await Venta.findAll({
    where: { clienteId, id: { [Op.gt]: ventaCorte.id } },
    order: [["createdAt", "ASC"], ["id", "ASC"]],
    transaction,
  });

  const pagosPosteriores = await ClientePago.findAll({
    where: { clienteId, createdAt: { [Op.gt]: ventaCorte.createdAt } },
    order: [["createdAt", "ASC"], ["id", "ASC"]],
    transaction,
  });

  const movimientos = [
    ...ventasPosteriores.map((item) => ({ tipo: "venta", fecha: item.createdAt, item })),
    ...pagosPosteriores.map((item) => ({ tipo: "pago", fecha: item.createdAt, item })),
  ].sort((a, b) => {
    const fechaA = new Date(a.fecha).getTime();
    const fechaB = new Date(b.fecha).getTime();
    if (fechaA !== fechaB) return fechaA - fechaB;
    return a.tipo === b.tipo ? 0 : a.tipo === "venta" ? -1 : 1;
  });

  // Punto de partida del encadenamiento. Por defecto es el saldo "despues"
  // de la venta de corte (manual si lo tiene). Los flujos en los que el ajuste
  // no queda reflejado en la propia venta (borrar factura, ajuste de montos del
  // cliente) pasan `saldoCorte` explicitamente.
  let saldoVigente = tieneValor(saldoCorte)
    ? aNumero(saldoCorte)
    : aNumero(ventaCorte.saldo_actualizado_manual) ?? aNumero(ventaCorte.saldo_actual);

  if (saldoVigente === null) return resultado;

  for (const { tipo, item } of movimientos) {
    const movimiento = movimientoEntre(item.saldo_anterior, item.saldo_actual);
    const tieneManualActual = tipo === "venta" && tieneValor(item.saldo_actualizado_manual);
    const movimientoManual = tipo === "venta"
      ? movimientoEntre(item.saldo_anterior_manual, item.saldo_actualizado_manual)
      : null;
    const movimientoEfectivo = tieneManualActual && movimientoManual !== null ? movimientoManual : movimiento;

    const updates = {};

    if (tieneValor(item.saldo_anterior)) {
      updates.saldo_anterior = saldoVigente.toFixed(2);
    }
    if (movimiento !== null && tieneValor(item.saldo_actual)) {
      updates.saldo_actual = redondear(saldoVigente + movimiento).toFixed(2);
    }
    if (tipo === "venta") {
      if (tieneValor(item.saldo_anterior_manual)) {
        updates.saldo_anterior_manual = saldoVigente.toFixed(2);
      }
      if (tieneManualActual) {
        updates.saldo_actualizado_manual = redondear(saldoVigente + (movimientoEfectivo ?? 0)).toFixed(2);
      }
    }

    if (Object.keys(updates).length > 0) {
      await item.update(updates, { transaction });
      if (tipo === "venta") resultado.ventas += 1;
      else resultado.pagos += 1;
    }

    if (movimientoEfectivo !== null) {
      saldoVigente = redondear(saldoVigente + movimientoEfectivo);
    }
  }

  return resultado;
};
