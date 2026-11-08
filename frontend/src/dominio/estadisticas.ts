import { mesEnPalabras, ordenarSerie, type PuntoSerie } from './cumplimiento'
import { formatearNumero } from './formato'
import { FILTRO_TIPO, type TipoBitacora } from './historia'
import { muestraSuficiente } from './muestra'
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

/** Con menos de 5 cortes se muestran las cantidades, pero la bajada no saca conclusiones (ADR-105). */
export const SIN_CONCLUSION = 'Aún sin conclusión'

export const GRAFICAS = ['dia', 'duracion', 'cierres', 'novedades'] as const
export type Grafica = typeof GRAFICAS[number]

export const NOMBRE_GRAFICA: Record<Grafica, string> = {
  dia: 'Por día',
  duracion: 'Duración',
  cierres: 'Cierres',
  novedades: 'Novedades',
}

export const cantidadDeCortes = (cantidad: number) => `${formatearNumero(cantidad)} ${cantidad === 1 ? 'corte' : 'cortes'}`
export const cantidadDeCierres = (cantidad: number) => `${formatearNumero(cantidad)} ${cantidad === 1 ? 'cierre' : 'cierres'}`

const MESES_VISIBLES = 6
const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/

export interface MesConCierres {
  periodo: string
  cierres: number | null
  segundosPorCierre: number | null
}

function mesSiguiente(periodo: string): string {
  const anio = Number(periodo.slice(0, 4))
  const mes = Number(periodo.slice(5))
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`
}

/**
 * Los últimos meses, con su duración por cierre. La serie solo trae los meses con cierres: los del medio que faltan se
 * rellenan sin dato para que dos meses separados no se dibujen juntos, como si fueran seguidos.
 */
export function mesesConCierres(serie: readonly PuntoSerie[]): MesConCierres[] {
  const puntos = new Map(ordenarSerie(serie).flatMap((punto) => (punto.periodo && PERIODO.test(punto.periodo) ? [[punto.periodo, punto] as const] : [])))
  const periodos = [...puntos.keys()]
  const ultimo = periodos.at(-1)
  if (!ultimo) return []
  const meses: MesConCierres[] = []
  let periodo = periodos[0] ?? ultimo
  while (periodo <= ultimo) {
    const punto = puntos.get(periodo)
    const cierres = punto?.cantidadCortes ?? null
    const segundosPorCierre = cierres && punto?.duracionRealSegundos !== undefined ? punto.duracionRealSegundos / cierres : null
    meses.push({ periodo, cierres, segundosPorCierre })
    periodo = mesSiguiente(periodo)
  }
  return meses.slice(-MESES_VISIBLES)
}

/** El mes que se resalta y se nombra: uno con pocos cierres no es conclusión, por alta que sea su cifra (ADR-105). */
export function mesDestacado(meses: readonly MesConCierres[], medida: (mes: MesConCierres) => number | null): MesConCierres | null {
  return meses
    .filter((mes) => mes.cierres !== null && muestraSuficiente(mes.cierres) && medida(mes) !== null)
    .reduce<MesConCierres | null>((mayor, mes) => (mayor === null || (medida(mes) ?? 0) > (medida(mayor) ?? 0) ? mes : mayor), null)
}

export function mesCorto(periodo: string): string {
  const nombre = mesEnPalabras(periodo)
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1, 3)}`
}

const aHorasEnteras = (segundos: number) => Math.round(segundos / 3600) * 3_600_000

/** «28 horas», redondeado como el titular; por debajo de media hora se dice en minutos. */
export function horasEnPalabras(segundos: number): string {
  return duracionEnPalabras(segundos < 1800 ? segundos * 1000 : aHorasEnteras(segundos))
}

/** «28 h», lo que cabe encima de una columna. */
export function horasCortas(segundos: number): string {
  return segundos < 1800 ? `${formatearNumero(Math.round(segundos / 60))} min` : `${formatearNumero(Math.round(segundos / 3600))} h`
}

export function resumenDeSerie(serie: readonly PuntoSerie[]): { cierres: number; segundosPorCierre: number | null } {
  const cierres = serie.reduce((total, punto) => total + (punto.cantidadCortes ?? 0), 0)
  const segundos = serie.reduce((total, punto) => total + (punto.duracionRealSegundos ?? 0), 0)
  return { cierres, segundosPorCierre: cierres ? segundos / cierres : null }
}

export interface Novedad {
  tipo: TipoBitacora
  nombre: string
  eventos: number | null
}

/** De más a menos; un tipo sin dato va al final, sin hacerse pasar por cero. */
export function novedadesPorTipo(conteos: Record<TipoBitacora, number | null>): Novedad[] {
  return (Object.keys(FILTRO_TIPO) as TipoBitacora[])
    .map((tipo) => ({ tipo, nombre: FILTRO_TIPO[tipo], eventos: conteos[tipo] }))
    .sort((a, b) => (b.eventos ?? -1) - (a.eventos ?? -1))
}

export interface ColumnaGrafica {
  clave: string
  nombre: string
  abreviado: string
  valor: string | null
  medida: number | null
  base?: string
  destacada?: boolean
}

/** La API no desempata: entre barrios con la misma cantidad, el orden alfabético deja la lista estable entre consultas. */
export function ordenarBarrios<T extends { nombre: string; cortes: number | null }>(barrios: readonly T[]): T[] {
  return [...barrios].sort((a, b) => (b.cortes ?? -1) - (a.cortes ?? -1) || a.nombre.localeCompare(b.nombre, 'es'))
}

export function bajadaBarrios(barrios: readonly { nombre: string; cortes: number | null }[], suficiente: boolean): string {
  const empate = empateDeBarrios(barrios.map((barrio) => barrio.cortes))
  if (empate !== null) return `${formatearNumero(barrios.length)} barrios empatan con ${cantidadDeCortes(empate)} cada uno`
  const primero = barrios[0]
  if (!suficiente || !primero || primero.cortes === null) return SIN_CONCLUSION
  const alFrente = barrios.filter((barrio) => barrio.cortes === primero.cortes).length
  return alFrente > 1 ? `${formatearNumero(alFrente)} barrios con ${cantidadDeCortes(primero.cortes)}` : `Más en ${primero.nombre}: ${cantidadDeCortes(primero.cortes)}`
}

export interface DatosDeMedicion {
  totalCortes: number
  suficiente: boolean
  duracionHoras: number | null
  serie: { cierres: number; segundosPorCierre: number | null }
  eventosFuera: number | null
}

const CIERRE = 'Un cierre es un barrio restablecido: un corte de tres barrios suma tres.'

/** «Cómo se mide» sigue a la gráfica elegida: cada una aclara solo lo que su propia cifra puede confundir. */
export function reglasDeGrafica(grafica: Grafica, datos: DatosDeMedicion): string[] {
  if (grafica === 'dia') return ['Cada corte cuenta en el día en que empezó, en hora de Cartagena.']
  if (grafica === 'novedades') {
    const fuera = datos.eventosFuera !== null && datos.eventosFuera > 0
      ? [`Quedan fuera ${formatearNumero(datos.eventosFuera)} eventos de otros tipos, como cortes vencidos sin confirmar.`] : []
    return ['Cuenta eventos de la bitácora, no cortes: un corte puede dejar varios.', ...fuera]
  }
  if (!datos.suficiente) return [CIERRE]
  if (grafica === 'cierres') {
    return datos.serie.cierres > 0
      ? [CIERRE, `Por eso los ${formatearNumero(datos.serie.cierres)} cierres no contradicen los ${formatearNumero(datos.totalCortes)} cortes de la tarjeta.`]
      : [CIERRE]
  }
  const meses = datos.serie.segundosPorCierre
  if (meses === null || datos.duracionHoras === null) return [CIERRE]
  const titular = horasEnPalabras(datos.duracionHoras * 3600)
  const promedio = horasEnPalabras(meses)
  return promedio === titular ? [CIERRE] : [CIERRE, `Por eso los meses rondan ${promedio} y el titular, por corte, ${titular}.`]
}

/** El backend cuenta apariciones en avisos aprobados y pide decirlo donde se muestre (`EstadisticasMongoAdapter`). */
export function reglasDeBarrios(cantidades: readonly (number | null)[]): string[] {
  const ultimas = cantidades.slice(-2)
  const empateAlFinal = ultimas.length === 2 && ultimas[0] === ultimas[1]
  return [
    'Cada barrio cuenta las veces que apareció en un aviso de corte aprobado, no los cortes con duración medida.',
    ...(empateAlFinal ? ['Los barrios empatados van por orden alfabético; puede haber más con la misma cifra.'] : []),
  ]
}

/** En el papel no hay selector: el informe trae las cuatro gráficas y todas sus aclaraciones, sin repetirlas. */
export function reglasDelInforme(datos: DatosDeMedicion, cantidades: readonly (number | null)[]): string[] {
  return [...new Set([...GRAFICAS.flatMap((grafica) => reglasDeGrafica(grafica, datos)), ...reglasDeBarrios(cantidades)])]
}
