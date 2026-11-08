import type { Page, Route } from '@playwright/test'
import { listado, problema, simularApi } from './api-simulada'

export const PERMISOS_COMPLETOS = ['VER_PANEL', 'MODERAR_REPORTES', 'GESTIONAR_CORTES', 'REVISAR_INGESTA', 'CONFIGURAR_SEGUNDO_FACTOR']
export const PERMISOS_OBSERVADOR = ['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR']

// Un PNG de 1×1 píxel: la foto que devuelve el panel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

const json = (cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}) =>
  ({ status: estado, contentType: 'application/json', body: JSON.stringify(cuerpo), headers: cabeceras })

export interface Reporte {
  id: string
  sectorId: string
  tipo: string
  timestamp: string
  estadoModeracion: string
  verificacion: string
  fotoEstado: string
  fotoUrl?: string
  senalRed: boolean
}

export interface Corte {
  id: string
  sectoresAfectados: string[]
  inicio: string
  finPrometido: string
  causa: string
  origen: string
  estado: string
  cierres: { sectorId: string; hora: string; fuente: string; provisional: boolean }[]
  motivoAnulacion?: string | null
  caducaEn?: string | null
}

/** El valor de un `datetime-local` en la hora de Cartagena (UTC-5) para un instante. */
export function campoCartagena(ms: number): string {
  return new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16)
}

export function reportesDeEjemplo(ahora = Date.now()): Reporte[] {
  const hace = (horas: number) => new Date(ahora - horas * 3_600_000).toISOString()
  return [
    { id: 'r1', sectorId: 'armenia', tipo: 'SIN_AGUA', timestamp: hace(5), estadoModeracion: 'PENDIENTE', verificacion: 'UBICACION_VERIFICADA', fotoEstado: 'EN_REVISION', fotoUrl: '/api/veedor/fotos/foto-r1.png', senalRed: true },
    { id: 'r2', sectorId: 'manga', tipo: 'PRESION_BAJA', timestamp: hace(3), estadoModeracion: 'PENDIENTE', verificacion: 'NINGUNA', fotoEstado: 'SIN_FOTO', senalRed: false },
    { id: 'r3', sectorId: 'el-bosque', tipo: 'SIN_AGUA', timestamp: hace(1), estadoModeracion: 'PENDIENTE', verificacion: 'CUENTA_VERIFICADA', fotoEstado: 'EN_REVISION', fotoUrl: '/api/veedor/fotos/foto-r3.png', senalRed: false },
  ]
}

export function cortesDeEjemplo(ahora = Date.now()): Corte[] {
  const desplazar = (horas: number) => new Date(ahora + horas * 3_600_000).toISOString()
  return [
    // Promesa vencida sin ningún cierre.
    { id: 'k1', sectoresAfectados: ['armenia', 'manga'], inicio: desplazar(-8), finPrometido: desplazar(-2), causa: 'Reparación de la línea de 24 pulgadas', origen: 'VEEDOR', estado: 'CONFIRMADO', cierres: [] },
    // Un barrio con cierre provisional que pusieron los vecinos.
    { id: 'k2', sectoresAfectados: ['el-bosque'], inicio: desplazar(-30), finPrometido: desplazar(-24), causa: 'Cambio de válvula', origen: 'OFICIAL_ACUACAR', estado: 'CONFIRMADO', cierres: [{ sectorId: 'el-bosque', hora: desplazar(-20), fuente: 'VECINOS', provisional: true }] },
    { id: 'k3', sectoresAfectados: ['armenia'], inicio: desplazar(-400), finPrometido: desplazar(-396), causa: 'Aviso duplicado', origen: 'INGESTA_IA', estado: 'ANULADO', cierres: [], motivoAnulacion: 'Era el mismo aviso del día anterior' },
  ]
}

export interface Propuesta {
  id: string
  sectorId: string
  estadoPropuesto: string
  fuente: string
  urlOriginal: string | null
  citaTextual: string
  confianza: number
  detectadaEn: string
  estadoRevision: string
  inicioDeclarado: string | null
  finPrometido: string | null
  motivoDeRevision: string | null
}

export interface Colector {
  nombre: string
  ultimaEjecucionExitosa: string | null
  ultimoFallo: string | null
  motivoDelUltimoFallo: string | null
  itemsProcesados: number
  tasaDeError: number
  fallosConsecutivos: number
}

export interface Fallido {
  fuente: string
  urlOriginal: string
  titulo: string | null
  motivo: string
  primerIntento: string
  ultimoIntento: string
  reintentos: number
}

export const CITA_MANGA = 'Por trabajos en la línea de 24 pulgadas, el servicio se suspenderá en Manga entre las 8:00 a. m. y las 4:00 p. m.'

export function propuestasDeEjemplo(ahora = Date.now()): Propuesta[] {
  const hace = (horas: number) => new Date(ahora - horas * 3_600_000).toISOString()
  const desde = (horas: number) => new Date(ahora + horas * 3_600_000).toISOString()
  return [
    // Con ventana declarada: aprobarla puede cambiar el mapa.
    { id: 'q1', sectorId: 'manga', estadoPropuesto: 'SIN_SERVICIO', fuente: 'acuacar', urlOriginal: 'https://www.acuacar.com.co/aviso-manga', citaTextual: CITA_MANGA, confianza: 0.45, detectadaEn: hace(2), estadoRevision: 'PENDIENTE', inicioDeclarado: desde(-1), finPrometido: desde(7), motivoDeRevision: 'Confianza baja: la nota nombra a Manga en una mención suelta' },
    // De prensa y sin ventana horaria: aprobarla responde 200 sin cambiar el estado.
    { id: 'q2', sectorId: 'armenia', estadoPropuesto: 'PRESION_BAJA', fuente: 'zona-cero', urlOriginal: 'https://www.zonacero.com/nota-armenia', citaTextual: 'Vecinos de Armenia reportan poca presión desde la madrugada, según Aguas de Cartagena.', confianza: 0.75, detectadaEn: hace(5), estadoRevision: 'PENDIENTE', inicioDeclarado: null, finPrometido: null, motivoDeRevision: 'Viene de prensa: espera siempre a un veedor' },
    // Sin la frase del boletín ni enlace: no hay evidencia y no se debe aprobar.
    { id: 'q3', sectorId: 'el-bosque', estadoPropuesto: 'CORTE_PROGRAMADO', fuente: 'google-news', urlOriginal: null, citaTextual: '', confianza: 0.3, detectadaEn: hace(8), estadoRevision: 'PENDIENTE', inicioDeclarado: null, finPrometido: null, motivoDeRevision: null },
  ]
}

export function saludDeEjemplo(ahora = Date.now()): Colector[] {
  const hace = (minutos: number) => new Date(ahora - minutos * 60_000).toISOString()
  return [
    { nombre: 'acuacar', ultimaEjecucionExitosa: hace(10), ultimoFallo: null, motivoDelUltimoFallo: null, itemsProcesados: 120, tasaDeError: 0, fallosConsecutivos: 0 },
    { nombre: 'zona-cero', ultimaEjecucionExitosa: hace(90), ultimoFallo: hace(20), motivoDelUltimoFallo: 'Tiempo de espera agotado', itemsProcesados: 60, tasaDeError: 0.1, fallosConsecutivos: 1 },
    { nombre: 'caracol-radio', ultimaEjecucionExitosa: hace(300), ultimoFallo: hace(15), motivoDelUltimoFallo: 'El feed devolvió 503', itemsProcesados: 33, tasaDeError: 0.5, fallosConsecutivos: 4 },
  ]
}

export function fallidosDeEjemplo(ahora = Date.now()): Fallido[] {
  const hace = (horas: number) => new Date(ahora - horas * 3_600_000).toISOString()
  return [
    { fuente: 'acuacar', urlOriginal: 'https://www.acuacar.com.co/boletin-roto', titulo: 'Boletín de suspensión del servicio', motivo: 'No se pudo leer el horario del boletín', primerIntento: hace(30), ultimoIntento: hace(1), reintentos: 12 },
    { fuente: 'w-radio', urlOriginal: 'https://www.wradio.com.co/nota-sin-titulo', titulo: null, motivo: 'JSON ilegible', primerIntento: hace(6), ultimoIntento: hace(2), reintentos: 3 },
  ]
}

export interface OpcionesGestion {
  permisos?: string[]
  reportes?: Reporte[]
  cortes?: Corte[]
  disputas?: unknown[]
  /** Operaciones a las que el servidor responde `409`, como si otra persona se hubiera adelantado. */
  conflictos?: string[]
  /** `PATCH` de moderación que tardan, para comprobar que no se envían dos veces. */
  retardoMs?: number
  /** FE4 · Propuestas de la ingesta. Solo las `PENDIENTE` salen en la lista, como en el servidor. */
  propuestas?: Propuesta[]
  /** Un arreglo, o `'error'` para que el servidor responda `500`. */
  salud?: Colector[] | 'error'
  fallidos?: Fallido[] | 'error'
  /** Si es cierto, aprobar una propuesta aplica su estado al barrio en `GET /api/sectores`; si no, el mapa queda como estaba. */
  aprobarCambiaElMapa?: boolean
}

/**
 * Simula `/api/veedor/**` de FE3 con estado en memoria: lo que se aprueba sale de la cola, lo que se cierra queda cerrado. Devuelve
 * lo que vio el servidor, para comprobar qué se mandó.
 */
export async function simularGestion(page: Page, opciones: OpcionesGestion = {}) {
  await simularApi(page)
  const permisos = opciones.permisos ?? PERMISOS_COMPLETOS
  const cola = [...(opciones.reportes ?? reportesDeEjemplo())]
  const cortes = (opciones.cortes ?? cortesDeEjemplo()).map((corte) => structuredClone(corte))
  const conflictos = new Set(opciones.conflictos ?? [])
  const visto = {
    moderaciones: [] as { id: string; accion: string }[],
    fotos: [] as { nombre: string; autorizacion: string | null }[],
    altas: [] as unknown[],
    cierres: [] as { ruta: string; cuerpo: unknown }[],
    decisiones: [] as { id: string; accion: string; motivo?: string }[],
  }
  const propuestas = (opciones.propuestas ?? propuestasDeEjemplo()).map((propuesta) => structuredClone(propuesta))
  const estadosDelMapa = new Map<string, string>()

  await page.addInitScript(() => {
    sessionStorage.setItem('aguavigia.panel.token', 'token-de-prueba')
    sessionStorage.setItem('aguavigia.panel.alcance', 'COMPLETO')
  })
  await page.route('**/api/veedor/yo', (route) => route.fulfill(json({ id: 'u1', nombre: 'Ana Pérez', correo: 'ana@example.com', estado: 'ACTIVA', rol: 'VEEDOR', permisosEfectivos: permisos })))

  await page.route(/\/api\/veedor\/reportes\/pendientes(?:\?|$)/, (route) =>
    route.fulfill(json(cola, 200, { 'X-Total-Count': String(cola.length), 'X-Total-Pages': '1', 'X-Page': '0', 'X-Page-Size': '20' })))
  await page.route(/\/api\/veedor\/reportes\/[^/]+\/(aprobar|descartar|foto\/descartar)$/, async (route) => {
    const partes = new URL(route.request().url()).pathname.split('/')
    // .../reportes/{id}/aprobar · .../reportes/{id}/descartar · .../reportes/{id}/foto/descartar
    const accion = partes.at(-2) === 'foto' ? 'foto' : partes.at(-1) ?? ''
    const reporteId = accion === 'foto' ? partes.at(-3) ?? '' : partes.at(-2) ?? ''
    visto.moderaciones.push({ id: reporteId, accion })
    if (opciones.retardoMs) await new Promise((resolver) => setTimeout(resolver, opciones.retardoMs))
    if (conflictos.has(accion)) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya estaba decidido'))
    const reporte = cola.find((otro) => otro.id === reporteId)
    if (!reporte) return route.fulfill(problema(404, 'recurso-no-encontrado', 'No existe'))
    if (accion === 'foto') {
      reporte.fotoEstado = 'DESCARTADA'
      delete reporte.fotoUrl
    } else {
      cola.splice(cola.indexOf(reporte), 1)
      reporte.estadoModeracion = accion === 'aprobar' ? 'APROBADO' : 'DESCARTADO'
      if (accion === 'aprobar' && reporte.fotoEstado === 'EN_REVISION') reporte.fotoEstado = 'PUBLICA'
    }
    return route.fulfill(json(reporte))
  })
  await page.route(/\/api\/veedor\/fotos\/[^/?]+$/, (route) => {
    visto.fotos.push({ nombre: new URL(route.request().url()).pathname.split('/').at(-1) ?? '', autorizacion: route.request().headers().authorization ?? null })
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })

  const vencidos = () => cortes.filter((corte) =>
    corte.estado !== 'ANULADO' && corte.estado !== 'RESTABLECIDO' && corte.estado !== 'EXPIRADO'
    && (corte.cierres.some((cierre) => cierre.provisional)
      || (corte.cierres.length === 0 && Date.parse(corte.finPrometido) < Date.now())))
  await page.route(/\/api\/veedor\/cortes(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const cuerpo = route.request().postDataJSON() as Omit<Corte, 'id' | 'origen' | 'estado' | 'cierres'>
      visto.altas.push(cuerpo)
      if (Date.parse(cuerpo.finPrometido) <= Date.parse(cuerpo.inicio)) return route.fulfill(problema(400, 'peticion-invalida', 'finPrometido anterior a inicio'))
      const nuevo: Corte = { ...cuerpo, id: `k${cortes.length + 1}`, origen: 'VEEDOR', estado: 'ANUNCIADO', cierres: [] }
      cortes.push(nuevo)
      return route.fulfill(json(nuevo, 201))
    }
    const sector = new URL(route.request().url()).searchParams.get('sectorId')
    return route.fulfill(json(cortes.filter((corte) => corte.sectoresAfectados.includes(sector ?? ''))))
  })
  await page.route(/\/api\/veedor\/cortes\/[^/]+$/, (route) => {
    const corte = cortes.find((otro) => otro.id === new URL(route.request().url()).pathname.split('/').at(-1))
    return corte ? route.fulfill(json(corte)) : route.fulfill(problema(404, 'recurso-no-encontrado', 'No existe'))
  })
  // Playwright prueba primero la ruta registrada al final: `vencidos` va después del detalle, que también encajaría con él.
  await page.route(/\/api\/veedor\/cortes\/vencidos$/, (route) => route.fulfill(json(vencidos())))
  await page.route(/\/api\/veedor\/cortes\/[^/]+\/(cierre|anulacion|sectores\/[^/]+\/(cierre|confirmacion))$/, async (route: Route) => {
    const partes = new URL(route.request().url()).pathname.split('/')
    const id = partes[4] ?? ''
    const ruta = partes.slice(5).join('/')
    const cuerpo = route.request().postDataJSON() as { horaReal?: string; motivo?: string }
    visto.cierres.push({ ruta, cuerpo })
    const corte = cortes.find((otro) => otro.id === id)
    if (!corte) return route.fulfill(problema(404, 'recurso-no-encontrado', 'No existe'))
    const operacion = ruta.split('/').at(-1) ?? ''
    if (conflictos.has(operacion)) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya estaba hecho'))
    const sectorId = partes[6] ?? ''
    const cerrado = (barrio: string) => corte.cierres.some((cierre) => cierre.sectorId === barrio)
    if (operacion === 'anulacion') {
      if (corte.estado === 'ANULADO') return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya anulado'))
      if (!cuerpo.motivo) return route.fulfill(problema(400, 'peticion-invalida', 'Falta el motivo'))
      corte.estado = 'ANULADO'
      corte.motivoAnulacion = cuerpo.motivo
    } else if (operacion === 'confirmacion') {
      const cierre = corte.cierres.find((otro) => otro.sectorId === sectorId)
      if (!cierre?.provisional) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya confirmado'))
      cierre.provisional = false
      cierre.fuente = 'VEEDOR'
      cierre.hora = cuerpo.horaReal ?? cierre.hora
    } else if (ruta.startsWith('sectores/')) {
      if (cerrado(sectorId)) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya cerrado'))
      corte.cierres.push({ sectorId, hora: cuerpo.horaReal ?? '', fuente: 'VEEDOR', provisional: false })
    } else {
      const pendientes = corte.sectoresAfectados.filter((barrio) => !cerrado(barrio))
      if (pendientes.length === 0) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya cerrado'))
      for (const barrio of pendientes) corte.cierres.push({ sectorId: barrio, hora: cuerpo.horaReal ?? '', fuente: 'VEEDOR', provisional: false })
    }
    if (operacion !== 'anulacion' && corte.sectoresAfectados.every(cerrado)) corte.estado = 'RESTABLECIDO'
    return route.fulfill(json(corte))
  })

  // FE4 · la ingesta. Los `PATCH` siguen las reglas del servidor: repetir la misma decisión es 200, contradecirla es 409.
  await page.route(/\/api\/veedor\/ingesta\/propuestas(?:\?.*)?$/, (route) => {
    const pendientes = propuestas.filter((propuesta) => propuesta.estadoRevision === 'PENDIENTE')
    return route.fulfill(json(pendientes, 200, { 'X-Total-Count': String(pendientes.length), 'X-Total-Pages': '1', 'X-Page': '0', 'X-Page-Size': '20' }))
  })
  await page.route(/\/api\/veedor\/ingesta\/propuestas\/[^/]+\/(aprobar|descartar|anulacion)$/, async (route) => {
    const partes = new URL(route.request().url()).pathname.split('/')
    const accion = partes.at(-1) ?? ''
    const id = partes.at(-2) ?? ''
    const motivo = accion === 'anulacion' ? (route.request().postDataJSON() as { motivo?: string }).motivo : undefined
    visto.decisiones.push({ id, accion, ...(motivo === undefined ? {} : { motivo }) })
    if (opciones.retardoMs) await new Promise((resolver) => setTimeout(resolver, opciones.retardoMs))
    if (conflictos.has(`propuesta-${accion}`)) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya estaba decidida'))
    const propuesta = propuestas.find((otra) => otra.id === id)
    if (!propuesta) return route.fulfill(problema(404, 'recurso-no-encontrado', 'No existe'))
    if (accion === 'anulacion') {
      if (!motivo) return route.fulfill(problema(400, 'peticion-invalida', 'Falta el motivo'))
      if (propuesta.estadoRevision !== 'APROBADA') return route.fulfill(problema(409, 'conflicto-de-estado', 'No estaba aprobada'))
      propuesta.estadoRevision = 'ANULADA'
      estadosDelMapa.delete(propuesta.sectorId)
    } else if (accion === 'aprobar') {
      if (propuesta.estadoRevision === 'DESCARTADA') return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya descartada'))
      if (propuesta.estadoRevision === 'PENDIENTE') {
        propuesta.estadoRevision = 'APROBADA'
        if (opciones.aprobarCambiaElMapa) estadosDelMapa.set(propuesta.sectorId, propuesta.estadoPropuesto)
      }
    } else {
      if (propuesta.estadoRevision === 'APROBADA') return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya aprobada'))
      propuesta.estadoRevision = 'DESCARTADA'
    }
    return route.fulfill(json(propuesta))
  })
  await page.route(/\/api\/veedor\/ingesta\/fallidos$/, (route) =>
    opciones.fallidos === 'error' ? route.fulfill(problema(500, 'error-interno', 'Falló')) : route.fulfill(json(opciones.fallidos ?? fallidosDeEjemplo())))
  await page.route(/\/api\/veedor\/ingesta\/salud$/, (route) =>
    opciones.salud === 'error' ? route.fulfill(problema(500, 'error-interno', 'Falló')) : route.fulfill(json(opciones.salud ?? saludDeEjemplo())))
  // Playwright prueba primero la ruta registrada al final: ésta va tras la genérica de `simularApi` y deja ver lo que se aprobó.
  await page.route('**/api/sectores', (route) => {
    const base = listado()
    return route.fulfill(json({ ...base, sectores: base.sectores.map((sector) => ({ ...sector, estado: estadosDelMapa.get(sector.id) ?? sector.estado })) }))
  })

  await page.route(/\/api\/veedor\/disputas$/, (route) => route.fulfill(json(opciones.disputas ?? [
    { id: 'el-bosque', nombre: 'EL BOSQUE', poblacion: 6754, estado: 'CON_SERVICIO', origen: 'VECINOS', enDisputa: true, reportesEnContra: 5, respaldo: { vecinos: 12, umbral: 12 } },
    { id: 'armenia', nombre: 'ARMENIA', poblacion: 1061, estado: 'SIN_SERVICIO', origen: 'ACUACAR', enDisputa: true, reportesEnContra: 1 },
  ])))

  return { cola, cortes, propuestas, visto }
}
