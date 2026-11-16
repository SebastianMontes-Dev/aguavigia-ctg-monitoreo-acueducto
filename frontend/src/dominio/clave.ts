export const CLAVE_MINIMA = 9
export const CLAVE_MAXIMA = 128
const BYTES_MAXIMOS = 72

/** El texto de ayuda de los campos de clave nueva, para que todas las pantallas digan la misma regla. */
export const AYUDA_CLAVE = `Al menos ${CLAVE_MINIMA} caracteres, una mayúscula y un signo como # o !.`

/**
 * La política de `ClaveEnClaro` (ADR-115): de 9 a 128 caracteres, una mayúscula, un signo (lo que no es letra, cifra ni
 * espacio), sin espacios al principio o al final y no más de 72 bytes en UTF-8. El servidor la vuelve a aplicar: si algo
 * se escapa aquí, su `detail` se muestra tal cual.
 */
export function validarClaveNueva(nueva: string, actual?: string): string | null {
  const caracteres = [...nueva]
  if (caracteres.length < CLAVE_MINIMA) return `Usa al menos ${CLAVE_MINIMA} caracteres.`
  if (caracteres.length > CLAVE_MAXIMA) return `Usa como máximo ${CLAVE_MAXIMA} caracteres.`
  if (new TextEncoder().encode(nueva).length > BYTES_MAXIMOS) return 'La clave es demasiado larga: usa menos caracteres o menos letras con tilde.'
  if (nueva.trim() !== nueva) return 'Quita los espacios del principio o del final.'
  if (!/\p{Lu}/u.test(nueva)) return 'Añade al menos una letra mayúscula.'
  if (!/[^\p{L}\p{N}\s]/u.test(nueva)) return 'Añade al menos un signo, como # o !.'
  if (actual !== undefined && nueva === actual) return 'La clave nueva debe ser distinta de la actual.'
  return null
}
