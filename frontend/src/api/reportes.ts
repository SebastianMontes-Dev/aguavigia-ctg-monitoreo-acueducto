import type { components } from './generado/esquema'
import type { UbicacionCompartida } from '../app/ubicacion'
import { api, normalizarError, tipoDeProblema } from './cliente'
import { obtenerDispositivo, renovarDispositivo, type ResultadoDispositivo } from './dispositivo'

export type TipoReporte = 'SIN_AGUA' | 'PRESION_BAJA' | 'SERVICIO_RESTABLECIDO'
export type Reporte = components['schemas']['ReporteRespuesta']

export type ResultadoEnvio =
  | { tipo: 'recibido'; reporte: Reporte }
  | { tipo: 'sin-red' }
  | { tipo: 'incierto' }
  | { tipo: 'cupo-agotado' }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'rechazado'; mensaje: string }
  | { tipo: 'fallo' }

export type ResultadoConfirmacion =
  | { tipo: 'confirmado'; reporte: Reporte }
  | { tipo: 'no-disponible' }
  | { tipo: 'sin-red' }
  | { tipo: 'incierto' }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'rechazado'; mensaje: string }
  | { tipo: 'fallo' }

export type FotoEstado = 'SIN_FOTO' | 'EN_REVISION' | 'PUBLICA' | 'DESCARTADA'

export type ResultadoFoto =
  | { tipo: 'recibida'; estado: FotoEstado | null }
  | { tipo: 'muy-grande' }
  | { tipo: 'formato-no-permitido' }
  | { tipo: 'sin-permiso' }
  | { tipo: 'ya-tiene-foto' }
  | { tipo: 'no-valida'; mensaje: string }
  | { tipo: 'fallo' }

type SinIdentidad = Exclude<ResultadoDispositivo, { tipo: 'listo' }>
type ConIdentidad = { tipo: 'respuesta'; respuesta: Response; cuerpo: unknown } | SinIdentidad

/**
 * `POST /api/reportes` y `/confirmar` exigen el token de dispositivo. Ante `401 dispositivo-invalido` no se contó nada,
 * así que pedir otro token y reintentar una vez no duplica el reporte (docs/api/reportes.md).
 */
async function conIdentidad(enviar: (token: string) => Promise<{ respuesta: Response; cuerpo: unknown }>): Promise<ConIdentidad> {
  let dispositivo = await obtenerDispositivo()
  for (let intento = 0; ; intento++) {
    if (dispositivo.tipo !== 'listo') return dispositivo
    const { respuesta, cuerpo } = await enviar(dispositivo.token)
    const invalido = respuesta.status === 401 && tipoDeProblema(cuerpo) === 'dispositivo-invalido'
    if (!invalido || intento === 1) return { tipo: 'respuesta', respuesta, cuerpo }
    dispositivo = await renovarDispositivo()
  }
}

/** Guía §6.2: cada respuesta tiene su mensaje; se decide por `type`, nunca por el texto del error. */
export function interpretarEnvio(respuesta: Response | null, cuerpo: unknown): ResultadoEnvio {
  // Sin respuesta, la petición pudo haber llegado: no se presenta como recibido ni como no enviado.
  if (respuesta === null) return { tipo: 'incierto' }
  if (respuesta.status === 201) return { tipo: 'recibido', reporte: cuerpo as Reporte }
  const error = normalizarError(respuesta, cuerpo)
  if (error.tipo === 'limite-reportes-excedido') return { tipo: 'cupo-agotado' }
  if (respuesta.status === 429) return { tipo: 'esperar', segundos: error.segundosParaReintentar }
  if (respuesta.status === 400) return { tipo: 'rechazado', mensaje: error.mensaje }
  return { tipo: 'fallo' }
}

/** Nunca se reintenta solo (plan §6.4): un POST repetido contaría dos veces al mismo vecino. */
export async function enviarReporte(
  sectorId: string,
  tipo: TipoReporte,
  ubicacion: UbicacionCompartida | null = null,
  enLinea: () => boolean = () => navigator.onLine,
): Promise<ResultadoEnvio> {
  if (!enLinea()) return { tipo: 'sin-red' }
  // Sin `precisionMetros` el servidor no verifica la ubicación (docs/api/reportes.md): va siempre con la coordenada.
  const cuerpo = ubicacion
    ? { tipo, sectorId, coordenada: ubicacion.coordenada, precisionMetros: ubicacion.precisionMetros }
    : { tipo, sectorId }
  try {
    const resultado = await conIdentidad(async (token) => {
      const { data, error, response } = await api.POST('/api/reportes', { body: cuerpo, headers: { 'X-Dispositivo': token } })
      return { respuesta: response, cuerpo: data ?? error }
    })
    if (resultado.tipo !== 'respuesta') return resultado
    return interpretarEnvio(resultado.respuesta, resultado.cuerpo)
  } catch {
    return interpretarEnvio(null, null)
  }
}

/** Un `404` es igual si el reporte no existe o si moderación lo descartó: para quien confirma, ya no cuenta. */
export function interpretarConfirmacion(respuesta: Response | null, cuerpo: unknown): ResultadoConfirmacion {
  if (respuesta === null) return { tipo: 'incierto' }
  if (respuesta.status === 200) return { tipo: 'confirmado', reporte: cuerpo as Reporte }
  if (respuesta.status === 404) return { tipo: 'no-disponible' }
  const error = normalizarError(respuesta, cuerpo)
  if (respuesta.status === 429) return { tipo: 'esperar', segundos: error.segundosParaReintentar }
  if (respuesta.status === 400) return { tipo: 'rechazado', mensaje: error.mensaje }
  return { tipo: 'fallo' }
}

/** Se envía solo cuando la persona lo pide: abrir el enlace no confirma nada (guía §5.1). */
export async function confirmarReporte(
  reporteId: string,
  enLinea: () => boolean = () => navigator.onLine,
): Promise<ResultadoConfirmacion> {
  if (!enLinea()) return { tipo: 'sin-red' }
  try {
    const resultado = await conIdentidad(async (token) => {
      const { data, error, response } = await api.POST('/api/reportes/{id}/confirmar', {
        params: { path: { id: reporteId } },
        headers: { 'X-Dispositivo': token },
      })
      return { respuesta: response, cuerpo: data ?? error }
    })
    if (resultado.tipo !== 'respuesta') return resultado
    return interpretarConfirmacion(resultado.respuesta, resultado.cuerpo)
  } catch {
    return interpretarConfirmacion(null, null)
  }
}

const ESTADOS_FOTO: readonly string[] = ['SIN_FOTO', 'EN_REVISION', 'PUBLICA', 'DESCARTADA']

/** Se decide por `type` y estado HTTP, nunca por el texto: el servidor distingue cada rechazo de la foto. */
export function interpretarFoto(respuesta: Response | null, cuerpo: unknown): ResultadoFoto {
  if (respuesta === null) return { tipo: 'fallo' }
  if (respuesta.ok) {
    const estado = (cuerpo as Reporte | null)?.fotoEstado
    return { tipo: 'recibida', estado: estado && ESTADOS_FOTO.includes(estado) ? estado as FotoEstado : null }
  }
  const error = normalizarError(respuesta, cuerpo)
  if (respuesta.status === 413) return { tipo: 'muy-grande' }
  if (error.tipo === 'formato-no-permitido') return { tipo: 'formato-no-permitido' }
  if (error.tipo === 'subida-no-autorizada') return { tipo: 'sin-permiso' }
  if (respuesta.status === 409) return { tipo: 'ya-tiene-foto' }
  if (respuesta.status === 400) return { tipo: 'no-valida', mensaje: error.mensaje }
  return { tipo: 'fallo' }
}

// WebP se rechaza con 415: no se le puede quitar el EXIF (docs/api/reportes.md).
export const TIPOS_FOTO = ['image/jpeg', 'image/png']
export const MAXIMO_FOTO_BYTES = 10 * 1024 * 1024

/** `subidaToken` es el de la respuesta de crear el reporte: un solo uso, vence a los 10 minutos. */
export async function enviarFoto(reporteId: string, foto: File, subidaToken: string): Promise<ResultadoFoto> {
  if (foto.size > MAXIMO_FOTO_BYTES) return { tipo: 'muy-grande' }
  const formulario = new FormData()
  formulario.append('foto', foto)
  try {
    // openapi-fetch serializaría el cuerpo como JSON: el multipart va con fetch y el navegador pone el boundary.
    const respuesta = await fetch(`/api/reportes/${encodeURIComponent(reporteId)}/foto`, {
      method: 'POST',
      body: formulario,
      headers: { 'X-Subida': subidaToken },
    })
    return interpretarFoto(respuesta, await respuesta.json().catch(() => null))
  } catch {
    return { tipo: 'fallo' }
  }
}
