import { duracionEnPalabras } from './tiempo'

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const

export interface DiaConCortes {
  dia: typeof DIAS_SEMANA[number]
  cortes: number | null
}

export function ordenarDias(cortesPorDia: Record<string, number> | undefined): DiaConCortes[] {
  return DIAS_SEMANA.map((dia) => ({ dia, cortes: cortesPorDia?.[dia] ?? null }))
}

interface DatosDisponibilidad {
  sectoresMasAfectados?: readonly unknown[]
  cortesPorDiaDeSemana?: Record<string, number>
  duracionPromedioHoras?: number | null
}

export function disponibilidadEstadisticas(datos: DatosDisponibilidad) {
  const totalCortes = Object.values(datos.cortesPorDiaDeSemana ?? {}).reduce((total, cantidad) => total + cantidad, 0)
  // El backend devuelve 0.0 cuando todavía no hay cortes cerrados para calcular la media.
  const duracionMedible = datos.duracionPromedioHoras != null && datos.duracionPromedioHoras > 0
    ? datos.duracionPromedioHoras : null
  return {
    totalCortes,
    duracionMedible,
    vacioGeneral: (datos.sectoresMasAfectados?.length ?? 0) === 0 && totalCortes === 0,
  }
}

/** `identidad.md` §4.1: el titular es la respuesta, con la cifra en palabras (DESIGN.md §5). Sin duración medida, titula la pregunta. */
export function titularEstadisticas(duracionHoras: number | null): string {
  if (duracionHoras === null) return 'Cuándo hay cortes en Cartagena'
  return `Un corte dura ${duracionEnPalabras(duracionHoras * 3_600_000)} en promedio`
}

/** Si todos los barrios de la lista tienen la misma cantidad, se dice con una frase en vez de dibujar barras iguales (ADR-104). */
export function empateDeBarrios(cantidades: readonly (number | null)[]): number | null {
  if (cantidades.length < 2 || cantidades.some((cantidad) => cantidad === null)) return null
  return cantidades.every((cantidad) => cantidad === cantidades[0]) ? cantidades[0] ?? null : null
}

export interface DiasExtremos {
  dias: string[]
  cortes: number
}

/** Los días con más (o menos) cortes, con empates. Nulo si no hay ningún día con dato o si todos empatan. */
export function diasExtremos(dias: readonly DiaConCortes[], criterio: 'mas' | 'menos'): DiasExtremos | null {
  const conDato = dias.filter((dia): dia is DiaConCortes & { cortes: number } => dia.cortes !== null)
  if (!conDato.length) return null
  const valores = conDato.map((dia) => dia.cortes)
  const objetivo = criterio === 'mas' ? Math.max(...valores) : Math.min(...valores)
  if (Math.max(...valores) === Math.min(...valores)) return null
  return { dias: conDato.filter((dia) => dia.cortes === objetivo).map((dia) => dia.dia), cortes: objetivo }
}

export function listaDeDias(dias: readonly string[]): string {
  const nombres = dias.map((dia, indice) => (indice === 0 ? dia : dia.toLowerCase()))
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0] ?? ''
}
