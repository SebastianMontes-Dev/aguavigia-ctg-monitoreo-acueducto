import type { components } from '../api/generado/esquema'
import { esPermiso, PERMISOS, type Permiso } from './permisos'

export type CuentaPanel = components['schemas']['UsuarioRespuesta']

/** Los roles que un ADMIN puede dar (SolicitudPermisos). `VECINO` no se invita, aprueba ni convierte (cuentas-y-sesion.md). */
export const ROLES_PANEL = ['OBSERVADOR', 'VEEDOR', 'ADMIN'] as const
export type RolPanel = typeof ROLES_PANEL[number]

const ROLES: Record<string, string> = { OBSERVADOR: 'Observador', VEEDOR: 'Veedor', ADMIN: 'Administrador', VECINO: 'Vecino' }

export function rolEnPalabras(rol: string | undefined): string {
  return (rol && ROLES[rol]) ?? 'Sin rol'
}

export function esRolPanel(valor: unknown): valor is RolPanel {
  return typeof valor === 'string' && ROLES_PANEL.some((rol) => rol === valor)
}

/** Los permisos que cada rol trae solo (cuentas-y-sesion.md, «Roles y permisos»); lo demás se concede o revoca por persona. */
export const PERMISOS_DEL_ROL: Record<RolPanel, readonly Permiso[]> = {
  OBSERVADOR: ['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR'],
  VEEDOR: ['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR', 'MODERAR_REPORTES', 'GESTIONAR_CORTES', 'REVISAR_INGESTA'],
  ADMIN: PERMISOS,
}

/** Este permiso no se puede revocar a nadie (cuentas-y-sesion.md): el panel lo deja marcado y bloqueado. */
export const PERMISO_PROTEGIDO: Permiso = 'CONFIGURAR_SEGUNDO_FACTOR'

const PERMISOS_EN_PALABRAS: Record<Permiso, string> = {
  VER_PANEL: 'Ver el panel',
  MODERAR_REPORTES: 'Moderar reportes',
  GESTIONAR_CORTES: 'Gestionar cortes',
  REVISAR_INGESTA: 'Revisar la ingesta',
  GESTIONAR_USUARIOS: 'Gestionar cuentas',
  VER_AUDITORIA: 'Ver la auditoría',
  CONFIGURAR_SEGUNDO_FACTOR: 'Configurar el segundo factor',
}

export function permisoEnPalabras(permiso: string): string {
  return esPermiso(permiso) ? PERMISOS_EN_PALABRAS[permiso] : permiso
}

export const ESTADOS_CUENTA = ['PENDIENTE_APROBACION', 'INVITADA', 'ACTIVA', 'SUSPENDIDA', 'PENDIENTE_VERIFICACION', 'RECHAZADA'] as const
export type EstadoCuenta = typeof ESTADOS_CUENTA[number]

const ESTADOS: Record<EstadoCuenta, string> = {
  PENDIENTE_APROBACION: 'Espera aprobación',
  INVITADA: 'Invitación sin aceptar',
  ACTIVA: 'Activa',
  SUSPENDIDA: 'Suspendida',
  PENDIENTE_VERIFICACION: 'Falta confirmar el correo',
  RECHAZADA: 'Rechazada',
}

export function esEstadoCuenta(valor: unknown): valor is EstadoCuenta {
  return typeof valor === 'string' && ESTADOS_CUENTA.some((estado) => estado === valor)
}

/** El estado de una cuenta se dice con palabras: los colores de estado son del servicio de agua (ADR-107, D1). */
export function estadoCuentaEnPalabras(estado: string | undefined): string {
  return esEstadoCuenta(estado) ? ESTADOS[estado] : 'Estado desconocido'
}

/** F4 de cambios-para-frontend.md: la frase exacta; nunca «30 000 personas se registraron». */
export const FRASE_SINTETICAS = 'cuentas sintéticas generadas por el sistema con las reglas de alta de un vecino'

export function esSintetica(cuenta: CuentaPanel): boolean {
  return cuenta.sintetica === true
}

/** El contrato no filtra por `sintetica`: se ocultan aquí, y se cuenta cuántas, para no confundir una página vacía con una lista vacía. */
export function separarSinteticas(cuentas: readonly CuentaPanel[], mostrarSinteticas: boolean): { visibles: CuentaPanel[]; ocultas: number } {
  if (mostrarSinteticas) return { visibles: [...cuentas], ocultas: 0 }
  const visibles = cuentas.filter((cuenta) => !esSintetica(cuenta))
  return { visibles, ocultas: cuentas.length - visibles.length }
}

export function nombreDeCuenta(cuenta: Pick<CuentaPanel, 'nombre' | 'correo'>): string {
  return cuenta.nombre?.trim() || cuenta.correo || 'Cuenta sin nombre'
}

export type AccionCuenta = 'reenviar' | 'aprobar' | 'rechazar' | 'suspender' | 'reactivar' | 'permisos'

export interface AccionesDeCuenta {
  /** Es la cuenta de quien está mirando: ningún ADMIN puede cambiar su propio acceso (cuentas-y-sesion.md). */
  propia: boolean
  acciones: AccionCuenta[]
}

/**
 * Qué se ofrece sobre una cuenta según su estado (panel-veedor.md). Sobre la propia no se ofrece nada: con eso, quien actúa
 * siempre queda como ADMIN activo y ninguna acción puede dejar al sistema sin ninguno.
 */
export function accionesDeCuenta(cuenta: CuentaPanel, idPropio: string | undefined): AccionesDeCuenta {
  if (idPropio !== undefined && cuenta.id === idPropio) return { propia: true, acciones: [] }
  const esDePanel = esRolPanel(cuenta.rol)
  switch (cuenta.estado) {
    case 'INVITADA': return { propia: false, acciones: esDePanel ? ['reenviar'] : [] }
    case 'PENDIENTE_APROBACION': return { propia: false, acciones: esDePanel ? ['aprobar', 'rechazar'] : [] }
    case 'ACTIVA': return { propia: false, acciones: esDePanel ? ['permisos', 'suspender'] : ['suspender'] }
    case 'SUSPENDIDA': return { propia: false, acciones: ['reactivar'] }
    default: return { propia: false, acciones: [] }
  }
}

/** Por qué una fila no trae acciones, dicho en la propia fila. */
export function motivoSinAcciones(cuenta: CuentaPanel, propia: boolean): string {
  if (propia) return 'Es tu cuenta: no puedes cambiar tu propio acceso. Pídeselo a otro administrador.'
  switch (cuenta.estado) {
    case 'PENDIENTE_VERIFICACION': return 'Todavía no confirma su correo; no hay nada que decidir.'
    case 'RECHAZADA': return 'La solicitud se rechazó; no hay acciones.'
    default: return 'Esta cuenta no tiene acciones desde el panel.'
  }
}

export interface AjusteDePermisos {
  rol: RolPanel
  concedidos: Permiso[]
  revocados: Permiso[]
}

/** Los permisos efectivos de una cuenta, en el orden del contrato y sin los que el cliente no conoce. */
export function permisosDeCuenta(cuenta: CuentaPanel): Permiso[] {
  const efectivos = new Set((cuenta.permisosEfectivos ?? []).filter(esPermiso))
  return PERMISOS.filter((permiso) => efectivos.has(permiso))
}

/**
 * Convierte las casillas en `concedidos` y `revocados` respecto al rol. Una casilla es una sola cosa, así que un permiso no puede
 * quedar en las dos listas; el protegido nunca se revoca aunque la casilla llegue desmarcada.
 */
export function ajusteDePermisos(rol: RolPanel, marcados: ReadonlySet<Permiso>): AjusteDePermisos {
  const base = new Set<Permiso>(PERMISOS_DEL_ROL[rol])
  return {
    rol,
    concedidos: PERMISOS.filter((permiso) => marcados.has(permiso) && !base.has(permiso)),
    revocados: PERMISOS.filter((permiso) => !marcados.has(permiso) && base.has(permiso) && permiso !== PERMISO_PROTEGIDO),
  }
}

/** Las casillas de un rol recién elegido: sus permisos propios, sin los ajustes de la persona. */
export function marcadosDelRol(rol: RolPanel): Set<Permiso> {
  return new Set(PERMISOS_DEL_ROL[rol])
}

export function marcadosIniciales(cuenta: CuentaPanel, alternativa: RolPanel): { rol: RolPanel; marcados: Set<Permiso> } {
  const rol = esRolPanel(cuenta.rol) ? cuenta.rol : alternativa
  return { rol, marcados: cuenta.permisosEfectivos?.length ? new Set(permisosDeCuenta(cuenta)) : marcadosDelRol(rol) }
}

function mismos(a: readonly string[], b: ReadonlySet<string>): boolean {
  return a.length === b.size && a.every((valor) => b.has(valor))
}

/** Aprobar siempre es un cambio; en una cuenta activa, repetir lo mismo no lo es y el servidor igual cerraría sus sesiones. */
export function hayCambioDeAcceso(cuenta: CuentaPanel, rol: RolPanel, marcados: ReadonlySet<Permiso>): boolean {
  return cuenta.rol !== rol || !mismos(permisosDeCuenta(cuenta), marcados)
}

function lista(permisos: readonly Permiso[]): string {
  return permisos.map(permisoEnPalabras).join(', ')
}

/** Lo que se va a mandar, en palabras, para leerlo antes de confirmar. */
export function resumenDelAjuste(cuenta: CuentaPanel, ajuste: AjusteDePermisos): string[] {
  const lineas = [`Rol: ${rolEnPalabras(ajuste.rol)}${cuenta.rol && cuenta.rol !== ajuste.rol ? ` (era ${rolEnPalabras(cuenta.rol)})` : ''}.`]
  lineas.push(ajuste.concedidos.length ? `Se le suman: ${lista(ajuste.concedidos)}.` : 'No se le suma ningún permiso suelto.')
  lineas.push(ajuste.revocados.length ? `Se le quitan: ${lista(ajuste.revocados)}.` : 'No se le quita ningún permiso del rol.')
  return lineas
}

export interface TextosConfirmacionCuenta {
  pregunta: string
  boton: string
  enviando: string
  /** Suspender y cambiar el acceso cierran las sesiones abiertas de esa persona; se dice antes de confirmar. */
  cierraSesiones: boolean
}

/** Cada acción se confirma con el nombre de la cuenta afectada (guía §5.4). */
export function confirmacionCuenta(accion: AccionCuenta, cuenta: CuentaPanel): TextosConfirmacionCuenta {
  const nombre = nombreDeCuenta(cuenta)
  const correo = cuenta.correo ? ` (${cuenta.correo})` : ''
  switch (accion) {
    case 'reenviar':
      return { pregunta: `¿Reenviar la invitación a ${nombre}${correo}? El enlace anterior deja de servir y los 7 días empiezan de nuevo.`, boton: `Sí, reenviar a ${nombre}`, enviando: 'Reenviando…', cierraSesiones: false }
    case 'aprobar':
      return { pregunta: `¿Aprobar la cuenta de ${nombre}${correo} con este acceso?`, boton: `Sí, aprobar a ${nombre}`, enviando: 'Aprobando…', cierraSesiones: false }
    case 'rechazar':
      return { pregunta: `¿Rechazar la solicitud de ${nombre}${correo}? Esa cuenta no podrá entrar.`, boton: `Sí, rechazar a ${nombre}`, enviando: 'Rechazando…', cierraSesiones: false }
    case 'suspender':
      return { pregunta: `¿Suspender la cuenta de ${nombre}${correo}? No podrá entrar hasta que la reactives.`, boton: `Sí, suspender a ${nombre}`, enviando: 'Suspendiendo…', cierraSesiones: true }
    case 'reactivar':
      return { pregunta: `¿Reactivar la cuenta de ${nombre}${correo}? Podrá volver a entrar con su clave.`, boton: `Sí, reactivar a ${nombre}`, enviando: 'Reactivando…', cierraSesiones: false }
    case 'permisos':
      return { pregunta: `¿Cambiar el acceso de ${nombre}${correo}?`, boton: `Sí, cambiar el acceso de ${nombre}`, enviando: 'Guardando…', cierraSesiones: true }
  }
}

export const AVISO_CIERRE_DE_SESIONES = 'Se cerrarán todas las sesiones abiertas de esa persona; tendrá que ingresar de nuevo.'

/** Resumen de permisos de una fila: cuántos y, en el detalle, cuáles. */
export function permisosEnPalabras(cuenta: CuentaPanel): string {
  const permisos = permisosDeCuenta(cuenta)
  if (permisos.length === 0) return 'Sin permisos de panel'
  return permisos.length === 1 ? '1 permiso' : `${permisos.length} permisos`
}

/** Cuenta las que no son sintéticas de una página de un solo estado; con más páginas, la cifra es «N o más». */
export function contarReales(cuentas: readonly CuentaPanel[]): number {
  return cuentas.filter((cuenta) => !esSintetica(cuenta)).length
}
