import type { components } from '../api/generado/esquema'
import { formatearPorcentaje } from './formato'
import { diaRelativo, fechaCorta, formatearHora, momento } from './tiempo'
import type { EstadoServicio } from './estados'

export type PropuestaIngesta = components['schemas']['PropuestaIngestaRespuesta']
export type SaludColector = components['schemas']['SaludColectorRespuesta']
export type DocumentoFallido = components['schemas']['DocumentoFallidoRespuesta']

/** panel-veedor.md: con 3 fallos seguidos, un colector se considera caído. */
export const FALLOS_PARA_CAIDO = 3

export type AccionIngesta = 'aprobar' | 'descartar' | 'anular'

export type CitaDe = { tipo: 'con-cita'; texto: string } | { tipo: 'sin-cita' }

/**
 * La frase del boletín tal como llegó. Nunca se rellena ni se resume: sin ella no hay evidencia (ética de datos nº 4) y la pantalla lo dice.
 */
export function citaDe(propuesta: PropuestaIngesta): CitaDe {
  const texto = propuesta.citaTextual
  return typeof texto === 'string' && texto.trim() !== '' ? { tipo: 'con-cita', texto } : { tipo: 'sin-cita' }
}

export type FuenteDe =
  | { tipo: 'enlace'; url: string; sitio: string }
  | { tipo: 'sin-enlace' }
  | { tipo: 'no-es-web'; texto: string }

/** Solo `http` y `https` se abren; cualquier otra cosa se muestra como texto, sin ser un enlace. */
export function fuenteDe(propuesta: Pick<PropuestaIngesta, 'urlOriginal'>): FuenteDe {
  const valor = propuesta.urlOriginal
  if (typeof valor !== 'string' || valor.trim() === '') return { tipo: 'sin-enlace' }
  try {
    const url = new URL(valor.trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') return { tipo: 'enlace', url: url.href, sitio: url.hostname.replace(/^www\./, '') }
  } catch {
    // Se cae al texto de abajo.
  }
  return { tipo: 'no-es-web', texto: valor }
}

export type EstadoDeRevision = 'PENDIENTE' | 'APROBADA' | 'DESCARTADA' | 'ANULADA'

const REVISIONES: Record<EstadoDeRevision, string> = {
  PENDIENTE: 'Pendiente de revisión',
  APROBADA: 'Aprobada',
  DESCARTADA: 'Descartada',
  ANULADA: 'Anulada',
}

export function esEstadoDeRevision(valor: unknown): valor is EstadoDeRevision {
  return typeof valor === 'string' && valor in REVISIONES
}

export function revisionEnPalabras(estado: string | undefined): string {
  return esEstadoDeRevision(estado) ? REVISIONES[estado] : 'Estado de revisión desconocido'
}

/** `GET /propuestas` devuelve solo las pendientes; una resuelta llega aquí desde la respuesta de su propia decisión. */
export function estaPendiente(propuesta: PropuestaIngesta): boolean {
  return propuesta.estadoRevision === 'PENDIENTE'
}

/** Qué se puede hacer con una propuesta según su estado y su evidencia; lo demás no se ofrece. */
export function accionesDe(propuesta: PropuestaIngesta): { aprobar: boolean; descartar: boolean; anular: boolean } {
  const pendiente = estaPendiente(propuesta)
  return {
    aprobar: pendiente && citaDe(propuesta).tipo === 'con-cita',
    descartar: pendiente,
    anular: propuesta.estadoRevision === 'APROBADA',
  }
}

const ESTADOS_PROPUESTOS: Record<EstadoServicio, string> = {
  SIN_SERVICIO: 'Sin servicio',
  PRESION_BAJA: 'Presión baja',
  CORTE_PROGRAMADO: 'Corte programado',
  CON_SERVICIO: 'Con servicio',
}

export function esEstadoServicio(valor: unknown): valor is EstadoServicio {
  return typeof valor === 'string' && valor in ESTADOS_PROPUESTOS
}

/** El estado que propone la fuente, o `null` si el servidor mandó uno que esta versión no conoce (no se inventa). */
export function estadoPropuestoDe(propuesta: PropuestaIngesta): EstadoServicio | null {
  return esEstadoServicio(propuesta.estadoPropuesto) ? propuesta.estadoPropuesto : null
}

export function estadoPropuestoEnPalabras(propuesta: PropuestaIngesta): string {
  const estado = estadoPropuestoDe(propuesta)
  return estado ? ESTADOS_PROPUESTOS[estado] : (propuesta.estadoPropuesto || 'Estado sin nombre')
}

/** Lo que dice el boletín sobre cuándo: la ventana declarada, o que no la declara (no se estima, ADR-006). */
export function ventanaEnPalabras(propuesta: PropuestaIngesta, ahora: Date): string {
  const { inicioDeclarado: inicio, finPrometido: fin } = propuesta
  if (inicio && fin) return `Declara que empieza ${momento(inicio, ahora)} y termina ${momento(fin, ahora)}`
  if (inicio) return `Declara que empieza ${momento(inicio, ahora)}, sin hora de fin`
  if (fin) return `Declara que termina ${momento(fin, ahora)}, sin hora de inicio`
  return 'No declara una ventana horaria.'
}

/** La confianza ordena la cola; no publica nada. Se dice como lo que es: un porcentaje de la evidencia que halló el extractor. */
export function confianzaEnPalabras(confianza: number | undefined): string | null {
  if (typeof confianza !== 'number' || !Number.isFinite(confianza)) return null
  return `Confianza ${formatearPorcentaje(Math.min(1, Math.max(0, confianza)) * 100)}`
}

/** Antes de aprobar: lo que pasa, y qué no está garantizado. */
export function confirmacionIngesta(accion: AccionIngesta, propuesta: PropuestaIngesta, barrio: string): { pregunta: string; boton: string; enviando: string } {
  switch (accion) {
    case 'aprobar':
      return {
        pregunta: `Al aprobarla, «${estadoPropuestoEnPalabras(propuesta)}» se aplica a ${barrio} y el evento queda en la bitácora pública con la frase del boletín.${
          propuesta.inicioDeclarado ? '' : ' Esta propuesta no declara ventana horaria: el estado del barrio puede quedar como está.'
        }`,
        boton: 'Sí, aprobar',
        enviando: 'Aprobando…',
      }
    case 'descartar':
      return {
        pregunta: `No toca ${barrio}: la propuesta se archiva como descartada y no se borra.`,
        boton: 'Sí, descartar',
        enviando: 'Descartando…',
      }
    case 'anular':
      return { pregunta: '', boton: 'Sí, anular la aprobación', enviando: 'Anulando…' }
  }
}

export interface ConsecuenciaDeAprobar {
  /** El barrio ya muestra el estado que proponía la propuesta. */
  coincide: boolean
  /** Lo que el servidor dice ahora del barrio; `null` es «sin datos verificados». */
  estadoActual: EstadoServicio | null
}

/** Aprobar responde 200 aunque el mapa no cambie: se compara con lo que el servidor dice ahora del barrio. */
export function consecuenciaDeAprobar(propuesta: PropuestaIngesta, estadoActual: string | null | undefined): ConsecuenciaDeAprobar {
  const actual = esEstadoServicio(estadoActual) ? estadoActual : null
  const propuesto = estadoPropuestoDe(propuesta)
  return { coincide: propuesto !== null && propuesto === actual, estadoActual: actual }
}

export type SaludDeColector = 'sin-ciclos' | 'activo' | 'con-fallos' | 'caido'

export function saludDe(colector: SaludColector): SaludDeColector {
  const fallos = colector.fallosConsecutivos ?? 0
  if (fallos >= FALLOS_PARA_CAIDO) return 'caido'
  if (fallos > 0) return 'con-fallos'
  if (!colector.ultimaEjecucionExitosa && !colector.ultimoFallo) return 'sin-ciclos'
  return 'activo'
}

const SALUD: Record<SaludDeColector, string> = {
  'sin-ciclos': 'Sin ciclos todavía',
  activo: 'Activo',
  'con-fallos': 'Con fallos',
  caido: 'Caído',
}

export function saludEnPalabras(salud: SaludDeColector): string {
  return SALUD[salud]
}

/** Los caídos primero, luego los que fallan: lo que pide atención va arriba. */
export function ordenarPorSalud(colectores: readonly SaludColector[]): SaludColector[] {
  const peso: Record<SaludDeColector, number> = { caido: 0, 'con-fallos': 1, 'sin-ciclos': 2, activo: 3 }
  return [...colectores].sort((a, b) => peso[saludDe(a)] - peso[saludDe(b)] || (a.nombre ?? '').localeCompare(b.nombre ?? ''))
}

export function tasaDeErrorEnPalabras(tasa: number | undefined): string {
  if (typeof tasa !== 'number' || !Number.isFinite(tasa)) return 'Sin dato'
  return formatearPorcentaje(Math.min(1, Math.max(0, tasa)) * 100)
}

/** Los fallos seguidos como cifra; sin ninguno, la palabra. */
export function fallosEnPalabras(colector: SaludColector): string {
  const fallos = colector.fallosConsecutivos ?? 0
  return fallos === 0 ? 'Ninguno' : String(fallos)
}

/** «10:01 p. m.» hoy, «ayer 4:16 p. m.» o «29 oct 4:16 p. m.»: corta para una cifra pequeña; o que nunca ocurrió, sin inventar fecha. */
export function ultimaVezEnPalabras(valor: string | null | undefined, ahora: Date, nunca: string): string {
  if (!valor) return nunca
  const dia = diaRelativo(valor, ahora)
  const hora = formatearHora(valor)
  if (dia === 'hoy') return hora
  if (dia === 'ayer') return `ayer ${hora}`
  return `${fechaCorta(valor, ahora)} ${hora}`
}
