import type { components } from '../api/generado/esquema'
import { duracionEnPalabras } from './tiempo'

export type Corte = components['schemas']['CorteRespuesta']

// ADR-006: solo se atribuye lo que el origen sostiene. INGESTA_IA es una propuesta del colector que un veedor aprobó.
const ORIGENES: Record<string, string> = {
  OFICIAL_ACUACAR: 'Aviso oficial de Acuacar',
  VEEDOR: 'Registrado por un veedor',
  INGESTA_IA: 'Tomado de una publicación y aprobado por un veedor',
}

export function origenEnPalabras(origen: string | undefined): string | null {
  return origen ? ORIGENES[origen] ?? null : null
}

export type Cierre = components['schemas']['CierreRespuesta']

// ADR-006 y OrigenEstado (cambios-para-frontend F1): `fuente` de cierres y eventos tiene cinco valores y ninguno se inventa.
const FUENTES: Record<string, string> = {
  ACUACAR: 'Aviso oficial de Acuacar',
  PRENSA: 'Nota de prensa aprobada por un veedor',
  VEEDOR: 'Registrado por un veedor',
  VECINOS: 'Reportes de vecinos',
  SENSOR: 'Un sensor de la red',
}

/** `SENSOR` existe en el contrato pero no se produce: basta un texto genérico. Un valor desconocido no se atribuye. */
export function fuenteEnPalabras(fuente: string | null | undefined): string | null {
  return fuente ? FUENTES[fuente] ?? null : null
}

/** Estados en los que el corte ya no está abierto; EXPIRADO y ANULADO, además, no tienen hora real. */
const SIN_HORA_REAL: ReadonlySet<string> = new Set(['EXPIRADO', 'ANULADO'])
const TERMINADOS: ReadonlySet<string> = new Set(['RESTABLECIDO', ...SIN_HORA_REAL])

/** El cierre de un barrio: un corte se restablece barrio por barrio y los pendientes no aparecen en `cierres[]`. */
export function cierreDe(corte: Corte, sectorId: string): Cierre | undefined {
  return corte.cierres?.find((cierre) => cierre.sectorId === sectorId)
}

/**
 * La hora real del corte en un barrio es su cierre; la del corte entero es el último cierre y solo existe cuando todos
 * sus barrios cerraron. Un corte EXPIRADO o ANULADO no tiene hora real aunque algún barrio haya llegado a cerrar.
 */
export function horaReal(corte: Corte, sectorId?: string): string | null {
  if (corte.estado && SIN_HORA_REAL.has(corte.estado)) return null
  if (sectorId) return cierreDe(corte, sectorId)?.hora ?? null
  if (corte.estado !== 'RESTABLECIDO') return null
  const horas = (corte.cierres ?? []).flatMap((cierre) => (cierre.hora ? [cierre.hora] : []))
  return horas.reduce<string | null>((ultima, hora) => (ultima === null || Date.parse(hora) > Date.parse(ultima) ? hora : ultima), null)
}

/** `true` si el cierre de ese barrio lo sostienen solo vecinos y un veedor o un boletín aún no lo confirma. */
export function cierreProvisional(corte: Corte, sectorId: string): boolean {
  return cierreDe(corte, sectorId)?.provisional === true
}

/** Con `sectorId`, abierto para ese barrio: un corte de varios barrios sigue abierto aunque este ya haya cerrado. */
export function estaAbierto(corte: Corte, sectorId?: string): boolean {
  if (corte.estado && TERMINADOS.has(corte.estado)) return false
  return !(sectorId && cierreDe(corte, sectorId))
}

export function estaCerrado(corte: Corte, sectorId?: string): boolean {
  return Boolean(corte.inicio && corte.finPrometido && horaReal(corte, sectorId))
}

/** Lo que se dice de un corte que nunca tuvo hora real; `null` si no es de esos. */
export function sinHoraRealEnPalabras(corte: Corte): string | null {
  if (corte.estado === 'EXPIRADO') return 'Nadie confirmó el restablecimiento; no cuenta en el Índice.'
  if (corte.estado === 'ANULADO') {
    return corte.motivoAnulacion ? `Publicado por error: ${corte.motivoAnulacion}` : 'Publicado por error.'
  }
  return null
}

export function promesaVencida(corte: Corte, ahora: Date, sectorId?: string): boolean {
  return estaAbierto(corte, sectorId) && Boolean(corte.finPrometido) && new Date(corte.finPrometido!).getTime() < ahora.getTime()
}

export interface Comparacion {
  /** Verdadero si el cierre solo lo sostienen los vecinos: «por confirmar». */
  provisional: boolean
  prometidoMs: number
  realMs: number
  prometido: string
  real: string
  diferencia: string
}

/** Guía §5.2: la diferencia se dice en palabras; «Terminó X antes» cuando duró menos de lo prometido. */
export function compararCorte(corte: Corte, sectorId?: string): Comparacion | null {
  const fin = horaReal(corte, sectorId)
  if (!fin || !estaCerrado(corte, sectorId)) return null
  const inicio = new Date(corte.inicio!).getTime()
  const prometidoMs = new Date(corte.finPrometido!).getTime() - inicio
  const realMs = new Date(fin).getTime() - inicio
  if (prometidoMs <= 0 || realMs < 0) return null
  const exceso = realMs - prometidoMs
  const diferencia = Math.abs(exceso) < 15 * 60_000 ? 'Duró lo prometido'
    : exceso > 0 ? `Se pasó ${duracionEnPalabras(exceso)}` : `Terminó ${duracionEnPalabras(exceso)} antes`
  const provisional = sectorId ? cierreProvisional(corte, sectorId) : (corte.cierres ?? []).some((cierre) => cierre.provisional)
  return { provisional, prometidoMs, realMs, prometido: duracionEnPalabras(prometidoMs), real: duracionEnPalabras(realMs), diferencia }
}
