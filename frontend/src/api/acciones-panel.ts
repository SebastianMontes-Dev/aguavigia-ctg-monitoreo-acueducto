import { normalizarError } from './cliente'

/** Lo que una acción del panel puede responder; se reacciona por el código y el `type`, nunca por el texto del servidor. */
export type ResultadoAccion<T> =
  | { tipo: 'hecho'; dato: T }
  | { tipo: 'no-existe' }
  | { tipo: 'conflicto' }
  | { tipo: 'rechazado'; mensaje: string }
  | { tipo: 'sin-permiso' }
  | { tipo: 'sesion-terminada' }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'sin-red' }
  | { tipo: 'fallo' }

export function interpretarAccion<T>(respuesta: Response | null, cuerpo: unknown): ResultadoAccion<T> {
  if (respuesta === null) return { tipo: 'sin-red' }
  if (respuesta.ok) return { tipo: 'hecho', dato: cuerpo as T }
  const error = normalizarError(respuesta, cuerpo)
  switch (respuesta.status) {
    case 400: return { tipo: 'rechazado', mensaje: error.mensaje }
    case 401: return { tipo: 'sesion-terminada' }
    case 403: return { tipo: 'sin-permiso' }
    case 404: return { tipo: 'no-existe' }
    case 409: return { tipo: 'conflicto' }
    case 429: return { tipo: 'esperar', segundos: error.segundosParaReintentar }
    default: return { tipo: 'fallo' }
  }
}

interface RespuestaCliente {
  data?: unknown
  error?: unknown
  response: Response
}

/** Cada acción se manda una vez: no se reintenta sola, porque un `PATCH` repetido puede responder `409` sobre lo que sí se hizo. */
export async function ejecutarAccion<T>(llamada: () => Promise<RespuestaCliente>): Promise<ResultadoAccion<T>> {
  try {
    const { data, error, response } = await llamada()
    return interpretarAccion<T>(response, data ?? error)
  } catch {
    return interpretarAccion<T>(null, null)
  }
}

/** Una lectura del panel: falla con el `ErrorApi` normalizado, que las consultas usan para decidir si reintentan. */
export async function leerDelPanel<T>(llamada: () => Promise<RespuestaCliente>): Promise<{ dato: T; respuesta: Response }> {
  const resultado = await llamada().catch(() => null)
  if (!resultado || !resultado.response.ok || resultado.data === undefined) {
    throw normalizarError(resultado?.response ?? null, resultado?.error)
  }
  return { dato: resultado.data as T, respuesta: resultado.response }
}
