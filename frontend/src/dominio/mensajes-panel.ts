import type { ResultadoAccion } from '../api/acciones-panel'
import type { ResultadoAlta, ResultadoConfirmacionFactor, ResultadoCuenta, ResultadoIngreso } from '../api/panel'

const SIN_RED = 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo otra vez.'
const FALLO = 'Algo falló de nuestro lado. Inténtalo otra vez en un momento.'

/** cuentas-y-sesion.md, «Estados de una cuenta»: por qué no puede entrar y qué le queda por hacer. */
const CUENTA_NO_HABILITADA: Record<string, string> = {
  PENDIENTE_VERIFICACION: 'Falta confirmar tu correo. Abre el enlace que te enviamos al pedir la cuenta.',
  PENDIENTE_APROBACION: 'Tu correo ya está confirmado. Falta que un administrador apruebe la cuenta.',
  INVITADA: 'Falta aceptar la invitación: abre el enlace del correo y elige tu clave.',
  SUSPENDIDA: 'Tu cuenta está suspendida. Habla con un administrador del panel.',
  RECHAZADA: 'La solicitud de esta cuenta fue rechazada.',
}

export function minutos(segundos: number): string {
  const total = Math.max(1, Math.ceil(segundos / 60))
  return total === 1 ? '1 minuto' : `${total} minutos`
}

function esperar(segundos: number | null): string {
  return segundos
    ? `Hiciste demasiados intentos. Podrás volver a intentarlo en ${minutos(segundos)}.`
    : 'Hiciste demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
}

export function mensajeIngreso(resultado: ResultadoIngreso, conCodigo: boolean): string | null {
  switch (resultado.tipo) {
    case 'ingresado':
    case 'pide-codigo':
      return null
    // Con el código en pantalla la clave ya se aceptó: lo que no coincide es el código.
    case 'credencial-invalida':
      return conCodigo
        ? 'El código no coincide o ya se usó. Espera el siguiente código de la app y escríbelo.'
        : 'Correo o clave incorrectos.'
    case 'no-habilitada':
      return (resultado.estado && CUENTA_NO_HABILITADA[resultado.estado]) ?? resultado.mensaje
    case 'bloqueada':
      return resultado.segundos
        ? `La cuenta está bloqueada por intentos fallidos. Podrás ingresar en ${minutos(resultado.segundos)}.`
        : 'La cuenta está bloqueada por intentos fallidos. Espera unos minutos.'
    case 'esperar':
      return esperar(resultado.segundos)
    case 'rechazado':
      return resultado.mensaje
    case 'sin-red':
      return SIN_RED
    case 'fallo':
      return FALLO
  }
}

/** Resultado de cambiar la clave o quitar el segundo factor; `hecho` y `sesion-terminada` no se dicen aquí: llevan al ingreso. */
export function mensajeCuenta(resultado: ResultadoCuenta): string | null {
  switch (resultado.tipo) {
    case 'hecho':
    case 'sesion-terminada':
      return null
    case 'rechazado':
      return resultado.mensaje
    case 'codigo-incorrecto':
      return 'El código no coincide o ya se usó. Espera el siguiente código de la app y escríbelo.'
    case 'obligatorio':
      return 'El rol de administrador exige segundo factor: no se puede desactivar.'
    case 'sin-permiso':
      return 'Tu sesión no puede hacer esto. Si acabas de crear la cuenta, configura primero el segundo factor.'
    case 'bloqueada':
      return resultado.segundos
        ? `La cuenta está bloqueada por intentos fallidos. Podrás intentarlo en ${minutos(resultado.segundos)}.`
        : 'La cuenta está bloqueada por intentos fallidos. Espera unos minutos.'
    case 'esperar':
      return esperar(resultado.segundos)
    case 'sin-red':
      return SIN_RED
    case 'fallo':
      return FALLO
  }
}

export function mensajeSegundoFactor(resultado: ResultadoAlta | ResultadoConfirmacionFactor): string | null {
  switch (resultado.tipo) {
    case 'alta':
    case 'activado':
    case 'sesion-terminada':
      return null
    case 'ya-activo':
      return 'Esta cuenta ya tiene un segundo factor activo. Para cambiar de teléfono, entra al panel y ve a Seguridad.'
    case 'sin-alta':
      return 'El código QR ya no está vigente. Genera uno nuevo y escanéalo otra vez.'
    case 'codigo-incorrecto':
      return 'El código no coincide. Revisa que la hora del teléfono sea la correcta y escribe el código que la app muestra ahora.'
    case 'esperar':
      return esperar(resultado.segundos)
    case 'sin-red':
      return SIN_RED
    case 'fallo':
      return FALLO
  }
}

export type ContextoAccion =
  | 'aprobar' | 'descartar' | 'foto' | 'alta' | 'cierre' | 'cierre-barrio' | 'confirmacion' | 'anulacion'
  | 'aprobar-propuesta' | 'descartar-propuesta' | 'anular-propuesta'
  | 'invitar' | 'reenviar' | 'aprobar-cuenta' | 'rechazar-cuenta' | 'suspender' | 'reactivar' | 'acceso-cuenta'

const SOBRE_REPORTE: ContextoAccion[] = ['aprobar', 'descartar', 'foto']
const SOBRE_PROPUESTA: ContextoAccion[] = ['aprobar-propuesta', 'descartar-propuesta', 'anular-propuesta']
const SOBRE_CUENTA: ContextoAccion[] = ['reenviar', 'aprobar-cuenta', 'rechazar-cuenta', 'suspender', 'reactivar', 'acceso-cuenta']

/** panel-veedor.md, tabla de códigos: cada `409` dice qué ya estaba hecho, para que nadie piense que su clic falló. */
const CONFLICTOS: Record<ContextoAccion, string> = {
  aprobar: 'Este reporte ya fue decidido por otra persona. Actualizamos la cola.',
  descartar: 'Este reporte ya fue decidido por otra persona. Actualizamos la cola.',
  foto: 'Este reporte no tiene una foto que descartar. Actualizamos la cola.',
  alta: 'El servidor no pudo registrar el corte tal como está. Revisa los datos e inténtalo otra vez.',
  cierre: 'Este corte ya estaba cerrado. Actualizamos sus barrios.',
  'cierre-barrio': 'Este barrio ya estaba cerrado. Actualizamos el corte.',
  confirmacion: 'Este cierre ya estaba confirmado. Actualizamos el corte.',
  anulacion: 'Este corte ya estaba anulado. Actualizamos el corte.',
  'aprobar-propuesta': 'No se pudo aprobar: la propuesta ya fue descartada o su barrio ya no existe. Actualizamos la lista.',
  'descartar-propuesta': 'No se pudo descartar: la propuesta ya fue aprobada. Si fue un error, anula la aprobación. Actualizamos la lista.',
  'anular-propuesta': 'No hay nada que anular: la propuesta no estaba aprobada. Actualizamos la lista.',
  invitar: 'Ya existe una cuenta con ese correo. Búscala en la lista: si sigue sin aceptar, puedes reenviarle la invitación.',
  reenviar: 'Esa persona ya aceptó la invitación, así que no hay nada que reenviar. Actualizamos la lista.',
  'aprobar-cuenta': 'Esta cuenta ya no está esperando aprobación, o es la tuya. Actualizamos la lista.',
  'rechazar-cuenta': 'Esta cuenta ya no está esperando aprobación, o es la tuya. Actualizamos la lista.',
  suspender: 'No se pudo suspender: la cuenta ya no está activa, es la tuya o dejaría al sistema sin ningún administrador activo. Actualizamos la lista.',
  reactivar: 'No se pudo reactivar: la cuenta ya no está suspendida. Actualizamos la lista.',
  'acceso-cuenta': 'No se pudo cambiar el acceso: dejaría al sistema sin ningún administrador activo, es tu propia cuenta o la cuenta cambió. Actualizamos la lista.',
}

const RECHAZOS: Partial<Record<ContextoAccion, string>> = {
  alta: 'El servidor no aceptó los datos. Revisa que los barrios existan y que el fin prometido sea posterior al inicio.',
  anulacion: 'Falta el motivo de la anulación.',
  'anular-propuesta': 'Falta el motivo de la anulación.',
  invitar: 'El servidor no aceptó la invitación. Revisa el correo, el nombre y el rol.',
  'aprobar-cuenta': 'El servidor no aceptó ese acceso. Un permiso no puede sumarse y quitarse a la vez, y el segundo factor no se quita.',
  'acceso-cuenta': 'El servidor no aceptó ese acceso. Un permiso no puede sumarse y quitarse a la vez, y el segundo factor no se quita.',
  cierre: 'El servidor no aceptó esa hora real. Revisa la fecha y la hora.',
  'cierre-barrio': 'El servidor no aceptó esa hora real. Revisa la fecha y la hora.',
  confirmacion: 'El servidor no aceptó esa hora real. Revisa la fecha y la hora.',
}

/** Resultado de moderar un reporte o de gestionar un corte; `hecho` y `sesion-terminada` no se dicen aquí: lo uno se ve y lo otro lleva al ingreso. */
export function mensajeAccion(resultado: ResultadoAccion<unknown>, contexto: ContextoAccion): string | null {
  switch (resultado.tipo) {
    case 'hecho':
    case 'sesion-terminada':
      return null
    case 'no-existe':
      if (SOBRE_PROPUESTA.includes(contexto)) return 'Esta propuesta ya no existe. Actualizamos la lista.'
      if (SOBRE_CUENTA.includes(contexto)) return 'Esta cuenta ya no existe. Actualizamos la lista.'
      return SOBRE_REPORTE.includes(contexto)
        ? 'Este reporte ya no está en la cola. Actualizamos la lista.'
        : 'Este corte ya no existe. Actualizamos la lista.'
    case 'conflicto':
      return CONFLICTOS[contexto]
    case 'rechazado':
      return RECHAZOS[contexto] ?? 'El servidor no aceptó los datos. Revísalos e inténtalo otra vez.'
    case 'sin-permiso':
      return 'Tu sesión ya no tiene permiso para hacer esto. Actualizamos tus permisos.'
    case 'esperar':
      return esperar(resultado.segundos)
    case 'sin-red':
      return SIN_RED
    case 'fallo':
      return FALLO
  }
}
