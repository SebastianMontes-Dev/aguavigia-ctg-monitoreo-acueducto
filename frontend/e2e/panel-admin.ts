import type { Page } from '@playwright/test'
import { problema, simularApi } from './api-simulada'

export const PERMISOS_ADMIN = ['VER_PANEL', 'MODERAR_REPORTES', 'GESTIONAR_CORTES', 'REVISAR_INGESTA', 'GESTIONAR_USUARIOS', 'VER_AUDITORIA', 'CONFIGURAR_SEGUNDO_FACTOR']
export const PERMISOS_DEL_ROL: Record<string, string[]> = {
  OBSERVADOR: ['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR'],
  VEEDOR: ['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR', 'MODERAR_REPORTES', 'GESTIONAR_CORTES', 'REVISAR_INGESTA'],
  ADMIN: PERMISOS_ADMIN,
}
const ORDEN = PERMISOS_ADMIN

const json = (cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}) =>
  ({ status: estado, contentType: 'application/json', body: JSON.stringify(cuerpo), headers: cabeceras })

export interface Cuenta {
  id: string
  correo: string
  nombre: string
  estado: string
  rol: string
  barrioId?: string | null
  permisosEfectivos: string[]
  permisosConcedidos: string[]
  permisosRevocados: string[]
  segundoFactorActivo: boolean
  creadoEn: string
  actualizadoEn: string
  sintetica: boolean
}

export interface Asiento {
  id: string
  accion: string
  autorCorreo?: string
  sujetoCorreo?: string
  detalle?: string
  ip?: string
  ocurrioEn: string
}

export interface Copia {
  id: number
  iniciadaEn: string
  terminadaEn?: string
  resultado: string
  enMongo: { sectores: number; cortes: number; pares: number }
  enSql: { sectores: number; cortes: number; pares: number }
  detalle?: string
}

function cuenta(id: string, nombre: string, estado: string, rol: string, haceDias: number, campos: Partial<Cuenta> = {}): Cuenta {
  const creado = new Date(Date.now() - haceDias * 86_400_000).toISOString()
  return {
    id, nombre, correo: `${nombre.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@example.com`, estado, rol, barrioId: null,
    permisosEfectivos: estado === 'ACTIVA' ? [...(PERMISOS_DEL_ROL[rol] ?? [])] : [], permisosConcedidos: [], permisosRevocados: [],
    segundoFactorActivo: rol === 'ADMIN', creadoEn: creado, actualizadoEn: creado, sintetica: false, ...campos,
  }
}

/** Las cuentas reales de la prueba, de la más nueva a la más antigua; la ADMIN `u1` es quien mira. */
export function cuentasDeEjemplo(): Cuenta[] {
  return [
    cuenta('u5', 'Marta Ruiz', 'PENDIENTE_APROBACION', 'OBSERVADOR', 1),
    cuenta('u4', 'Pedro Gil', 'INVITADA', 'OBSERVADOR', 2),
    cuenta('u2', 'Luis Mora', 'ACTIVA', 'VEEDOR', 5),
    cuenta('u6', 'Sofía Paz', 'SUSPENDIDA', 'VEEDOR', 8),
    cuenta('u1', 'Ana Pérez', 'ACTIVA', 'ADMIN', 30),
  ]
}

/** `cantidad` cuentas de vecino sintéticas, más nuevas que las reales, como en el servidor con las 30 000. */
export function sinteticas(cantidad: number): Cuenta[] {
  return Array.from({ length: cantidad }, (_, i) => cuenta(`s${i}`, `Vecino ${i + 1}`, 'ACTIVA', 'VECINO', 0.5, {
    correo: `vecino${i + 1}@sintetico.invalid`, permisosEfectivos: ['GESTIONAR_PERFIL_PROPIO'], barrioId: 'manga', sintetica: true,
  }))
}

export function asientosDeEjemplo(cantidad = 3): Asiento[] {
  const base = Date.now()
  const acciones = ['CUENTA_SUSPENDIDA', 'PERMISOS_CAMBIADOS', 'CUENTA_INVITADA', 'SESION_INICIADA', 'SEGUNDO_FACTOR_ACTIVADO']
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `e${i}`, accion: acciones[i % acciones.length] ?? 'SESION_INICIADA', autorCorreo: i === 2 ? undefined : 'ana@example.com', sujetoCorreo: 'luis@example.com',
    detalle: `Asiento número ${i + 1}`, ip: `10.0.0.${i + 1}`, ocurrioEn: new Date(base - (i + 1) * 600_000).toISOString(),
  }))
}

export function metricasDeEjemplo(cambios = 3) {
  return {
    desde: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    cambiosDeEstado: { 'SIN_SERVICIO/VECINOS': 4, 'CON_SERVICIO/VEEDOR': 1, 'SIN_DATOS/SIN_ORIGEN': 2 },
    disputasAbiertas: 3,
    quorumsRechazadosPorComposicion: { SIN_AGUA: 7 },
    reportesPorNivelDeVerificacion: { NINGUNA: 120, UBICACION_VERIFICADA: 14, CUENTA_VERIFICADA: 30 },
    fallosDeColectores: { acuacar: 1 },
    tiempoHastaElCambioDeEstado: { cambios, promedioSegundos: 1800, maximoSegundos: 5400 },
  }
}

export function copiaDeEjemplo(resultado = 'OK', campos: Partial<Copia> = {}): Copia {
  return {
    id: 9, iniciadaEn: new Date(Date.now() - 300_000).toISOString(), terminadaEn: new Date(Date.now() - 297_000).toISOString(), resultado,
    enMongo: { sectores: 211, cortes: 40, pares: 90 }, enSql: { sectores: 211, cortes: 40, pares: 90 }, ...campos,
  }
}

export interface OpcionesAdmin {
  permisos?: string[]
  cuentas?: Cuenta[]
  auditoria?: Asiento[] | 'error' | 'sin-permiso'
  metricas?: object | 'error'
  /** Un arreglo, `503` si la copia está apagada o `'error'` para un `500`. */
  copias?: Copia[] | 503 | 'error'
  /** Operaciones a las que el servidor responde `409`: `suspension`, `permisos`, `aprobacion`... */
  conflictos?: string[]
  retardoMs?: number
}

/**
 * Simula `/api/veedor/**` de FE5 con estado en memoria: lo que se suspende queda suspendido, lo que se invita aparece en la lista.
 * Devuelve lo que vio el servidor para comprobar qué se mandó y a qué rutas se llamó.
 */
export async function simularAdministracion(page: Page, opciones: OpcionesAdmin = {}) {
  await simularApi(page)
  const permisos = opciones.permisos ?? PERMISOS_ADMIN
  const cuentas = (opciones.cuentas ?? cuentasDeEjemplo()).map((fila) => structuredClone(fila))
  const conflictos = new Set(opciones.conflictos ?? [])
  const visto = {
    listas: [] as string[],
    invitaciones: [] as { correo: string; nombre: string; rol: string }[],
    acciones: [] as { id: string; accion: string; cuerpo: unknown }[],
    auditoria: [] as string[],
  }

  await page.addInitScript(() => {
    sessionStorage.setItem('aguavigia.panel.token', 'token-de-prueba')
    sessionStorage.setItem('aguavigia.panel.alcance', 'COMPLETO')
  })
  await page.route('**/api/veedor/yo', (route) => route.fulfill(json({ id: 'u1', nombre: 'Ana Pérez', correo: 'ana@example.com', estado: 'ACTIVA', rol: 'ADMIN', permisosEfectivos: permisos })))

  await page.route(/\/api\/veedor\/usuarios(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    visto.listas.push(url.search)
    const estado = url.searchParams.get('estado')
    const barrio = url.searchParams.get('barrioId')
    const filtradas = cuentas.filter((fila) => (!estado || fila.estado === estado) && (!barrio || fila.barrioId === barrio))
    const pagina = Number(url.searchParams.get('pagina') ?? 0)
    const tamano = Math.min(200, Number(url.searchParams.get('tamano') ?? 50))
    const paginas = Math.max(1, Math.ceil(filtradas.length / tamano))
    const cabeceras: Record<string, string> = { 'X-Total-Count': String(filtradas.length), 'X-Total-Pages': String(paginas), 'X-Page': String(pagina), 'X-Page-Size': String(tamano) }
    if (pagina + 1 < paginas) cabeceras.Link = `</api/veedor/usuarios?pagina=${pagina + 1}&tamano=${tamano}>; rel="next"`
    return route.fulfill(json(filtradas.slice(pagina * tamano, (pagina + 1) * tamano), 200, cabeceras))
  })

  await page.route(/\/api\/veedor\/usuarios\/invitaciones$/, async (route) => {
    const cuerpo = route.request().postDataJSON() as { correo: string; nombre: string; rol: string }
    visto.invitaciones.push(cuerpo)
    if (opciones.retardoMs) await new Promise((resolver) => setTimeout(resolver, opciones.retardoMs))
    if (cuentas.some((fila) => fila.correo === cuerpo.correo)) return route.fulfill(problema(409, 'conflicto-de-estado', 'Ya existe una cuenta con ese correo'))
    const nueva = cuenta(`n${cuentas.length}`, cuerpo.nombre, 'INVITADA', cuerpo.rol, 0, { correo: cuerpo.correo })
    cuentas.unshift(nueva)
    return route.fulfill(json(nueva, 201))
  })

  await page.route(/\/api\/veedor\/usuarios\/[^/]+\/(invitacion\/reenvio|aprobacion|rechazo|suspension|reactivacion|permisos)$/, async (route) => {
    const partes = new URL(route.request().url()).pathname.split('/')
    const id = partes[4] ?? ''
    const accion = partes.slice(5).join('/')
    const cuerpo = route.request().method() === 'PATCH' && route.request().postData() ? route.request().postDataJSON() as { rol: string; concedidos?: string[]; revocados?: string[] } : null
    visto.acciones.push({ id, accion, cuerpo })
    if (opciones.retardoMs) await new Promise((resolver) => setTimeout(resolver, opciones.retardoMs))
    const fila = cuentas.find((otra) => otra.id === id)
    if (!fila) return route.fulfill(problema(404, 'recurso-no-encontrado', 'No existe'))
    if (conflictos.has(accion) || id === 'u1') return route.fulfill(problema(409, 'conflicto-de-estado', 'No aplica'))
    const exigir = (estado: string) => fila.estado === estado
    if (accion === 'invitacion/reenvio') return exigir('INVITADA') ? route.fulfill({ status: 202 }) : route.fulfill(problema(409, 'conflicto-de-estado', 'Ya aceptó'))
    if (accion === 'aprobacion' || accion === 'rechazo') {
      if (!exigir('PENDIENTE_APROBACION')) return route.fulfill(problema(409, 'conflicto-de-estado', 'No espera aprobación'))
      fila.estado = accion === 'aprobacion' ? 'ACTIVA' : 'RECHAZADA'
    } else if (accion === 'suspension') {
      if (!exigir('ACTIVA')) return route.fulfill(problema(409, 'conflicto-de-estado', 'No está activa'))
      fila.estado = 'SUSPENDIDA'
    } else if (accion === 'reactivacion') {
      if (!exigir('SUSPENDIDA')) return route.fulfill(problema(409, 'conflicto-de-estado', 'No está suspendida'))
      fila.estado = 'ACTIVA'
    }
    if (cuerpo && (accion === 'aprobacion' || accion === 'permisos')) {
      if ((cuerpo.concedidos ?? []).some((permiso) => (cuerpo.revocados ?? []).includes(permiso))) return route.fulfill(problema(400, 'peticion-invalida', 'Permiso en las dos listas'))
      const base = new Set(PERMISOS_DEL_ROL[cuerpo.rol] ?? [])
      for (const permiso of cuerpo.concedidos ?? []) base.add(permiso)
      for (const permiso of cuerpo.revocados ?? []) base.delete(permiso)
      fila.rol = cuerpo.rol
      fila.permisosEfectivos = ORDEN.filter((permiso) => base.has(permiso))
      fila.permisosConcedidos = cuerpo.concedidos ?? []
      fila.permisosRevocados = cuerpo.revocados ?? []
    }
    return route.fulfill(json(fila))
  })

  await page.route(/\/api\/veedor\/auditoria(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    visto.auditoria.push(url.search)
    if (opciones.auditoria === 'error') return route.fulfill(problema(500, 'error-interno', 'Falló'))
    if (opciones.auditoria === 'sin-permiso') return route.fulfill(problema(403, 'acceso-denegado', 'Sin permiso'))
    const asientos = opciones.auditoria ?? asientosDeEjemplo()
    const pagina = Number(url.searchParams.get('pagina') ?? 0)
    const tamano = Number(url.searchParams.get('tamano') ?? 50)
    const paginas = Math.max(1, Math.ceil(asientos.length / tamano))
    const cabeceras: Record<string, string> = { 'X-Total-Count': String(asientos.length), 'X-Total-Pages': String(paginas), 'X-Page': String(pagina), 'X-Page-Size': String(tamano) }
    if (pagina + 1 < paginas) cabeceras.Link = `</api/veedor/auditoria?pagina=${pagina + 1}>; rel="next"`
    return route.fulfill(json(asientos.slice(pagina * tamano, (pagina + 1) * tamano), 200, cabeceras))
  })

  await page.route(/\/api\/veedor\/sistema\/metricas$/, (route) =>
    opciones.metricas === 'error' ? route.fulfill(problema(500, 'error-interno', 'Falló')) : route.fulfill(json(opciones.metricas ?? metricasDeEjemplo())))
  await page.route(/\/api\/veedor\/analitica\/copia(?:\?.*)?$/, (route) => {
    if (opciones.copias === 503) return route.fulfill({ ...problema(503, 'servicio-no-disponible', 'La copia analítica está apagada'), headers: { 'Retry-After': '30' } })
    if (opciones.copias === 'error') return route.fulfill(problema(500, 'error-interno', 'Falló'))
    return route.fulfill(json(opciones.copias ?? [copiaDeEjemplo()]))
  })

  return { cuentas, visto }
}
