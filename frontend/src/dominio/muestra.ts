import { formatearNumero } from './formato'

/** ADR-105: con menos cortes que esto, las cifras se muestran con su cantidad, pero sin veredicto, tendencia ni «el día con más». */
export const MUESTRA_SUFICIENTE = 5

export function muestraSuficiente(cortes: number): boolean {
  return cortes >= MUESTRA_SUFICIENTE
}

/** «Con 1 corte cerrado todavía no se puede sacar una conclusión: hacen falta al menos 5.» */
export function conclusionPendiente(cortes: number, adjetivo: 'cerrado' | 'registrado'): string {
  const cuantos = `${formatearNumero(cortes)} ${cortes === 1 ? `corte ${adjetivo}` : `cortes ${adjetivo}s`}`
  return `Con ${cuantos} todavía no se puede sacar una conclusión: hacen falta al menos ${formatearNumero(MUESTRA_SUFICIENTE)}.`
}
