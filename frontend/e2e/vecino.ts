import type { Page, Route } from '@playwright/test'
import { problema, simularApi } from './api-simulada'

export const CLAVE_SESION_VECINO = 'aguavigia.vecino.token'
export const CLAVE_SESION_PANEL = 'aguavigia.panel.token'

/** El perfil que devuelve `GET /api/vecino/yo` en las pruebas; Armenia existe en el listado simulado. */
export function perfilDeEjemplo(extra: Record<string, unknown> = {}) {
  return {
    id: 'v1', correo: 'vera@example.com', nombre: 'Vera Soto', estado: 'ACTIVA', barrioId: 'armenia', barrioVerificado: false,
    barrioVerificadoEn: null, recibeAvisos: false,
    consentimientos: [{ tipo: 'PRIVACIDAD', version: '1', fecha: '2026-10-30T15:00:00Z' }],
    creadoEn: '2026-10-30T15:00:00Z', actualizadoEn: '2026-10-30T15:00:00Z', ...extra,
  }
}

export function json(cuerpo: unknown, estado = 200) {
  return { status: estado, contentType: 'application/json', body: JSON.stringify(cuerpo) }
}

export function conEspera(respuesta: ReturnType<typeof problema>, segundos: number) {
  return { ...respuesta, headers: { 'Retry-After': String(segundos) } }
}

interface OpcionesVecino {
  perfil?: Record<string, unknown>
  sesion?: (route: Route, intento: number) => Promise<void>
  yo?: (route: Route) => Promise<void>
  perfilPatch?: (route: Route, intento: number) => Promise<void>
  verificacion?: (route: Route, intento: number) => Promise<void>
}

/** Simula la API pública y `/api/vecino/**`, y devuelve lo que vio el servidor: cuerpos, cabeceras y cuántas veces se le pidió cada cosa. */
export async function simularVecino(page: Page, opciones: OpcionesVecino = {}) {
  const api = await simularApi(page)
  let perfil: Record<string, unknown> = perfilDeEjemplo(opciones.perfil)
  const sesiones: Record<string, unknown>[] = []
  const parches: Record<string, unknown>[] = []
  const verificaciones: Record<string, unknown>[] = []
  const cierres: string[] = []
  const autorizaciones: { ruta: string; autorizacion: string | null }[] = []
  const reportes: { cuerpo: Record<string, unknown>; autorizacion: string | null; dispositivo: string | null }[] = []

  page.on('request', (peticion) => {
    const ruta = new URL(peticion.url()).pathname
    if (ruta.startsWith('/api/veedor/') || ruta.startsWith('/api/vecino/')) {
      autorizaciones.push({ ruta, autorizacion: peticion.headers().authorization ?? null })
    }
  })

  await page.route('**/api/vecino/sesion', async (route) => {
    sesiones.push(route.request().postDataJSON() as Record<string, unknown>)
    if (opciones.sesion) return opciones.sesion(route, sesiones.length)
    return route.fulfill(json({ token: 'token-vecino', usuarioId: 'v1', nombre: 'Vera Soto', correo: 'vera@example.com', permisos: ['GESTIONAR_PERFIL_PROPIO'] }))
  })
  await page.route('**/api/vecino/yo', (route) => opciones.yo ? opciones.yo(route) : route.fulfill(json(perfil)))
  await page.route('**/api/vecino/perfil', async (route) => {
    const cambios = route.request().postDataJSON() as Record<string, unknown>
    parches.push(cambios)
    if (opciones.perfilPatch) return opciones.perfilPatch(route, parches.length)
    perfil = {
      ...perfil,
      ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}),
      ...(cambios.recibirAvisos !== undefined ? { recibeAvisos: cambios.recibirAvisos } : {}),
      // Cambiar de barrio anula la verificación (cuentas-y-sesion.md).
      ...(cambios.barrioId !== undefined ? { barrioId: cambios.barrioId, barrioVerificado: false, barrioVerificadoEn: null } : {}),
      actualizadoEn: new Date().toISOString(),
    }
    return route.fulfill(json(perfil))
  })
  await page.route('**/api/vecino/verificacion-barrio', async (route) => {
    verificaciones.push(route.request().postDataJSON() as Record<string, unknown>)
    if (opciones.verificacion) return opciones.verificacion(route, verificaciones.length)
    perfil = { ...perfil, barrioVerificado: true, barrioVerificadoEn: '2026-10-31T13:00:00Z' }
    return route.fulfill(json(perfil))
  })
  await page.route('**/api/vecino/sesion/cierre', (route) => {
    cierres.push(route.request().headers().authorization ?? '')
    return route.fulfill({ status: 204 })
  })
  // Lo vuelve a registrar después de simularApi: gana la última ruta registrada, y esta deja ver la cuenta que reporta.
  await page.route('**/api/reportes', async (route) => {
    reportes.push({
      cuerpo: route.request().postDataJSON() as Record<string, unknown>,
      autorizacion: await route.request().headerValue('Authorization'),
      dispositivo: await route.request().headerValue('X-Dispositivo'),
    })
    return route.fulfill(json({ id: `r${reportes.length}`, sectorId: 'armenia', tipo: 'SIN_AGUA', confirmaciones: 0, fotoEstado: 'SIN_FOTO', verificacion: 'CUENTA_VERIFICADA' }, 201))
  })
  return { ...api, sesiones, parches, verificaciones, cierres, autorizaciones, reportes, perfilActual: () => perfil }
}

/** Deja una sesión de vecino abierta desde el primer renglón de cada página. */
export async function conSesionDeVecino(page: Page, token = 'token-vecino') {
  await page.addInitScript(([clave, valor]) => window.sessionStorage.setItem(clave!, valor!), [CLAVE_SESION_VECINO, token])
}

export { problema }
