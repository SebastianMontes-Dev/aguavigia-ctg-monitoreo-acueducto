import { normalizarError, tipoDeProblema } from './cliente'

export type ResultadoRestablecimiento =
  | { tipo: 'recibido' }
  | { tipo: 'enlace-invalido' }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'sin-red' }
  | { tipo: 'fallo' }

/** Por `type` y no por texto (errores-y-limites.md); un 400 es un enlace sin token y se trata igual que uno que ya no sirve. */
export async function interpretarRestablecimiento(respuesta: Response | null): Promise<ResultadoRestablecimiento> {
  if (respuesta === null) return { tipo: 'sin-red' }
  if (respuesta.status === 201) return { tipo: 'recibido' }
  if (respuesta.status === 429) return { tipo: 'esperar', segundos: normalizarError(respuesta, null).segundosParaReintentar }
  if (respuesta.status === 400) return { tipo: 'enlace-invalido' }
  if (respuesta.status === 403) {
    const tipo = tipoDeProblema(await respuesta.clone().json().catch(() => null))
    return tipo === 'enlace-invalido' || tipo === null ? { tipo: 'enlace-invalido' } : { tipo: 'fallo' }
  }
  return { tipo: 'fallo' }
}

/**
 * «¿Ya volvió el agua?» (correos-y-enlaces.md): sin sesión ni `X-Dispositivo`, porque al vecino lo identifica el token del
 * correo. Se llama solo al pulsar el botón, nunca al abrir la página: los clientes de correo abren los enlaces solos.
 */
export async function confirmarRestablecimiento(sectorId: string, token: string): Promise<ResultadoRestablecimiento> {
  try {
    const respuesta = await fetch(`/api/sectores/${encodeURIComponent(sectorId)}/restablecimiento?token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { Accept: 'application/json' },
    })
    return await interpretarRestablecimiento(respuesta)
  } catch {
    return interpretarRestablecimiento(null)
  }
}
