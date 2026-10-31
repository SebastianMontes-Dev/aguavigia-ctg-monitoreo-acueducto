import type { AjusteDePermisos, CuentaPanel, RolPanel } from '../dominio/cuentas'
import type { EventoAuditoria } from '../dominio/auditoria'
import type { CopiaAnalitica, MetricasSistema } from '../dominio/sistema'
import { ejecutarAccion, leerDelPanel, type ResultadoAccion } from './acciones-panel'
import { api } from './cliente'
import { leerPaginacion, type Paginacion } from './paginacion'

type Cliente = typeof api
interface Lectura { signal?: AbortSignal; cliente?: Cliente }

export const TAMANO_CUENTAS = 50
export const TAMANO_AUDITORIA = 50

export interface FiltroCuentas {
  estado?: string
  barrioId?: string
}

export interface PaginaCuentas {
  cuentas: CuentaPanel[]
  paginacion: Paginacion
}

/** Más recientes primero y paginada por cabeceras. Incluye las cuentas sintéticas: el contrato no las filtra, la pantalla las oculta. */
export async function leerCuentas(pagina: number, filtro: FiltroCuentas = {}, { signal, cliente = api }: Lectura = {}): Promise<PaginaCuentas> {
  const { dato, respuesta } = await leerDelPanel<CuentaPanel[]>(() =>
    cliente.GET('/api/veedor/usuarios', {
      params: { query: { pagina, tamano: TAMANO_CUENTAS, ...(filtro.estado ? { estado: filtro.estado } : {}), ...(filtro.barrioId ? { barrioId: filtro.barrioId } : {}) } },
      signal,
    }))
  return { cuentas: dato, paginacion: leerPaginacion(respuesta.headers, pagina) }
}

/** Cuántas páginas seguidas se piden buscando cuentas que no sean sintéticas antes de devolver el control a quien mira. */
export const SALTOS_SEGUIDOS = 12

export interface PaginaCuentasVisibles extends PaginaCuentas {
  /** Páginas enteras de cuentas sintéticas que se pidieron y se dejaron atrás para llegar a esta. */
  saltadas: number
  /** Se llegó al tope de búsqueda con todo sintético y todavía hay más páginas. */
  agotado: boolean
}

/**
 * El contrato no filtra por `sintetica` y hay decenas de miles: sin las sintéticas, una página entera puede quedar vacía. Mientras
 * eso pase se pide la siguiente, hasta `SALTOS_SEGUIDOS` veces; una página con alguna cuenta de verdad (o la última) corta la búsqueda.
 */
export async function leerCuentasVisibles(
  inicio: number, filtro: FiltroCuentas, ocultarSinteticas: boolean, { signal, cliente = api }: Lectura = {},
): Promise<PaginaCuentasVisibles> {
  let pagina = inicio
  for (let saltadas = 0; ; saltadas++) {
    const leida = await leerCuentas(pagina, filtro, { signal, cliente })
    const hayReales = !ocultarSinteticas || leida.cuentas.some((cuenta) => cuenta.sintetica !== true)
    if (hayReales || !leida.paginacion.hayMas) return { ...leida, saltadas, agotado: false }
    if (saltadas + 1 >= SALTOS_SEGUIDOS) return { ...leida, saltadas: saltadas + 1, agotado: true }
    pagina = leida.paginacion.pagina + 1
  }
}

export interface PaginaAuditoria {
  eventos: EventoAuditoria[]
  paginacion: Paginacion
}

/** Solo lectura: la API no tiene forma de editar ni borrar un asiento. */
export async function leerAuditoria(pagina: number, { signal, cliente = api }: Lectura = {}): Promise<PaginaAuditoria> {
  const { dato, respuesta } = await leerDelPanel<EventoAuditoria[]>(() =>
    cliente.GET('/api/veedor/auditoria', { params: { query: { pagina, tamano: TAMANO_AUDITORIA } }, signal }))
  return { eventos: dato, paginacion: leerPaginacion(respuesta.headers, pagina) }
}

export async function leerMetricas({ signal, cliente = api }: Lectura = {}): Promise<MetricasSistema> {
  const { dato } = await leerDelPanel<MetricasSistema>(() => cliente.GET('/api/veedor/sistema/metricas', { signal }))
  return dato
}

/** Un `503` aquí no es un fallo de la aplicación: la copia está apagada o PostgreSQL no responde y el sistema sigue igual (ADR-100). */
export async function leerCopias({ signal, cliente = api }: Lectura = {}): Promise<CopiaAnalitica[]> {
  const { dato } = await leerDelPanel<CopiaAnalitica[]>(() => cliente.GET('/api/veedor/analitica/copia', { params: { query: { limite: 5 } }, signal }))
  return dato
}

export interface DatosInvitacion {
  correo: string
  nombre: string
  rol: RolPanel
}

/** `409`: ya hay una cuenta con ese correo. `400`: datos inválidos. Crea la cuenta `INVITADA` y manda el enlace. */
export function invitarCuenta(datos: DatosInvitacion, cliente: Cliente = api): Promise<ResultadoAccion<CuentaPanel>> {
  return ejecutarAccion(() => cliente.POST('/api/veedor/usuarios/invitaciones', { body: datos }))
}

/** `202` sin cuerpo. `409`: la cuenta ya no está `INVITADA`. */
export function reenviarInvitacion(id: string, cliente: Cliente = api): Promise<ResultadoAccion<undefined>> {
  return ejecutarAccion(() => cliente.POST('/api/veedor/usuarios/{id}/invitacion/reenvio', { params: { path: { id } } }))
}

export function aprobarCuenta(id: string, ajuste: AjusteDePermisos, cliente: Cliente = api): Promise<ResultadoAccion<CuentaPanel>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/usuarios/{id}/aprobacion', { params: { path: { id } }, body: ajuste }))
}

export function rechazarCuenta(id: string, cliente: Cliente = api): Promise<ResultadoAccion<CuentaPanel>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/usuarios/{id}/rechazo', { params: { path: { id } } }))
}

/** Revoca sus sesiones al instante. */
export function suspenderCuenta(id: string, cliente: Cliente = api): Promise<ResultadoAccion<CuentaPanel>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/usuarios/{id}/suspension', { params: { path: { id } } }))
}

export function reactivarCuenta(id: string, cliente: Cliente = api): Promise<ResultadoAccion<CuentaPanel>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/usuarios/{id}/reactivacion', { params: { path: { id } } }))
}

/** Cambia el rol y los permisos sueltos; revoca las sesiones vivas de esa persona, se amplíen o se recorten. */
export function cambiarAccesoDeCuenta(id: string, ajuste: AjusteDePermisos, cliente: Cliente = api): Promise<ResultadoAccion<CuentaPanel>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/usuarios/{id}/permisos', { params: { path: { id } }, body: ajuste }))
}
