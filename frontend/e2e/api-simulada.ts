import type { Page, Route } from '@playwright/test'
import { bitacoraDeEjemplo, cumplimientoDeEjemplo, estadisticasDeEjemplo, serieDeEjemplo } from '../src/pruebas/datos/historia'

// Datos de prueba: tres barrios con coordenadas aproximadas de Cartagena. No describen su estado real.
function cuadro(lon: number, lat: number) {
  const d = 0.006
  return [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]]
}

export const GEOMETRIA = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'armenia', properties: { nombre: 'ARMENIA' }, geometry: { type: 'Polygon', coordinates: cuadro(-75.505, 10.405) } },
    { type: 'Feature', id: 'manga', properties: { nombre: 'MANGA' }, geometry: { type: 'Polygon', coordinates: cuadro(-75.535, 10.41) } },
    { type: 'Feature', id: 'el-bosque', properties: { nombre: 'EL BOSQUE' }, geometry: { type: 'Polygon', coordinates: cuadro(-75.52, 10.395) } },
  ],
}

export function listado(ahora = new Date()) {
  const haceHoras = (horas: number) => new Date(ahora.getTime() - horas * 3_600_000).toISOString()
  return {
    generadoEn: ahora.toISOString(),
    sectores: [
      { id: 'armenia', nombre: 'ARMENIA', poblacion: 1061, estado: 'SIN_SERVICIO', actualizadoEn: haceHoras(1), verificadoEn: haceHoras(1), origen: 'ACUACAR' },
      {
        id: 'el-bosque', nombre: 'EL BOSQUE', poblacion: 6754, estado: 'CON_SERVICIO', actualizadoEn: haceHoras(52), verificadoEn: haceHoras(30),
        origen: 'VECINOS', respaldo: { vecinos: 12, umbral: 12 }, enDisputa: true, reportesEnContra: 5,
      },
      { id: 'manga', nombre: 'MANGA', poblacion: null, estado: null, actualizadoEn: null, verificadoEn: null },
    ],
  }
}

export function cortes(ahora = new Date()) {
  const desplazar = (horas: number) => new Date(ahora.getTime() + horas * 3_600_000).toISOString()
  return {
    armenia: [
      { id: 'c1', sectoresAfectados: ['armenia'], inicio: desplazar(-3), finPrometido: desplazar(4), cierres: [], causa: 'Reparación de tubería', origen: 'OFICIAL_ACUACAR', estado: 'CONFIRMADO' },
      {
        id: 'c0', sectoresAfectados: ['armenia'], inicio: desplazar(-200), finPrometido: desplazar(-198), causa: 'Mantenimiento', origen: 'VEEDOR', estado: 'RESTABLECIDO',
        cierres: [{ sectorId: 'armenia', hora: desplazar(-192), fuente: 'VEEDOR', provisional: false }],
      },
      { id: 'c2', sectoresAfectados: ['armenia'], inicio: desplazar(-400), finPrometido: desplazar(-396), cierres: [], causa: 'Reparación de válvula', origen: 'OFICIAL_ACUACAR', estado: 'EXPIRADO' },
      { id: 'c3', sectoresAfectados: ['armenia'], inicio: desplazar(-600), finPrometido: desplazar(-590), cierres: [], causa: 'Aviso duplicado', origen: 'INGESTA_IA', estado: 'ANULADO', motivoAnulacion: 'Era el mismo aviso del día anterior' },
    ],
  } as Record<string, unknown[]>
}

const TIPO = 'https://aguavigia.example/errores/'

export function problema(estado: number, tipo: string, detalle: string) {
  return { status: estado, contentType: 'application/problem+json', body: JSON.stringify({ type: `${TIPO}${tipo}`, title: tipo, status: estado, detail: detalle }) }
}

interface Opciones {
  sectores?: (route: Route) => Promise<void>
  estadisticas?: (route: Route) => Promise<void>
  reporte?: (route: Route) => Promise<void>
  confirmacion?: (route: Route) => Promise<void>
  cumplimiento?: (route: Route) => Promise<void>
  serie?: (route: Route) => Promise<void>
  bitacora?: (route: Route) => Promise<void>
  sustento?: (route: Route) => Promise<void>
  modo?: 'REAL' | 'SIMULACION'
  calidad?: (route: Route) => Promise<void>
  indiceCorte?: (route: Route) => Promise<void>
}

/** Simula la API pública para las E2E que corren sin backend (CI). Devuelve los cuerpos de los reportes y confirmaciones. */
export async function simularApi(page: Page, opciones: Opciones = {}) {
  const reportes: unknown[] = []
  const confirmaciones: { id: string; dispositivo: string | null }[] = []
  // Lo que ve el servidor además del cuerpo: la identidad de cada reporte, los tokens pedidos y las subidas de foto.
  const dispositivos: string[] = []
  const identidades: (string | null)[] = []
  const fotos: { id: string; subida: string | null; tipo: string | null }[] = []
  await page.route('**/api/sistema/modo', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ modo: opciones.modo ?? 'REAL', cuentasSinteticas: 0 }),
  }))
  await page.route('**/api/sectores/stream', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry:60000\nevent:sectores\ndata:{}\n\n' }))
  await page.route('**/api/sectores/geometria', (route) =>
    route.fulfill({ status: 200, contentType: 'application/geo+json', body: JSON.stringify(GEOMETRIA) }))
  await page.route(/\/api\/cumplimiento\/serie\.csv(?:\?|$)/, (route) => route.fulfill({
    status: 200, contentType: 'text/csv', body: 'periodo;porcentaje_cumplimiento\n2026-04;100',
  }))
  await page.route(/\/api\/cumplimiento\/serie(?:\?|$)/, opciones.serie ?? ((route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(serieDeEjemplo),
  })))
  await page.route(/\/api\/cumplimiento(?:\/sectores\/[^/?]+)?(?:\?|$)/, opciones.cumplimiento ?? ((route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(cumplimientoDeEjemplo),
  })))
  await page.route(/\/api\/cumplimiento\/calidad(?:\?|$)/, opciones.calidad ?? ((route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ cierresMedidos: 10, cierresProvisionales: 0, porcentajeProvisional: 0, cortesSinCierreConfirmado: 0, cortesAnulados: 0 }),
  })))
  await page.route(/\/api\/cumplimiento\/cortes\/[^/?]+$/, opciones.indiceCorte ?? ((route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ duracionPrometidaSegundos: 14_400, duracionRealSegundos: 18_000, desviacionSegundos: 3600, porcentajeCumplimiento: 80,
      porcentajeProvisional: 50, cortesSinCierreConfirmado: 0, cortesAnulados: 0 }),
  })))
  await page.route(/\/api\/bitacora\/[^/]+\/sustento/, opciones.sustento ?? ((route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(['reporte-1', 'reporte-2']),
    headers: { 'X-Total-Count': '2', 'X-Total-Pages': '1', 'X-Page': '0', 'X-Page-Size': '50' },
  })))
  await page.route(/\/api\/bitacora(?:\?|$)/, opciones.bitacora ?? ((route) => {
    const url = new URL(route.request().url())
    const eventos = bitacoraDeEjemplo.filter((evento) =>
      (!url.searchParams.has('sectorId') || evento.sectorId === url.searchParams.get('sectorId'))
      && (!url.searchParams.has('tipo') || evento.tipo === url.searchParams.get('tipo'))
      && (!url.searchParams.has('desde') || evento.timestamp >= url.searchParams.get('desde')!)
      && (!url.searchParams.has('hasta') || evento.timestamp < url.searchParams.get('hasta')!))
    const pagina = Number(url.searchParams.get('pagina') ?? 0)
    const tamano = Number(url.searchParams.get('tamano') ?? 5)
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(eventos.slice(pagina * tamano, (pagina + 1) * tamano)),
      headers: { 'X-Total-Count': String(eventos.length), 'X-Total-Pages': String(Math.ceil(eventos.length / tamano)), 'X-Page': String(pagina), 'X-Page-Size': String(tamano) },
    })
  }))
  await page.route(/\/api\/sectores\/[^/]+\/cortes/, (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[3] ?? ''
    const lista = cortes()[id] ?? []
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(lista),
      headers: { 'X-Total-Count': String(lista.length), 'X-Total-Pages': '1', 'X-Page': '0', 'X-Page-Size': '10' },
    })
  })
  await page.route('**/api/sectores', opciones.sectores ?? ((route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(listado()) })))
  await page.route('**/api/estadisticas', opciones.estadisticas ?? ((route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estadisticasDeEjemplo) })))
  await page.route('**/api/dispositivos', (route) => {
    const token = `dispositivo-${dispositivos.length + 1}`
    dispositivos.push(token)
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ token }) })
  })
  await page.route('**/api/reportes', async (route) => {
    reportes.push(route.request().postDataJSON())
    identidades.push(await route.request().headerValue('X-Dispositivo'))
    if (opciones.reporte) return opciones.reporte(route)
    return route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ id: 'r1', sectorId: 'armenia', tipo: 'SIN_AGUA', confirmaciones: 0, fotoEstado: 'SIN_FOTO', verificacion: 'NINGUNA', subidaToken: 'subida-r1' }),
    })
  })
  await page.route(/\/api\/reportes\/[^/]+\/foto$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[3] ?? ''
    fotos.push({ id, subida: await route.request().headerValue('X-Subida'), tipo: await route.request().headerValue('Content-Type') })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id, sectorId: 'armenia', tipo: 'SIN_AGUA', fotoEstado: 'EN_REVISION', fotoUrl: `/api/fotos/${id}.png` }) })
  })
  await page.route(/\/api\/sectores\/(?!stream$|geometria$)[^/]+$/, (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[3] ?? ''
    const sector = listado().sectores.find((s) => s.id === id)
    return sector
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sector) })
      : route.fulfill(problema(404, 'recurso-no-encontrado', `No existe el sector '${id}'`))
  })
  await page.route(/\/api\/reportes\/[^/]+\/confirmar$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[3] ?? ''
    confirmaciones.push({ id, dispositivo: await route.request().headerValue('X-Dispositivo') })
    if (opciones.confirmacion) return opciones.confirmacion(route)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id, sectorId: 'armenia', tipo: 'SIN_AGUA', confirmaciones: 2 }) })
  })
  // El extracto PMTiles viaja por Git LFS y en CI puede faltar: el mapa base no es parte de estas pruebas.
  await page.route('**/mapa/cartagena.pmtiles', (route) => route.abort())
  return { reportes, confirmaciones, dispositivos, identidades, fotos }
}
