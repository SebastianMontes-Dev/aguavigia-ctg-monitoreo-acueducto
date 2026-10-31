import type { components } from '../api/generado/esquema'
import { presentarEstado } from './estados'
import { formatearNumero } from './formato'
import { MUESTRA_SUFICIENTE } from './muestra'
import { duracionEnPalabras, momento } from './tiempo'

export type MetricasSistema = components['schemas']['MetricasDelSistemaRespuesta']
export type CopiaAnalitica = components['schemas']['CopiaAnaliticaRespuesta']
export type ConteosCopia = components['schemas']['ConteosAnaliticosRespuesta']

export type Contadores = Record<string, number> | undefined

/** Los mapas pueden venir vacíos o ausentes y no se suponen claves (cambios-para-frontend.md, F6). */
export function totalDe(contadores: Contadores): number {
  return Object.values(contadores ?? {}).reduce((suma, cantidad) => suma + (Number.isFinite(cantidad) ? cantidad : 0), 0)
}

export interface Entrada {
  clave: string
  cantidad: number
}

export function entradasDe(contadores: Contadores): Entrada[] {
  return Object.entries(contadores ?? {})
    .filter(([, cantidad]) => Number.isFinite(cantidad))
    .map(([clave, cantidad]) => ({ clave, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave, 'es'))
}

const ORIGENES: Record<string, string> = {
  VECINOS: 'por vecinos',
  VEEDOR: 'por un veedor',
  ACUACAR: 'por Acuacar',
  OFICIAL_ACUACAR: 'por Acuacar',
  SENSOR: 'por un sensor',
  SIN_ORIGEN: 'sin origen',
}

/** «SIN_SERVICIO/VECINOS» → «Sin servicio por vecinos»; SIN_DATOS/SIN_ORIGEN es el regreso a «sin datos». */
export function cambioEnPalabras(clave: string): string {
  const [estado, origen] = clave.split('/')
  const texto = estado === 'SIN_DATOS' ? 'Vuelve a «sin datos»' : presentarEstado(estado as Parameters<typeof presentarEstado>[0]).texto
  const procedencia = origen && origen !== 'SIN_ORIGEN' ? ORIGENES[origen] ?? origen : ''
  return procedencia ? `${texto} ${procedencia}` : texto
}

const VERIFICACIONES: Record<string, string> = {
  NINGUNA: 'Sin verificar',
  UBICACION_VERIFICADA: 'Ubicación verificada',
  CUENTA_VERIFICADA: 'Cuenta verificada',
}

export function verificacionEnPalabras(clave: string): string {
  return VERIFICACIONES[clave] ?? clave
}

const TIPOS_REPORTE: Record<string, string> = {
  SIN_AGUA: 'Sin agua',
  PRESION_BAJA: 'Presión baja',
  CON_AGUA: 'Con agua',
  SERVICIO_RESTABLECIDO: 'Servicio restablecido',
}

export function tipoDeReporteEnPalabras(clave: string): string {
  return TIPOS_REPORTE[clave] ?? clave
}

export interface TiempoHastaElCambio {
  cambios: number
  /** Con menos de 5 cambios medidos se muestra la cantidad, pero no se concluye (ADR-105). */
  suficiente: boolean
  promedio: string | null
  maximo: string | null
}

export function tiempoHastaElCambio(metricas: MetricasSistema | undefined): TiempoHastaElCambio {
  const medida = metricas?.tiempoHastaElCambioDeEstado
  const cambios = medida?.cambios ?? 0
  const suficiente = cambios >= MUESTRA_SUFICIENTE
  const enPalabras = (segundos: number | undefined) =>
    cambios > 0 && typeof segundos === 'number' && Number.isFinite(segundos) ? duracionEnPalabras(segundos * 1000) : null
  return { cambios, suficiente, promedio: suficiente ? enPalabras(medida?.promedioSegundos) : null, maximo: suficiente ? enPalabras(medida?.maximoSegundos) : null }
}

export type ResultadoDeCopia = 'ok' | 'con-diferencias' | 'fallida' | 'en-curso' | 'desconocido'

export function resultadoDeCopia(copia: Pick<CopiaAnalitica, 'resultado'>): ResultadoDeCopia {
  switch (copia.resultado) {
    case 'OK': return 'ok'
    case 'CON_DIFERENCIAS': return 'con-diferencias'
    case 'FALLIDA': return 'fallida'
    case 'EN_CURSO': return 'en-curso'
    default: return 'desconocido'
  }
}

const RESULTADOS: Record<ResultadoDeCopia, string> = {
  ok: 'Copia correcta',
  'con-diferencias': 'Copiada con diferencias',
  fallida: 'La copia falló',
  'en-curso': 'Copiando ahora',
  desconocido: 'Resultado desconocido',
}

export function resultadoEnPalabras(resultado: ResultadoDeCopia): string {
  return RESULTADOS[resultado]
}

export interface FilaDeConteo {
  nombre: string
  mongo: number | null
  sql: number | null
  cuadra: boolean
}

const CONTEOS: { campo: keyof ConteosCopia; nombre: string }[] = [
  { campo: 'sectores', nombre: 'Barrios' },
  { campo: 'cortes', nombre: 'Cortes' },
  { campo: 'pares', nombre: 'Pares corte-barrio' },
]

/** MongoDB frente a SQL, renglón por renglón: la diferencia se ve en la fila, no solo en el `detalle`. */
export function conteosDeCopia(copia: CopiaAnalitica): FilaDeConteo[] {
  return CONTEOS.map(({ campo, nombre }) => {
    const mongo = typeof copia.enMongo?.[campo] === 'number' ? copia.enMongo[campo] : null
    const sql = typeof copia.enSql?.[campo] === 'number' ? copia.enSql[campo] : null
    return { nombre, mongo, sql, cuadra: mongo !== null && sql !== null && mongo === sql }
  })
}

export function conteoEnPalabras(valor: number | null): string {
  return valor === null ? 'Sin dato' : formatearNumero(valor)
}

/** Cuánto tardó la copia; nulo si sigue en curso o el backend se detuvo a mitad de ella. */
export function duracionDeCopia(copia: CopiaAnalitica): string | null {
  if (!copia.iniciadaEn || !copia.terminadaEn) return null
  const ms = Date.parse(copia.terminadaEn) - Date.parse(copia.iniciadaEn)
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms < 1000 ? 'menos de un segundo' : ms < 60_000 ? `${Math.round(ms / 1000)} s` : duracionEnPalabras(ms)
}

/** «hoy a las 8:00 a. m.», «ayer a las…» o «el 31 de octubre a las…»: `momento` no dice «hoy» y sola suena a media frase. */
export function cuandoEnPalabras(valor: string | Date, ahora: Date): string {
  const texto = momento(valor, ahora)
  return texto.startsWith('a las') ? `hoy ${texto}` : texto
}
