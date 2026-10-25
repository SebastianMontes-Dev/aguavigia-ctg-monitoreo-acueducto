import type { components } from '../api/generado/esquema'
import { formatearNumero, formatearPorcentaje } from './formato'

export type Indice = components['schemas']['IndiceCumplimientoRespuesta']
export type PuntoSerie = components['schemas']['PuntoSerieRespuesta']
export type Calidad = components['schemas']['CalidadDelCumplimientoRespuesta']

function contar(cantidad: number, singular: string, plural: string): string {
  return `${formatearNumero(cantidad)} ${cantidad === 1 ? singular : plural}`
}

/**
 * F4: el índice es tan sólido como lo que lo sostiene. Junto al número se declara, solo si es más que cero, cuántos
 * cierres podrían corregirse todavía y qué cortes quedaron fuera; no se esconde ni se cuenta a favor o en contra.
 */
export function solidezIndice(indice: Pick<Indice, 'porcentajeProvisional' | 'cortesSinCierreConfirmado' | 'cortesAnulados'>): string[] {
  const frases: string[] = []
  const provisional = indice.porcentajeProvisional ?? 0
  if (provisional > 0) frases.push(`El ${formatearPorcentaje(provisional)} de los cierres solo lo reportaron vecinos y aún puede corregirse.`)
  const sinCierre = indice.cortesSinCierreConfirmado ?? 0
  const anulados = indice.cortesAnulados ?? 0
  const fuera = [
    sinCierre > 0 ? `${contar(sinCierre, 'corte vencido', 'cortes vencidos')} sin cierre confirmado` : '',
    anulados > 0 ? (sinCierre > 0 ? contar(anulados, 'anulado', 'anulados') : contar(anulados, 'corte anulado', 'cortes anulados')) : '',
  ].filter(Boolean)
  if (fuera.length) frases.push(`${fuera.length === 1 && (sinCierre || anulados) === 1 ? 'Queda' : 'Quedan'} fuera ${fuera.join(' y ')}.`)
  return frases
}

/** Cuando el índice da 400 no hay un solo cierre que medir; la calidad dice con cifras qué hay en su lugar. */
export function faltanteEnPalabras(calidad: Calidad | undefined): string | null {
  if (!calidad) return null
  const sinCierre = calidad.cortesSinCierreConfirmado ?? 0
  const anulados = calidad.cortesAnulados ?? 0
  const frases = [
    sinCierre > 0 ? `Hay ${contar(sinCierre, 'corte vencido', 'cortes vencidos')} sin cierre confirmado: nadie confirmó cuándo volvió el agua.` : '',
    anulados > 0 ? `${contar(anulados, 'corte se anuló', 'cortes se anularon')} por error.` : '',
  ].filter(Boolean)
  return frases.length ? frases.join(' ') : null
}

export function indiceCompleto(indice: Indice | undefined): indice is Indice & {
  duracionPrometidaSegundos: number
  duracionRealSegundos: number
  desviacionSegundos: number
  porcentajeCumplimiento: number
} {
  return !!indice && Number.isFinite(indice.duracionPrometidaSegundos)
    && Number.isFinite(indice.duracionRealSegundos) && Number.isFinite(indice.desviacionSegundos)
    && Number.isFinite(indice.porcentajeCumplimiento)
}

export function conclusionCumplimiento(indice: Indice): string | null {
  if (!indiceCompleto(indice)) return null
  const diferencia = indice.desviacionSegundos
  if (diferencia === 0) return 'En total, los cortes cerrados duraron lo anunciado.'
  return `En total, los cortes cerrados duraron ${duracionAcumulada(Math.abs(diferencia))} ${diferencia > 0 ? 'más' : 'menos'} de lo anunciado.`
}

/** Las duraciones de un día o más omiten minutos; las menores conservan horas y minutos. */
export function duracionAcumulada(segundos: number): string {
  const minutos = Math.round(Math.abs(segundos) / 60)
  const dias = Math.floor(minutos / 1440)
  const horas = Math.floor((minutos % 1440) / 60)
  const resto = dias ? 0 : minutos % 60
  const partes = [
    dias ? `${formatearNumero(dias)} ${dias === 1 ? 'día' : 'días'}` : '',
    horas ? `${formatearNumero(horas)} ${horas === 1 ? 'hora' : 'horas'}` : '',
    resto ? `${formatearNumero(resto)} ${resto === 1 ? 'minuto' : 'minutos'}` : '',
  ].filter(Boolean)
  return partes.length ? partes.join(' y ') : '0 minutos'
}

/** Duración de un solo corte, en la forma corta que se lee de un vistazo: «24 h 21 min», «45 min», «3 días 2 h». */
export function duracionCorta(segundos: number): string {
  const minutos = Math.round(Math.abs(segundos) / 60)
  if (minutos < 60) return `${formatearNumero(minutos)} min`
  const horas = Math.floor(minutos / 60)
  if (horas >= 48) {
    const dias = Math.floor(horas / 24)
    const resto = horas % 24
    return resto ? `${formatearNumero(dias)} días ${resto} h` : `${formatearNumero(dias)} días`
  }
  const resto = minutos % 60
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

/** Por debajo de este margen por corte, la diferencia no cambia el veredicto (`ADR-079`). */
export const UMBRAL_VEREDICTO_SEGUNDOS = 5 * 60

export type Veredicto = 'antes' | 'a-tiempo' | 'despues'

export function veredicto(diferenciaPorCorte: number): Veredicto {
  if (diferenciaPorCorte >= UMBRAL_VEREDICTO_SEGUNDOS) return 'despues'
  if (diferenciaPorCorte <= -UMBRAL_VEREDICTO_SEGUNDOS) return 'antes'
  return 'a-tiempo'
}

// ADR-104: en palabras del vecino, que espera el agua a una hora; no en duraciones de cortes.
const FRASE_VEREDICTO: Record<Veredicto, string> = {
  antes: 'el agua vuelve antes de la hora anunciada',
  'a-tiempo': 'el agua vuelve a la hora anunciada',
  despues: 'el agua vuelve más tarde de la hora anunciada',
}

/** El titular de la página es la respuesta (`identidad.md` §4.1). */
export function titularVeredicto(diferenciaPorCorte: number, barrio?: string): string {
  const frase = FRASE_VEREDICTO[veredicto(diferenciaPorCorte)]
  return barrio ? `En ${barrio}, ${frase}` : frase.charAt(0).toUpperCase() + frase.slice(1)
}

/** «33 min tarde», «54 min antes» o «A la hora»: cuándo volvió el agua frente a la hora anunciada (ADR-104). */
export function diferenciaEnPalabras(segundos: number): string {
  if (Math.round(Math.abs(segundos) / 60) === 0) return 'A la hora'
  return `${duracionCorta(segundos)} ${segundos > 0 ? 'tarde' : 'antes'}`
}

/** La frase bajo la cifra grande: «El agua vuelve 7 minutos antes de la hora anunciada, en promedio.» */
export function respuestaEnPalabras(segundos: number): string {
  const minutos = Math.round(Math.abs(segundos) / 60)
  if (minutos === 0) return 'En promedio, el agua vuelve a la hora anunciada.'
  const cuanto = minutos < 60
    ? `${formatearNumero(minutos)} ${minutos === 1 ? 'minuto' : 'minutos'}`
    : duracionAcumulada(Math.abs(segundos))
  return `El agua vuelve ${cuanto} ${segundos > 0 ? 'más tarde de' : 'antes de'} la hora anunciada, en promedio.`
}

/** Escala de la línea de tiempo: una hora a cada lado de la hora anunciada. Lo que se pase queda en el extremo. */
export const ESCALA_LINEA_SEGUNDOS = 3600

/** Posición del punto en la línea, de 0 (una hora antes) a 100 (una hora tarde); 50 es la hora anunciada. */
export function posicionEnLinea(segundos: number, escala = ESCALA_LINEA_SEGUNDOS): number {
  return 50 + Math.max(-1, Math.min(1, segundos / escala)) * 50
}

/** El índice es `min(100, prometido / real)`: se explica en la misma línea, nunca como puntaje suelto. */
export function significadoIndice(porcentaje: number): string {
  return porcentaje >= 100
    ? 'duraron lo anunciado o menos'
    : `lo anunciado cubrió el ${formatearPorcentaje(porcentaje)} de lo que duraron`
}

export interface ResumenCumplimiento {
  cortes: number
  prometidoPorCorte: number
  realPorCorte: number
  diferenciaPorCorte: number
  porcentaje: number
  primerMes?: string
  ultimoMes?: string
}

/**
 * El índice no trae cuántos cortes suma; la serie sin filtros agrupa los mismos cortes cerrados
 * (`CalcularCumplimientoService`), así que el conteo y el periodo salen de ella (`ADR-079`).
 */
export function resumirCumplimiento(indice: Indice | undefined, serie: readonly PuntoSerie[] | undefined): ResumenCumplimiento | null {
  if (!indiceCompleto(indice) || !serie) return null
  const ordenada = ordenarSerie(serie)
  const cortes = ordenada.reduce((total, punto) => total + (punto.cantidadCortes ?? 0), 0)
  if (cortes <= 0) return null
  return {
    cortes,
    prometidoPorCorte: indice.duracionPrometidaSegundos / cortes,
    realPorCorte: indice.duracionRealSegundos / cortes,
    diferenciaPorCorte: indice.desviacionSegundos / cortes,
    porcentaje: indice.porcentajeCumplimiento,
    primerMes: ordenada[0]?.periodo,
    ultimoMes: ordenada.at(-1)?.periodo,
  }
}

export function diferenciaMensualPorCorte(punto: PuntoSerie): number | null {
  if (!punto.cantidadCortes || punto.desviacionSegundos === undefined) return null
  return punto.desviacionSegundos / punto.cantidadCortes
}

export function ordenarSerie(serie: readonly PuntoSerie[]): PuntoSerie[] {
  return [...serie].sort((a, b) => (a.periodo ?? '').localeCompare(b.periodo ?? ''))
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function partesMes(periodo?: string): { mes: string; anio: string } | null {
  const partes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodo ?? '')
  return partes?.[1] && partes[2] ? { mes: MESES[Number(partes[2]) - 1] ?? '', anio: partes[1] } : null
}

export function mesEnPalabras(periodo?: string): string {
  const partes = partesMes(periodo)
  return partes ? `${partes.mes} de ${partes.anio}` : 'Mes sin fecha'
}

/** «mayo a julio de 2026», «diciembre de 2025 a julio de 2026» o un solo mes. */
export function periodoEnPalabras(primero?: string, ultimo?: string): string | null {
  const inicio = partesMes(primero)
  const fin = partesMes(ultimo)
  if (!inicio || !fin) return null
  if (primero === ultimo) return `${fin.mes} de ${fin.anio}`
  return inicio.anio === fin.anio ? `${inicio.mes} a ${fin.mes} de ${fin.anio}` : `${inicio.mes} de ${inicio.anio} a ${fin.mes} de ${fin.anio}`
}
