const toNum = (valor) => {
  const numero = parseFloat(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export const redondear = (valor) => Math.round((toNum(valor) + Number.EPSILON) * 100) / 100;

export const formatearMonto = (valor) => redondear(valor).toFixed(2);

export const saldoNeto = (pendiente, favor) => Math.max(0, toNum(pendiente) - toNum(favor));

export const TOLERANCIA = 0.005;

export const esDeltaRelevante = (delta) => Math.abs(toNum(delta)) >= TOLERANCIA;

export const tieneValor = (valor) => valor !== null && valor !== undefined;

/**
 * Aplica un delta al par (deuda, favor). delta > 0 aumenta la deuda.
 * favorConsumible acota cuanto favor absorbe el delta: es el favor que el
 * cliente tenia registrado en la fecha del movimiento, de modo que un favor
 * generado en dias posteriores nunca se consume de forma retroactiva.
 */
export const aplicarDeltaSaldo = ({ pendiente, favor, delta, favorConsumible }) => {
  let saldoPendiente = Math.max(0, toNum(pendiente));
  let saldoFavor = Math.max(0, toNum(favor));
  const montoDelta = redondear(delta);

  if (!esDeltaRelevante(montoDelta)) {
    return {
      saldo_pendiente: formatearMonto(saldoPendiente),
      saldo_favor: formatearMonto(saldoFavor),
      favor_consumido: 0,
    };
  }

  let favorConsumido = 0;

  if (montoDelta > 0) {
    const limite = favorConsumible === undefined || favorConsumible === null
      ? saldoFavor
      : Math.min(saldoFavor, Math.max(0, toNum(favorConsumible)));
    favorConsumido = redondear(Math.min(limite, montoDelta));
    saldoFavor = redondear(saldoFavor - favorConsumido);
    saldoPendiente = redondear(saldoPendiente + (montoDelta - favorConsumido));
  } else {
    const reduccion = Math.abs(montoDelta);
    const aplicado = Math.min(saldoPendiente, reduccion);
    saldoPendiente = redondear(saldoPendiente - aplicado);
    saldoFavor = redondear(saldoFavor + (reduccion - aplicado));
  }

  return {
    saldo_pendiente: formatearMonto(saldoPendiente),
    saldo_favor: formatearMonto(saldoFavor),
    favor_consumido: favorConsumido,
  };
};

/**
 * Delta de un ajuste manual, calculado sobre el saldo vigente de la venta
 * para que reeditarla siga siendo relativo a su estado actual y no al valor
 * original de la tabla.
 */
export const calcularDeltaManual = ({ saldoActualizado, saldoBase }) => redondear(
  Math.max(0, toNum(saldoActualizado)) - Math.max(0, toNum(saldoBase))
);

export const favorDeVenta = (venta) => (tieneValor(venta.saldo_favor_registrado) ? toNum(venta.saldo_favor_registrado) : 0);
