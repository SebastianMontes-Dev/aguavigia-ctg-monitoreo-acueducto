import { api, normalizarError, type Problema } from './cliente'

type Cliente = typeof api

/** La respuesta de pedir algo por correo (`202`): se dice igual exista o no la cuenta, así que aquí solo hay éxito o un problema del envío. */
export type ResultadoSolicitud =
  | { tipo: 'recibido' }
  | { tipo: 'rechazado'; mensaje: string; campos: Record<string, string> }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'sin-red' }
  | { tipo: 'fallo' }

export interface DatosAcceso { correo: string; nombre: string; clave: string }
export interface DatosVecino { correo: string; nombre: string; barrioId: string; privacidad: boolean; avisos: boolean }

/**
 * errores-y-limites.md: un `400` de validación trae `errores`, una lista de `"campo: mensaje"`. Se reparten por campo para
 * mostrar cada uno junto al suyo; lo que no trae campo conocido se queda en el `detail` del formulario.
 */
export function camposRechazados(problema: Problema | null): Record<string, string> {
  const errores = problema?.errores
  if (!Array.isArray(errores)) return {}
  const campos: Record<string, string> = {}
  for (const linea of errores) {
    if (typeof linea !== 'string') continue
    const corte = linea.indexOf(':')
    if (corte <= 0) continue
    // Un campo anidado llega como «consentimiento.privacidad»: se queda con el último tramo.
    const campo = linea.slice(0, corte).trim().split('.').pop() ?? ''
    campos[campo] ??= linea.slice(corte + 1).trim()
  }
  return campos
}

export function interpretarSolicitud(respuesta: Response | null, cuerpo: unknown): ResultadoSolicitud {
  // Sin respuesta la solicitud pudo haber llegado: no se presenta como recibida ni como no enviada.
  if (respuesta === null) return { tipo: 'sin-red' }
  if (respuesta.status === 202) return { tipo: 'recibido' }
  const error = normalizarError(respuesta, cuerpo)
  if (respuesta.status === 400) return { tipo: 'rechazado', mensaje: error.mensaje, campos: camposRechazados(error.problema) }
  if (respuesta.status === 429) return { tipo: 'esperar', segundos: error.segundosParaReintentar }
  return { tipo: 'fallo' }
}

/** Ninguna se reintenta sola: cada petición cuenta para el tope de 10 cada 10 minutos de `/api/cuentas/**`. */
async function enviar(llamada: () => Promise<{ data?: unknown; error?: unknown; response: Response }>): Promise<ResultadoSolicitud> {
  try {
    const { data, error, response } = await llamada()
    return interpretarSolicitud(response, data ?? error)
  } catch {
    return interpretarSolicitud(null, null)
  }
}

export function solicitarAcceso(datos: DatosAcceso, cliente: Cliente = api): Promise<ResultadoSolicitud> {
  return enviar(() => cliente.POST('/api/cuentas/registro', { body: datos }))
}

export function pedirRestablecimiento(correo: string, cliente: Cliente = api): Promise<ResultadoSolicitud> {
  return enviar(() => cliente.POST('/api/cuentas/restablecimiento', { body: { correo } }))
}

export function reenviarVerificacion(correo: string, cliente: Cliente = api): Promise<ResultadoSolicitud> {
  return enviar(() => cliente.POST('/api/cuentas/verificacion/reenvio', { body: { correo } }))
}

/** Sin clave: la elige quien abre el enlace del correo (cuentas-y-sesion.md, «Vecino registrado»). */
export function registrarVecino(datos: DatosVecino, cliente: Cliente = api): Promise<ResultadoSolicitud> {
  return enviar(() => cliente.POST('/api/cuentas/vecino', {
    body: {
      correo: datos.correo,
      nombre: datos.nombre,
      barrioId: datos.barrioId,
      consentimiento: { privacidad: datos.privacidad, avisos: datos.avisos },
    },
  }))
}
