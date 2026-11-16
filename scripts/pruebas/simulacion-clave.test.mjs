import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claveAleatoria } from '../simulacion/lib/acciones.mjs';

// La misma regla que `ClaveEnClaro` (ADR-115). Sin la mayúscula y el signo asegurados, casi la mitad de las claves al azar
// eran rechazadas y el guion completo abortaba al preparar el panel.
const cumpleLaPolitica = (clave) =>
  clave.length >= 9 && clave.length <= 128 && Buffer.byteLength(clave) <= 72 && clave.trim() === clave
  && /\p{Lu}/u.test(clave) && /[^\p{L}\p{N}\s]/u.test(clave);

test('debeGenerarSiempreClavesQueElBackendAcepta', () => {
  for (let i = 0; i < 5000; i++) {
    const clave = claveAleatoria();
    assert.ok(cumpleLaPolitica(clave), `clave rechazada por la política: ${clave}`);
  }
});

test('debeGenerarClavesDistintasCadaVez', () => {
  const claves = new Set(Array.from({ length: 1000 }, claveAleatoria));
  assert.equal(claves.size, 1000);
});
