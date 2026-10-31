import type { components } from '../api/generado/esquema'

export type EventoAuditoria = components['schemas']['EventoAuditoriaRespuesta']

// AccionAuditada del backend. Un código que el cliente no conoce se muestra tal cual, sin traducirlo a ciegas.
const ACCIONES: Record<string, string> = {
  CUENTA_REGISTRADA: 'Se registró una cuenta',
  CORREO_VERIFICADO: 'Se confirmó un correo',
  CUENTA_INVITADA: 'Se invitó a una persona',
  INVITACION_ACEPTADA: 'Se aceptó una invitación',
  CUENTA_APROBADA: 'Se aprobó una cuenta',
  CUENTA_RECHAZADA: 'Se rechazó una cuenta',
  CUENTA_SUSPENDIDA: 'Se suspendió una cuenta',
  CUENTA_REACTIVADA: 'Se reactivó una cuenta',
  PERMISOS_CAMBIADOS: 'Se cambió el acceso de una cuenta',
  CLAVE_RESTABLECIDA: 'Se restableció una clave',
  CLAVE_CAMBIADA: 'Se cambió una clave',
  SEGUNDO_FACTOR_ACTIVADO: 'Se activó el segundo factor',
  SEGUNDO_FACTOR_DESACTIVADO: 'Se desactivó el segundo factor',
  SESION_INICIADA: 'Se inició sesión',
  SESION_RECHAZADA: 'Se rechazó un inicio de sesión',
  CORTE_ANULADO: 'Se anuló un corte',
  PROPUESTA_ANULADA: 'Se anuló una propuesta de la ingesta',
  PERFIL_ACTUALIZADO: 'Se actualizó un perfil',
  BARRIO_VERIFICADO: 'Se verificó un barrio',
  CUENTA_SINTETICA_ACTIVADA: 'El sistema activó un lote de cuentas sintéticas',
}

export function accionEnPalabras(accion: string | undefined): string {
  if (!accion) return 'Acción sin nombre'
  return ACCIONES[accion] ?? accion
}

/** `autorCorreo` es nulo cuando actúa el sistema o alguien sin sesión (contrato): se dice así, sin inventar un autor. */
export function autorEnPalabras(evento: EventoAuditoria): string {
  return evento.autorCorreo?.trim() || 'El sistema o alguien sin sesión'
}

export function sujetoEnPalabras(evento: EventoAuditoria): string {
  return evento.sujetoCorreo?.trim() || 'Sin cuenta afectada'
}
