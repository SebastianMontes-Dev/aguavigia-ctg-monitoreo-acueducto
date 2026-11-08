import { formatearNumero } from './formato'

/** Los cuatro tipos por los que `GET /api/bitacora?tipo=` filtra: con otro valor el servidor responde 400 (docs/api). */
export const TIPOS_BITACORA = [
  'CORTE_ANUNCIADO',
  'CORTE_RESTABLECIDO',
  'CORTE_CONFIRMADO_POR_CIUDADANOS',
  'CORTE_DETECTADO_POR_INGESTA',
] as const

export type TipoBitacora = typeof TIPOS_BITACORA[number]

/** Los nueve tipos que el servidor puede devolver en un evento; los cinco últimos se ven pero no se filtran. */
export const TIPOS_EVENTO = [
  ...TIPOS_BITACORA,
  'CORTE_EXPIRADO',
  'CORTE_ANULADO',
  'RESTABLECIMIENTO_POR_VECINOS',
  'ESTADO_EN_DISPUTA',
  'CONSENSO_REVERTIDO',
] as const

export type TipoEvento = typeof TIPOS_EVENTO[number]

export const NOMBRE_TIPO: Record<TipoEvento, string> = {
  CORTE_ANUNCIADO: 'Corte anunciado',
  CORTE_RESTABLECIDO: 'Corte restablecido',
  CORTE_CONFIRMADO_POR_CIUDADANOS: 'Confirmado por ciudadanos',
  CORTE_DETECTADO_POR_INGESTA: 'Detectado en boletín',
  CORTE_EXPIRADO: 'Corte sin cierre confirmado',
  CORTE_ANULADO: 'Corte anulado',
  RESTABLECIMIENTO_POR_VECINOS: 'Restablecimiento según vecinos',
  ESTADO_EN_DISPUTA: 'Estado en disputa',
  CONSENSO_REVERTIDO: 'Consenso revertido',
}

/** Nombre de cada tipo como pestaña de filtro: el plural de lo que se ve en la lista. */
export const FILTRO_TIPO: Record<TipoBitacora, string> = {
  CORTE_ANUNCIADO: 'Anunciados',
  CORTE_RESTABLECIDO: 'Restablecidos',
  CORTE_CONFIRMADO_POR_CIUDADANOS: 'Confirmados por vecinos',
  CORTE_DETECTADO_POR_INGESTA: 'En boletines',
}

const ESTADO_EN_TEXTO: Record<string, string> = {
  SIN_SERVICIO: 'sin servicio',
  CON_SERVICIO: 'con servicio',
  PRESION_BAJA: 'presión baja',
  CORTE_PROGRAMADO: 'corte programado',
}

/**
 * Las descripciones las arma el backend para el registro y traen el enum y el id del barrio
 * («confirmaron SIN_SERVICIO en 'arroyo-grande'»). Se muestran en palabras sin cambiar lo que dicen.
 */
export function descripcionLegible(
  texto: string,
  nombreDe: (sectorId: string) => string | undefined,
  barrio?: { original: string; legible: string },
): string {
  const legible = texto
    .replace(/&#(\d{2,5});/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/\b(SIN_SERVICIO|CON_SERVICIO|PRESION_BAJA|CORTE_PROGRAMADO)\b/g, (estado) => ESTADO_EN_TEXTO[estado] ?? estado)
    .replace(/'([a-z0-9]+(?:-[a-z0-9]+)*)'/g, (original, id: string) => nombreDe(id) ?? original)
  // El nombre oficial del barrio viene en mayúsculas («en el sector SAN ANTONIO»); solo se cambia el del propio evento.
  return barrio && barrio.original.length > 2 && barrio.original === barrio.original.toUpperCase()
    ? legible.split(barrio.original).join(barrio.legible)
    : legible
}

/**
 * ADR-104: lo que pasó, en palabras del vecino. Sale del `tipo` y del `estado` del evento, no de su descripción, que el
 * backend arma para el registro y repite lo mismo con el enum y el id del barrio.
 */
export function quePasoEnPalabras(tipo: TipoEvento | null, estado: string | null | undefined): string {
  switch (tipo) {
    case 'CORTE_CONFIRMADO_POR_CIUDADANOS':
      if (estado === 'SIN_SERVICIO') return 'Se quedó sin agua'
      if (estado === 'PRESION_BAJA') return 'Llega poca agua'
      if (estado === 'CON_SERVICIO') return 'Volvió el agua'
      return 'Lo confirmaron los vecinos'
    case 'RESTABLECIMIENTO_POR_VECINOS':
    case 'CORTE_RESTABLECIDO': return 'Volvió el agua'
    case 'CORTE_ANUNCIADO': return 'Se anunció un corte'
    case 'CORTE_DETECTADO_POR_INGESTA': return 'Aviso de un corte'
    case 'CORTE_EXPIRADO': return 'Nadie confirmó si volvió el agua'
    case 'CORTE_ANULADO': return 'Se retiró un corte publicado por error'
    case 'ESTADO_EN_DISPUTA': return 'Los vecinos reportan algo distinto'
    case 'CONSENSO_REVERTIDO': return 'Se retiró lo que confirmaron los vecinos'
    default: return 'Evento registrado'
  }
}

/** Las descripciones de estos tipos solo repiten lo que ya dicen el tipo y el respaldo: no se muestran (ADR-104). */
const DESCRIPCION_REDUNDANTE: ReadonlySet<TipoEvento> = new Set(['CORTE_CONFIRMADO_POR_CIUDADANOS', 'RESTABLECIMIENTO_POR_VECINOS'])

export function descripcionAporta(tipo: TipoEvento | null): boolean {
  return !tipo || !DESCRIPCION_REDUNDANTE.has(tipo)
}

/** «Lo confirmaron 8 vecinos (hacían falta 3)» cuando el evento nace de un quórum; si no, quién lo sostiene. */
export function procedenciaEnPalabras(
  tipo: TipoEvento | null,
  respaldo: { vecinos?: number; umbral?: number } | null | undefined,
  fuente: string | null,
): string | null {
  if (respaldo?.vecinos != null && respaldo.umbral != null) {
    const vecinos = `${formatearNumero(respaldo.vecinos)} ${respaldo.vecinos === 1 ? 'vecino' : 'vecinos'}`
    if (tipo === 'CORTE_CONFIRMADO_POR_CIUDADANOS' || tipo === 'RESTABLECIMIENTO_POR_VECINOS') {
      return `Lo ${respaldo.vecinos === 1 ? 'confirmó' : 'confirmaron'} ${vecinos} (hacían falta ${formatearNumero(respaldo.umbral)})`
    }
    return `${formatearNumero(respaldo.vecinos)} de ${formatearNumero(respaldo.umbral)} vecinos`
  }
  return fuente
}

export function esTipoBitacora(valor: unknown): valor is TipoBitacora {
  return typeof valor === 'string' && TIPOS_BITACORA.some((tipo) => tipo === valor)
}

export function esTipoEvento(valor: unknown): valor is TipoEvento {
  return typeof valor === 'string' && TIPOS_EVENTO.some((tipo) => tipo === valor)
}

function diaValido(dia: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false
  const fecha = new Date(`${dia}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === dia
}

/** Los días elegidos son de Cartagena (UTC−5); `hasta` es el inicio exclusivo del día siguiente. */
export function limiteDiaCartagena(dia: string, siguiente = false): string | null {
  if (!diaValido(dia)) return null
  const inicio = Date.parse(`${dia}T05:00:00Z`)
  return new Date(inicio + (siguiente ? 86_400_000 : 0)).toISOString().replace('.000Z', 'Z')
}

export function rangoDiasValido(desde?: string, hasta?: string): boolean {
  if (desde && !diaValido(desde)) return false
  if (hasta && !diaValido(hasta)) return false
  return !desde || !hasta || desde <= hasta
}

/** Solo http(s): la URL llega de una fuente externa y no debe poder abrir `javascript:` ni otro esquema. */
export function enlaceExterno(url?: string | null): string | null {
  if (!url) return null
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

const PREFIJO_IMAGEN = 'https://www.acuacar.com/wp-content/uploads/'

export function imagenDeBitacora(url?: string | null): string | null {
  if (!url) return null
  return url.startsWith(PREFIJO_IMAGEN) ? `/acuacar-media/${url.slice(PREFIJO_IMAGEN.length)}` : url
}
