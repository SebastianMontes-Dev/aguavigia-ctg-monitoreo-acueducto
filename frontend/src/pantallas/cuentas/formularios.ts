/** ADR-105: el error del correo, o null. El formato lo juzga el navegador (`type="email"`); el backend vuelve a validarlo. */
export function errorDeCorreo(entrada: HTMLInputElement | null, correo: string): string | null {
  if (!correo.trim()) return 'Escribe tu correo.'
  if (entrada?.validity.typeMismatch) return 'Revisa el correo: debe tener la forma nombre@correo.com.'
  return null
}
