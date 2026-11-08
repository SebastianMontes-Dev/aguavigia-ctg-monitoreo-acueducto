import type { components } from './generado/esquema'
import type { UbicacionCompartida } from '../app/ubicacion'
import { api, normalizarError } from './cliente'
import { camposRechazados } from './cuentas'
import { interpretarIngreso, type ResultadoIngreso } from './panel'
import { sesionVecino } from './sesion-vecino'

type Cliente = typeof api

export type PerfilVecino = components['schemas']['PerfilVecinoRespuesta']
type SesionVecino = components['schemas']['SesionVecino']

export type ResultadoIngresoVecino = Exclude<ResultadoIngreso, { tipo: 'pide-codigo' }>

export type ResultadoPerfil =
  | { tipo: 'guardado'; perfil: PerfilVecino }
  | { tipo: 'rechazado'; mensaje: string; campos: Record<string, string> }
  | { tipo: 'conflicto' }
  | { tipo: 'sesion-terminada' }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'sin-red' }
  | { tipo: 'fallo' }

export type ResultadoVerificacion =
  | { tipo: 'verificado'; perfil: PerfilVecino }
  | { tipo: 'fuera-del-barrio' }
  | { tipo: 'imprecisa' }
  | { tipo: 'agotado'; segundos: number | null }
  | { tipo: 'conflicto' }
  | { tipo: 'sesion-terminada' }
  | { tipo: 'sin-red' }
  | { tipo: 'fallo' }

export interface CambiosPerfil { nombre?: string; barrioId?: string; recibirAvisos?: boolean }

/**
 * Nunca se reintenta solo: cada intento fallido cuenta para el bloqueo de la cuenta. La sesión del vecino es otra que la del panel
 * (otro almacén y otro token), y una cuenta del panel recibe aquí la misma `401` que ante una clave mala.
 */
export async function iniciarSesionVecino(correo: string, clave: string, cliente: Cliente = api): Promise<ResultadoIngresoVecino> {
  let resultado: ReturnType<typeof interpretarIngreso>
  try {
    const { data, error, response } = await cliente.POST('/api/vecino/sesion', { body: { correo, clave } })
    resultado = interpretarIngreso(response, data ?? error)
  } catch {
    resultado = interpretarIngreso(null, null)
  }
  if (resultado.tipo === 'sesion') {
    const token = (resultado.sesion as SesionVecino).token
    if (!token) return { tipo: 'fallo' }
    sesionVecino.guardar(token)
    return { tipo: 'ingresado', alcance: 'COMPLETO' }
  }
  // Un 401 de segundo factor no existe aquí: si llegara, se trata como cualquier otra credencial.
  return resultado.tipo === 'pide-codigo' ? { tipo: 'credencial-invalida' } : resultado
}

/** Aunque falle la petición, este navegador olvida el token; el servidor revoca todas las sesiones de la cuenta, no solo esta. */
export async function cerrarSesionVecino(cliente: Cliente = api): Promise<void> {
  try {
    await cliente.POST('/api/vecino/sesion/cierre')
  } catch {
    // Sin red la sesión sigue viva en el servidor hasta que caduque; aquí se borra igual.
  } finally {
    sesionVecino.limpiar()
  }
}

export async function consultarPerfil({ signal }: { signal?: AbortSignal } = {}, cliente: Cliente = api): Promise<PerfilVecino> {
  const { data, error, response } = await cliente.GET('/api/vecino/yo', { signal })
    .catch(() => ({ data: undefined, error: undefined, response: null }))
  if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
  return data
}

export function interpretarPerfil(respuesta: Response | null, cuerpo: unknown): ResultadoPerfil {
  if (respuesta === null) return { tipo: 'sin-red' }
  if (respuesta.status === 200) return { tipo: 'guardado', perfil: cuerpo as PerfilVecino }
  const error = normalizarError(respuesta, cuerpo)
  if (respuesta.status === 401) return { tipo: 'sesion-terminada' }
  if (respuesta.status === 409) return { tipo: 'conflicto' }
  if (respuesta.status === 400) return { tipo: 'rechazado', mensaje: error.mensaje, campos: camposRechazados(error.problema) }
  if (respuesta.status === 429) return { tipo: 'esperar', segundos: error.segundosParaReintentar }
  return { tipo: 'fallo' }
}

/** Solo se aplica lo que viene: un campo ausente no se toca. Cambiar de barrio anula la verificación (cuentas-y-sesion.md). */
export async function actualizarPerfil(cambios: CambiosPerfil, cliente: Cliente = api): Promise<ResultadoPerfil> {
  try {
    const { data, error, response } = await cliente.PATCH('/api/vecino/perfil', { body: cambios })
    return interpretarPerfil(response, data ?? error)
  } catch {
    return interpretarPerfil(null, null)
  }
}

export function interpretarVerificacion(respuesta: Response | null, cuerpo: unknown): ResultadoVerificacion {
  if (respuesta === null) return { tipo: 'sin-red' }
  if (respuesta.status === 200) return { tipo: 'verificado', perfil: cuerpo as PerfilVecino }
  const error = normalizarError(respuesta, cuerpo)
  if (respuesta.status === 401) return { tipo: 'sesion-terminada' }
  if (respuesta.status === 409) return { tipo: 'conflicto' }
  if (error.tipo === 'ubicacion-fuera-del-barrio') return { tipo: 'fuera-del-barrio' }
  if (error.tipo === 'ubicacion-imprecisa') return { tipo: 'imprecisa' }
  // Los 3 intentos al día se agotan con la misma 429 que el tope por IP: aquí el `Retry-After` dice cuánto falta (horas).
  if (respuesta.status === 429) return { tipo: 'agotado', segundos: error.segundosParaReintentar }
  return { tipo: 'fallo' }
}

/** La coordenada se usa y se descarta en el servidor: aquí tampoco se guarda en ninguna parte. */
export async function verificarBarrio(ubicacion: UbicacionCompartida, cliente: Cliente = api): Promise<ResultadoVerificacion> {
  try {
    const { data, error, response } = await cliente.POST('/api/vecino/verificacion-barrio', {
      body: { coordenada: ubicacion.coordenada, precisionMetros: ubicacion.precisionMetros },
    })
    return interpretarVerificacion(response, data ?? error)
  } catch {
    return interpretarVerificacion(null, null)
  }
}
