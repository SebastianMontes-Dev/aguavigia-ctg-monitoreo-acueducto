export const CLAVE_MINIMA = 12
export const CLAVE_MAXIMA = 128
const BYTES_MAXIMOS = 72

/**
 * Política de cuentas-y-sesion.md: de 12 a 128 caracteres y no más de 72 bytes en UTF-8. Aquí solo se adelanta lo que se puede
 * saber sin el servidor; «sin repetir demasiado los mismos caracteres» la decide el servidor y su `detail` se muestra tal cual.
 */
export function validarClaveNueva(nueva: string, actual?: string): string | null {
  if ([...nueva].length < CLAVE_MINIMA) return `Usa al menos ${CLAVE_MINIMA} caracteres.`
  if ([...nueva].length > CLAVE_MAXIMA) return `Usa como máximo ${CLAVE_MAXIMA} caracteres.`
  if (new TextEncoder().encode(nueva).length > BYTES_MAXIMOS) return 'La clave es demasiado larga: usa menos caracteres o menos letras con tilde.'
  if (actual !== undefined && nueva === actual) return 'La clave nueva debe ser distinta de la actual.'
  return null
}
