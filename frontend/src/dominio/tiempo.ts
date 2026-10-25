// Cartagena no tiene horario de verano: UTC-5 todo el año. Se fija la zona para no depender de la del navegador.
const ZONA = 'America/Bogota'
const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

const formatoHora = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true })
const formatoDia = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long' })
const formatoDiaConAnio = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' })
const formatoClaveDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })

export interface HoraPartida {
  cifra: string
  periodo: string
}

function aFecha(valor: string | Date): Date {
  return typeof valor === 'string' ? new Date(valor) : valor
}

// Intl separa «a. m.» con espacios duros según el motor; se normalizan para que el texto sea estable.
function normalizarEspacios(texto: string): string {
  return texto.replace(/[  ]/g, ' ')
}

export function formatearHora(valor: string | Date): string {
  return normalizarEspacios(formatoHora.format(aFecha(valor)))
}

/** «6:10» y «a. m.» por separado, para componer la cifra grande y su periodo en tamaños distintos. */
export function partirHora(valor: string | Date): HoraPartida {
  const partes = formatoHora.formatToParts(aFecha(valor))
  const cifra = partes.filter((p) => p.type === 'hour' || p.type === 'minute' || p.type === 'literal')
    .map((p) => p.value).join('').trim()
  const periodo = partes.find((p) => p.type === 'dayPeriod')?.value ?? ''
  return { cifra: normalizarEspacios(cifra), periodo: normalizarEspacios(periodo) }
}

const formatoDiaSemana = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' })
const formatoDiaSemanaConAnio = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function claveDia(fecha: Date): string {
  return formatoClaveDia.format(fecha)
}

/** «2026-09-28» en el calendario de Cartagena: agrupa lo ocurrido el mismo día sin depender de la zona del navegador. */
export function claveDiaCartagena(valor: string | Date): string {
  return claveDia(aFecha(valor))
}

/** Encabezado de un grupo por día: «Hoy», «Ayer» o «lunes, 21 de septiembre». */
export function etiquetaDia(valor: string | Date, ahora: Date): string {
  const fecha = aFecha(valor)
  const dia = diaRelativo(fecha, ahora)
  if (dia === 'hoy' || dia === 'ayer' || dia === 'mañana') return dia.charAt(0).toUpperCase() + dia.slice(1)
  const mismoAnio = claveDia(fecha).slice(0, 4) === claveDia(ahora).slice(0, 4)
  const texto = normalizarEspacios((mismoAnio ? formatoDiaSemana : formatoDiaSemanaConAnio).format(fecha))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** «hoy», «ayer», «mañana» o la fecha, siempre según el calendario de Cartagena. */
export function diaRelativo(valor: string | Date, ahora: Date): string {
  const fecha = aFecha(valor)
  const clave = claveDia(fecha)
  if (clave === claveDia(ahora)) return 'hoy'
  if (clave === claveDia(new Date(ahora.getTime() - DIA))) return 'ayer'
  if (clave === claveDia(new Date(ahora.getTime() + DIA))) return 'mañana'
  const mismoAnio = clave.slice(0, 4) === claveDia(ahora).slice(0, 4)
  return (mismoAnio ? formatoDia : formatoDiaConAnio).format(fecha)
}

const formatoFechaCorta = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'numeric' })
// Abreviaturas propias: las de ICU cambian entre versiones («sep» o «sept») y la fecha debe verse igual en todas.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * «dom 25 oct», con el año solo si no es el de ahora. Es una fecha que no depende de cuándo se lea: «mañana» o «ayer»
 * dicen poco cuando la persona abre la ficha otro día o el reloj de quien publica no coincide con el suyo.
 */
export function fechaCorta(valor: string | Date, ahora: Date): string {
  const fecha = aFecha(valor)
  const partes = formatoFechaCorta.formatToParts(fecha)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  const texto = `${parte('weekday').slice(0, 3)} ${parte('day')} ${MESES[Number(parte('month')) - 1] ?? ''}`
  return claveDia(fecha).slice(0, 4) === claveDia(ahora).slice(0, 4) ? texto : `${texto} ${claveDia(fecha).slice(0, 4)}`
}

/**
 * «Hoy · dom 25 oct», «Ayer · sáb 24 oct» o solo «sáb 18 oct»: el día relativo, siempre acompañado de la fecha real.
 * Con `pasado` (algo que ya ocurrió: un cierre, un aviso) nunca se dice «mañana»: si el reloj de quien publica va
 * adelantado respecto al de la persona, la fecha real sola es lo único que no confunde.
 */
export function diaConFecha(valor: string | Date, ahora: Date, { pasado = false }: { pasado?: boolean } = {}): string {
  const relativo = diaRelativo(valor, ahora)
  const fecha = fechaCorta(valor, ahora)
  if (relativo !== 'hoy' && relativo !== 'ayer' && relativo !== 'mañana') return fecha
  if (pasado && relativo === 'mañana') return fecha
  return `${relativo.charAt(0).toUpperCase()}${relativo.slice(1)} · ${fecha}`
}

/** «a las 6:10 a. m.» hoy; «ayer a las…»; «el 24 de julio a las…» en otra fecha. */
export function momento(valor: string | Date, ahora: Date): string {
  const dia = diaRelativo(valor, ahora)
  const hora = formatearHora(valor)
  if (dia === 'hoy') return `a las ${hora}`
  if (dia === 'ayer' || dia === 'mañana') return `${dia} a las ${hora}`
  return `el ${dia} a las ${hora}`
}

export function haceCuanto(valor: string | Date, ahora: Date): string {
  const transcurrido = Math.max(0, ahora.getTime() - aFecha(valor).getTime())
  if (transcurrido < MINUTO) return 'hace menos de un minuto'
  if (transcurrido < HORA) return `hace ${Math.floor(transcurrido / MINUTO)} min`
  if (transcurrido < DIA) {
    const horas = Math.floor(transcurrido / HORA)
    const minutos = Math.floor((transcurrido % HORA) / MINUTO)
    return minutos === 0 ? `hace ${horas} h` : `hace ${horas} h ${minutos} min`
  }
  const dias = Math.floor(transcurrido / DIA)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

function plural(cantidad: number, singular: string, pluralTexto: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`
}

/** DESIGN.md §5: «4 horas y media», nunca «4.5h». Redondea al cuarto de hora desde una hora. */
export function duracionEnPalabras(milisegundos: number): string {
  const minutosTotales = Math.round(Math.abs(milisegundos) / MINUTO)
  if (minutosTotales < 60) return plural(Math.max(1, minutosTotales), 'minuto', 'minutos')
  if (minutosTotales >= 48 * 60) return plural(Math.round(minutosTotales / (24 * 60)), 'día', 'días')
  const cuartos = Math.round(minutosTotales / 15)
  const horas = Math.floor(cuartos / 4)
  const resto = cuartos % 4
  const base = plural(horas, 'hora', 'horas')
  if (resto === 0) return base
  if (resto === 2) return `${base} y media`
  return `${base} y ${resto * 15} minutos`
}
