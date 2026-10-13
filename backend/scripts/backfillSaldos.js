import sequelize from "../config/database.js";
import { Cliente, ClientePago, Venta, VentaPago } from "../models/index.js";
import { Op } from "sequelize";
import { redondear } from "../utils/saldo.js";

const aplicar = process.argv.includes("--aplicar");

const toNum = (valor) => {
  const numero = parseFloat(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const resumen = {
  dry_run: !aplicar,
  flag_manual_contaminado: 0,
  flag_manual_conservado: 0,
  ventas_reconstruidas: 0,
  ventas_sin_referencia: [],
  pagos_reconstruidos: 0,
  pagos_vinculados: 0,
  pagos_ambiguos: [],
  ejemplos: [],
};

await sequelize.authenticate();
console.log( aplicar ? "MODO APLICAR: se modificaran filas" : "MODO DRY-RUN: no se modifica nada, usar --aplicar para escribir");

const transaction = aplicar ? await sequelize.transaction() : null;
const opciones = transaction ? { transaction } : {};

// 1) Limpieza del flag de saldo manual.
//
// modificarPagoVenta escribia saldo_actualizado_manual con el saldo recalculado
// del cliente. Las filas con saldo_origen NULL provienen de ese camino y no son
// un ajuste humano, asi que el valor se descarta y el PDF vuelve a usar el
// snapshot automatico. Las que tienen saldo_origen 'manual' se respetan.
const contaminadas = await Venta.findAll({
  where: {
    saldo_actualizado_manual: { [Op.ne]: null },
    saldo_origen: { [Op.is]: null },
  },
  attributes: ["id", "numero_comprobante", "fecha", "saldo_actualizado_manual", "saldo_actual"],
  ...opciones,
});

for (const venta of contaminadas) {
  resumen.ejemplos.push({
    tipo: "flag_contaminado",
    venta: venta.numero_comprobante,
    fecha: venta.fecha,
    manual: venta.saldo_actualizado_manual,
    automatico: venta.saldo_actual,
  });

  if (aplicar) {
    await venta.update({ saldo_actualizado_manual: null }, opciones);
  }
  resumen.flag_manual_contaminado += 1;
}

const manuales = await Venta.count({
  where: { saldo_actualizado_manual: { [Op.ne]: null }, saldo_origen: "manual" },
  ...opciones,
});
resumen.flag_manual_conservado = manuales;

// 2) Backfill de ventas sin snapshot automatico.
//
// Se reconstruye hacia atras desde el ClientePago mas antiguo del cliente que
// tenga saldo_anterior registrado: ese es el unico ancla fiable de la cadena.
const clientes = await Cliente.findAll({ attributes: ["id", "nombre"], ...opciones });

for (const cliente of clientes) {
  const ventas = await Venta.findAll({
    where: { clienteId: cliente.id },
    order: [["createdAt", "ASC"], ["id", "ASC"]],
    ...opciones,
  });
  if (ventas.length === 0) continue;

  const necesitaBackfill = ventas.some((venta) => venta.saldo_actual === null || venta.saldo_actual === undefined);
  if (!necesitaBackfill) continue;

  const pagos = await ClientePago.findAll({
    where: { clienteId: cliente.id },
    order: [["createdAt", "ASC"], ["id", "ASC"]],
    ...opciones,
  });

  const pagosConSaldo = pagos.filter((pago) => pago.saldo_anterior !== null && pago.saldo_anterior !== undefined);
  const pagosConSaldoYOrdenados = pagosConSaldo.length > 0;

  const creditoPorVenta = new Map();
  const ventaIds = ventas.map((venta) => venta.id);
  const pagosVenta = ventaIds.length > 0
    ? await VentaPago.findAll({
        where: {
          ventaId: { [Op.in]: ventaIds },
          medio_pago: "cuenta_corriente",
        },
        ...opciones,
      })
    : [];
  for (const pago of pagosVenta) {
    creditoPorVenta.set(
      pago.ventaId,
      redondear((creditoPorVenta.get(pago.ventaId) || 0) + toNum(pago.monto))
    );
  }

  const saldoInicial = pagosConSaldoYOrdenados ? toNum(pagosConSaldo[0].saldo_anterior) : 0;
  const anclado = pagosConSaldoYOrdenados;

  let saldoCorriente = saldoInicial;

  for (const venta of ventas) {
    const faltaAnterior = venta.saldo_anterior === null || venta.saldo_anterior === undefined;
    const faltaActual = venta.saldo_actual === null || venta.saldo_actual === undefined;

    if (faltaAnterior || faltaActual) {
      const credito = creditoPorVenta.get(venta.id) || 0;
      const sobrante = toNum(venta.monto_sobrante);
      const deudaPagada = toNum(venta.monto_deuda_pagado);
      const variacion = redondear(credito - sobrante - deudaPagada);

      const saldoAnteriorVenta = saldoCorriente;
      const saldoActualVenta = Math.max(0, redondear(saldoCorriente + variacion));

      if (!anclado && ventas.length > 1) {
        resumen.ventas_sin_referencia.push({
          cliente: cliente.nombre,
          venta: venta.numero_comprobante,
          fecha: venta.fecha,
        });
      }

      if (aplicar) {
        await venta.update(
          {
            ...(faltaAnterior ? { saldo_anterior: saldoAnteriorVenta.toFixed(2) } : {}),
            ...(faltaActual ? { saldo_actual: saldoActualVenta.toFixed(2) } : {}),
          },
          opciones
        );
      }

      if (resumen.ejemplos.length < 40) {
        resumen.ejemplos.push({
          tipo: "backfill_venta",
          cliente: cliente.nombre,
          venta: venta.numero_comprobante,
          fecha: venta.fecha,
          credito: credito,
          variacion: variacion,
          saldo_anterior: saldoAnteriorVenta,
          saldo_actual: saldoActualVenta,
        });
      }

      resumen.ventas_reconstruidas += 1;
      saldoCorriente = saldoActualVenta;
    }
  }

  const pagosSinSaldo = pagos.filter((pago) => pago.saldo_anterior === null || pago.saldo_anterior === undefined);
  for (const pago of pagosSinSaldo) {
    if (aplicar) {
      await pago.update(
        {
          saldo_anterior: saldoCorriente.toFixed(2),
          saldo_actual: Math.max(0, redondear(saldoCorriente - toNum(pago.monto))).toFixed(2),
        },
        opciones
      );
    }
    resumen.pagos_reconstruidos += 1;
  }
}

// 3) Vinculacion de pagos incluidos en venta.
//
// Historicamente el vinculo se detectaba buscando el texto "incluido en venta"
// en las notas. Se reemplaza por la columna ventaOrigenId, que se llena
// emparejando el pago con la venta del mismo cliente y monto registrada el
// mismo dia. Los pagos que no emparejan se dejan sin vincular y se reportan.
const pagosSinVincular = await ClientePago.findAll({
  where: { ventaOrigenId: { [Op.is]: null } },
  attributes: ["id", "clienteId", "monto", "fecha", "hora"],
  ...opciones,
});

for (const pago of pagosSinVincular) {
  const candidatas = await Venta.findAll({
    where: {
      clienteId: pago.clienteId,
      fecha: pago.fecha,
      monto_deuda_pagado: redondear(pago.monto).toFixed(2),
    },
    attributes: ["id", "numero_comprobante", "fecha"],
    ...opciones,
  });

  if (candidatas.length === 1) {
    if (aplicar) {
      await pago.update({ ventaOrigenId: candidatas[0].id }, opciones);
    }
    resumen.pagos_vinculados += 1;
  } else {
    resumen.pagos_ambiguos.push({
      pagoId: pago.id,
      clienteId: pago.clienteId,
      monto: pago.monto,
      fecha: pago.fecha,
      candidatas: candidatas.length,
    });
  }
}

console.log(JSON.stringify(resumen, null, 2));

if (aplicar) {
  await transaction.commit();
  console.log("Backfill aplicado. Verifica los totales antes de continuar.");
} else {
  console.log("Dry-run completo. Revisa el diff y ejecuta con --aplicar.");
}

await sequelize.close();
