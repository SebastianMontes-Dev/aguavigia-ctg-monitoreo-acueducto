import type { components } from '../api/generado/esquema'
import { estaAbierto, type Corte } from './cortes'
import { instanteDesdeCartagena } from './hora-cartagena'
import { claveDiaCartagena, fechaCorta, formatearHora } from './tiempo'

export type SolicitudCorte = components['schemas']['SolicitudCorte']

export interface BorradorAlta {
  barrios: readonly string[]
  inicio: string
  fin: string
  causa: string
}

export interface ErroresAlta {
  barrios?: string
  inicio?: string
  fin?: string
  causa?: string
}

/** Un minuto de margen: el campo llega al minuto y el reloj de quien escribe puede ir unos segundos adelantado. */
const TOLERANCIA_MS = 60_000

/**
 * panel-veedor.md: `400` si `finPrometido` es anterior a `inicio` o algún barrio no existe. Se dice antes de enviar; el servidor
 * decide al final. Un corte que ya empezó es válido (los barrios pasan a «sin servicio»), por eso el inicio puede ser pasado.
 */
export function validarAlta(borrador: BorradorAlta): { errores: ErroresAlta; solicitud: SolicitudCorte | null } {
  const errores: ErroresAlta = {}
  if (borrador.barrios.length === 0) errores.barrios = 'Elige al menos un barrio.'
  const inicio = borrador.inicio ? instanteDesdeCartagena(borrador.inicio) : null
  const fin = borrador.fin ? instanteDesdeCartagena(borrador.fin) : null
  if (!inicio) errores.inicio = borrador.inicio ? 'Escribe una fecha y hora que existan.' : 'Escribe cuándo empieza el corte.'
  if (!fin) errores.fin = borrador.fin ? 'Escribe una fecha y hora que existan.' : 'Escribe hasta cuándo prometen el corte.'
  if (inicio && fin && Date.parse(fin) <= Date.parse(inicio)) errores.fin = 'El fin prometido debe ser posterior al inicio.'
  const causa = borrador.causa.trim()
  if (!causa) errores.causa = 'Escribe la causa que dio la fuente.'
  if (Object.keys(errores).length > 0 || !inicio || !fin) return { errores, solicitud: null }
  return { errores, solicitud: { sectoresAfectados: [...borrador.barrios], inicio, finPrometido: fin, causa } }
}

/**
 * La hora real de un cierre: no puede ser anterior al inicio del corte ni estar en el futuro. Devuelve el instante UTC o el
 * texto del error junto al campo.
 */
export function validarHoraCierre(valor: string, corte: Corte, ahora: Date): { instante: string; error?: never } | { error: string; instante?: never } {
  if (!valor) return { error: 'Escribe a qué hora volvió el agua.' }
  const instante = instanteDesdeCartagena(valor)
  if (!instante) return { error: 'Escribe una fecha y hora que existan.' }
  if (corte.inicio && Date.parse(instante) < Date.parse(corte.inicio)) return { error: 'La hora real no puede ser anterior al inicio del corte.' }
  if (Date.parse(instante) > ahora.getTime() + TOLERANCIA_MS) return { error: 'La hora real no puede estar en el futuro.' }
  return { instante }
}

/** Los barrios del corte cuyo cierre aún no existe: los que «cerrar todos» cerraría. */
export function barriosPendientes(corte: Corte): string[] {
  const cerrados = new Set((corte.cierres ?? []).map((cierre) => cierre.sectorId))
  return (corte.sectoresAfectados ?? []).filter((barrio) => !cerrados.has(barrio))
}

/** panel-veedor.md: solo un corte aún abierto admite cierres; un corte `EXPIRADO`, `RESTABLECIDO` o `ANULADO` no. */
export function admiteCierres(corte: Corte): boolean {
  return estaAbierto(corte) && barriosPendientes(corte).length > 0
}

/** Un corte ya anulado no se anula otra vez (`409`); cualquier otro se puede corregir. */
export function admiteAnulacion(corte: Corte): boolean {
  return corte.estado !== 'ANULADO'
}

/** Los cierres que los vecinos pusieron y que un veedor aún no confirma. */
export function cierresProvisionales(corte: Corte) {
  return (corte.cierres ?? []).filter((cierre) => cierre.provisional === true)
}

export type RazonVencido = 'promesa-vencida' | 'cierre-provisional'

/**
 * `GET /api/veedor/cortes/vencidos` mezcla dos colas: la promesa vencida sin ningún cierre y los cierres provisionales por
 * confirmar. Un corte con las dos cosas se lee primero por lo provisional, que es lo que el veedor puede resolver ya.
 */
export function razonDeVencido(corte: Corte): RazonVencido {
  return cierresProvisionales(corte).length > 0 ? 'cierre-provisional' : 'promesa-vencida'
}

const ESTADOS_CORTE: Record<string, string> = {
  ANUNCIADO: 'Anunciado',
  CONFIRMADO: 'Confirmado',
  RESTABLECIDO: 'Restablecido',
  EXPIRADO: 'Expirado',
  ANULADO: 'Anulado',
}

/** Estado del corte en palabras. No lleva color: los colores de estado son del servicio de agua, no de un trámite. */
export function estadoDeCorteEnPalabras(estado: string | undefined): string {
  return (estado && ESTADOS_CORTE[estado]) ?? 'Sin estado'
}

/** «dom 25 oct · 8:00 a. m. a 4:00 p. m.»; si acaba otro día, el día de cada extremo. Siempre en la hora de Cartagena. */
export function ventanaEnPalabras(inicio: string | undefined, fin: string | undefined, ahora: Date): string {
  if (!inicio || !fin) return 'Sin horario registrado'
  if (claveDiaCartagena(inicio) === claveDiaCartagena(fin)) {
    return `${fechaCorta(inicio, ahora)} · ${formatearHora(inicio)} a ${formatearHora(fin)}`
  }
  return `${fechaCorta(inicio, ahora)} ${formatearHora(inicio)} a ${fechaCorta(fin, ahora)} ${formatearHora(fin)}`
}

/** «Manga», «Manga y Bocagrande» o «Manga, Bocagrande y 2 más»: hasta `maximo` barrios con su nombre y el resto contado. */
export function barriosEnPalabras(ids: readonly string[] | undefined, nombreDe: (id: string) => string, maximo = 2): string {
  const nombres = (ids ?? []).map(nombreDe)
  if (nombres.length === 0) return 'Sin barrios'
  if (nombres.length <= maximo) return nombres.length === 1 ? nombres[0] ?? '' : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
  return `${nombres.slice(0, maximo).join(', ')} y ${nombres.length - maximo} más`
}
