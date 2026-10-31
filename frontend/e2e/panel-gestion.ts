import type { Page, Route } from '@playwright/test'
import { problema, simularApi } from './api-simulada'

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

export interface OpcionesGestion {
  permisos?: string[]
  reportes?: Reporte[]
  cortes?: Corte[]
  disputas?: unknown[]
  /** Operaciones a las que el servidor responde `409`, como si otra persona se hubiera adelantado. */
  conflictos?: string[]
  /** `PATCH` de moderación que tardan, para comprobar que no se envían dos veces. */
  retardoMs?: number
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
  }

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

  await page.route(/\/api\/veedor\/disputas$/, (route) => route.fulfill(json(opciones.disputas ?? [
    { id: 'el-bosque', nombre: 'EL BOSQUE', poblacion: 6754, estado: 'CON_SERVICIO', origen: 'VECINOS', enDisputa: true, reportesEnContra: 5, respaldo: { vecinos: 12, umbral: 12 } },
    { id: 'armenia', nombre: 'ARMENIA', poblacion: 1061, estado: 'SIN_SERVICIO', origen: 'ACUACAR', enDisputa: true, reportesEnContra: 1 },
  ])))

  return { cola, cortes, visto }
}
