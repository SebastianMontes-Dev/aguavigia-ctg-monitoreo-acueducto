import type { ResultadoSolicitud } from '../api/cuentas'
import type { ResultadoIngresoVecino, ResultadoPerfil, ResultadoVerificacion } from '../api/vecino'
import type { ResultadoUbicacion } from '../app/ubicacion'
import { minutos } from './mensajes-panel'

/** La misma frase exista o no la cuenta (cuentas-y-sesion.md): una respuesta distinta dejaría averiguar qué correos tienen cuenta. */
export const NEUTRO = {
  acceso: 'Si la dirección es válida, te enviamos un correo para confirmarla.',
  restablecer: 'Si hay una cuenta con ese correo, te enviamos un enlace para elegir una clave nueva. Vence en 30 minutos.',
  reenvio: 'Si hay una solicitud pendiente, te reenviamos el correo.',
  vecino: 'Si la dirección es válida, te enviamos un correo con un enlace para elegir tu clave.',
} as const

/** `Retry-After` en palabras: los 3 intentos diarios de verificar el barrio se miden en horas, el tope por IP en minutos. */
export function esperaLegible(segundos: number): string {
  if (segundos >= 3600) {
    const horas = Math.ceil(segundos / 3600)
    return horas === 1 ? '1 hora' : `${horas} horas`
  }
  return minutos(segundos)
}

function esperar(segundos: number | null): string {
  return segundos
    ? `Hiciste demasiados intentos. Podrás volver a intentarlo en ${esperaLegible(segundos)}.`
    : 'Hiciste demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
}

/** Lo que un envío por correo dice cuando no llegó a un `202`; el `202` lo dice la pantalla con su frase neutra. */
export function mensajeSolicitud(resultado: ResultadoSolicitud): string | null {
  switch (resultado.tipo) {
    case 'recibido':
      return null
    case 'rechazado':
      // Si el servidor repartió sus errores por campo, cada uno va junto al suyo y aquí solo queda el resumen.
      return Object.keys(resultado.campos).length > 0 ? 'Revisa los campos marcados.' : resultado.mensaje
    case 'esperar':
      return resultado.segundos
        ? `Hiciste demasiadas solicitudes. Podrás volver a intentarlo en ${esperaLegible(resultado.segundos)}.`
        : 'Hiciste demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.'
    case 'sin-red':
      return 'No pudimos comprobar si se recibió la solicitud. Revisa tu conexión antes de volver a enviarla.'
    case 'fallo':
      return 'No pudimos comprobar si se recibió la solicitud. Inténtalo de nuevo más tarde.'
  }
}

export function mensajeIngresoVecino(resultado: ResultadoIngresoVecino): string | null {
  switch (resultado.tipo) {
    case 'ingresado':
      return null
    // La clave mala, una cuenta que aún no eligió clave y una cuenta del panel dan la misma 401: el mensaje no las distingue.
    case 'credencial-invalida':
      return 'Correo o clave incorrectos. Si te registraste hace poco, primero elige tu clave con el enlace del correo.'
    case 'no-habilitada':
      return resultado.estado === 'SUSPENDIDA'
        ? 'Tu cuenta está suspendida. No puedes ingresar por ahora.'
        : 'Tu cuenta todavía no puede ingresar. Revisa el correo que te enviamos al registrarte.'
    case 'bloqueada':
      return resultado.segundos
        ? `La cuenta está bloqueada por intentos fallidos. Podrás ingresar en ${esperaLegible(resultado.segundos)}.`
        : 'La cuenta está bloqueada por intentos fallidos. Espera unos minutos.'
    case 'esperar':
      return esperar(resultado.segundos)
    case 'rechazado':
      return resultado.mensaje
    case 'sin-red':
      return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo otra vez.'
    case 'fallo':
      return 'Algo falló de nuestro lado. Inténtalo otra vez en un momento.'
  }
}

export function mensajePerfil(resultado: ResultadoPerfil): string | null {
  switch (resultado.tipo) {
    case 'guardado':
    case 'sesion-terminada':
      return null
    case 'rechazado':
      return Object.keys(resultado.campos).length > 0 ? 'Revisa los campos marcados.' : resultado.mensaje
    case 'conflicto':
      return 'Tu cuenta cambió mientras guardábamos. Actualizamos tus datos; revisa y vuelve a guardar.'
    case 'esperar':
      return esperar(resultado.segundos)
    case 'sin-red':
      return 'No pudimos guardar los cambios. Revisa tu conexión e inténtalo otra vez.'
    case 'fallo':
      return 'No pudimos guardar los cambios. Inténtalo otra vez en un momento.'
  }
}

/** `barrio` es el nombre del barrio que declaró el vecino, para decir contra cuál se comparó su ubicación. */
export function mensajeVerificacion(resultado: ResultadoVerificacion | Exclude<ResultadoUbicacion, { tipo: 'ubicada' }>, barrio: string): string | null {
  switch (resultado.tipo) {
    case 'verificado':
    case 'sesion-terminada':
      return null
    case 'fuera-del-barrio':
      return `Tu ubicación no está dentro de ${barrio}. Si vives en otro barrio, corrígelo en tus datos; si no, inténtalo desde tu casa.`
    case 'imprecisa':
      return 'Tu ubicación es aproximada: no alcanza para saber en qué barrio estás. Activa el GPS del teléfono e inténtalo otra vez. Esto no cuenta como intento.'
    case 'agotado':
      return resultado.segundos
        ? `Usaste los 3 intentos de hoy. Podrás volver a intentarlo en ${esperaLegible(resultado.segundos)}.`
        : 'Usaste los 3 intentos de hoy. Inténtalo mañana.'
    case 'conflicto':
      return 'Tu cuenta cambió mientras comprobábamos. Actualizamos tus datos; inténtalo otra vez.'
    case 'denegada':
      return 'No tenemos permiso para usar tu ubicación. Puedes darlo en los ajustes del navegador e intentarlo otra vez.'
    case 'agotada':
      return 'Tu teléfono tardó demasiado en encontrar tu ubicación. Inténtalo otra vez.'
    case 'no-disponible':
      return 'No pudimos saber dónde estás. Este navegador o este equipo no comparte la ubicación.'
    case 'sin-red':
      return 'No pudimos comprobar tu barrio. Revisa tu conexión e inténtalo otra vez.'
    case 'fallo':
      return 'No pudimos comprobar tu barrio. Inténtalo otra vez en un momento.'
  }
}
