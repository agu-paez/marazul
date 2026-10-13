import assert from "node:assert/strict";
import { aplicarDeltaSaldo, calcularDeltaManual } from "../utils/saldoBase.js";

// --- Regla A: el delta consume el favor registrado en esa venta, no el de dias posteriores ---
{
  // Cliente debe 800, tiene 200 de favor QUE SI EXISTIA en la venta editada.
  // El saldo de esa venta pasa de 800 a 1200: delta +400.
  const r = aplicarDeltaSaldo({ pendiente: 800, favor: 200, delta: 400, favorConsumible: 200 });
  assert.equal(r.favor_consumido, 200, "debe consumir los 200 de favor de esa venta");
  assert.equal(r.saldo_favor, "0.00", "el favor de esa venta se agota");
  assert.equal(r.saldo_pendiente, "1000.00", "800 + 400 - 200");
}

// --- Regla A: favor generado despues NO se consume retroactivamente ---
{
  // Cliente debe 800 y tiene 500 de favor que todavia NO existia en la venta editada.
  const r = aplicarDeltaSaldo({ pendiente: 800, favor: 500, delta: 300, favorConsumible: 0 });
  assert.equal(r.favor_consumido, 0, "no toca el favor posterior");
  assert.equal(r.saldo_favor, "500.00", "el favor posterior se conserva intacto");
  assert.equal(r.saldo_pendiente, "1100.00", "todo el delta va a deuda");
}

// --- El saldo a favor jamas se descarta ---
{
  const r = aplicarDeltaSaldo({ pendiente: 100, favor: 250, delta: 50, favorConsumible: 250 });
  assert.equal(r.saldo_favor, "200.00", "reduce favor, no lo deja en cero");
  assert.equal(r.saldo_pendiente, "100.00");
}

// --- Reducir deuda: primero contra deuda, el excedente pasa a favor ---
{
  const r = aplicarDeltaSaldo({ pendiente: 500, favor: 0, delta: -800 });
  assert.equal(r.saldo_pendiente, "0.00");
  assert.equal(r.saldo_favor, "300.00");
}

// --- Idempotencia: delta cero no toca nada ---
{
  const r = aplicarDeltaSaldo({ pendiente: 640.25, favor: 12.75, delta: 0 });
  assert.equal(r.saldo_pendiente, "640.25");
  assert.equal(r.saldo_favor, "12.75");
  assert.equal(r.favor_consumido, 0);
}

// --- Delta manual relativo al valor vigente: reeditar no duplica ---
{
  // Primera edicion: base = snapshot de la venta (800), se sube a 1200.
  let baseVigente = 800;
  assert.equal(calcularDeltaManual({ saldoActualizado: 1200, saldoBase: baseVigente }), 400);

  // Tras guardar, el valor vigente pasa a ser saldo_actualizado_manual (1200).
  baseVigente = 1200;
  assert.equal(calcularDeltaManual({ saldoActualizado: 1200, saldoBase: baseVigente }), 0, "reeditar el mismo valor no aplica delta");
  assert.equal(calcularDeltaManual({ saldoActualizado: 900, saldoBase: baseVigente }), -300, "bajar saldo resta deuda");
}

// --- Secuencia de reedicion tras propagacion: base = valor ya propagado ---
{
  // Venta editada: 800 -> 1200, delta 400.
  const deltaEditado = calcularDeltaManual({ saldoActualizado: 1200, saldoBase: 800 });
  assert.equal(deltaEditado, 400);

  // Venta siguiente con snapshot anterior (neto) 1000: la propagacion la sube.
  const propagada = aplicarDeltaSaldo({ pendiente: 1000, favor: 0, delta: deltaEditado });
  assert.equal(propagada.saldo_pendiente, "1400.00");

  // Reeditarla al mismo valor: la base es el snapshot ya propagado (1400).
  assert.equal(calcularDeltaManual({ saldoActualizado: 1400, saldoBase: 1400 }), 0);
}

// --- Delta por cambio de precio de producto ---
{
  const r = aplicarDeltaSaldo({ pendiente: 300, favor: 0, delta: 500 });
  assert.equal(r.saldo_pendiente, "800.00");
  assert.equal(r.saldo_favor, "0.00");
}

// --- Precision decimal estable ---
{
  let pendiente = 0;
  let favor = 0;
  for (let i = 0; i < 1000; i++) {
    const r = aplicarDeltaSaldo({ pendiente, favor, delta: 0.1, favorConsumible: favor });
    pendiente = Number(r.saldo_pendiente);
    favor = Number(r.saldo_favor);
  }
  assert.ok(Math.abs(pendiente - 100) < 0.05, `acumulacion estable, obtenido ${pendiente}`);
}

console.log("OK - reglas de saldo verificadas");
console.log("  A: favor de la venta se consume, favor posterior se respeta");
console.log("  delta manual relativo al valor vigente (idempotente al reeditar)");
console.log("  precision decimal estable en 1000 operaciones");
