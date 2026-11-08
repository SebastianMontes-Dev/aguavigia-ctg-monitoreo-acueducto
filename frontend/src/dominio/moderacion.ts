import type { components } from '../api/generado/esquema'

export type ReporteModeracion = components['schemas']['ReporteModeracionRespuesta']

const TIPOS: Record<string, string> = {
  SIN_AGUA: 'No tiene agua',
  PRESION_BAJA: 'Llega poca agua',
  SERVICIO_RESTABLECIDO: 'Dice que ya volvió el agua',
}

/** El tipo de reporte con las palabras que usa el vecino al reportar; uno desconocido no se inventa. */
export function tipoEnPalabras(tipo: string | undefined): string {
  return (tipo && TIPOS[tipo]) ?? 'Reporte sin tipo conocido'
}

const VERIFICACIONES: Record<string, string> = {
  CUENTA_VERIFICADA: 'Cuenta verificada en este barrio',
  UBICACION_VERIFICADA: 'Ubicación verificada dentro del barrio',
  NINGUNA: 'Sin verificar: no hay cuenta ni ubicación que lo respalde',
}

/** cambios-para-frontend.md F2: lo decide el servidor, el panel solo lo dice. */
export function verificacionEnPalabras(verificacion: string | undefined): string {
  return (verificacion && VERIFICACIONES[verificacion]) ?? 'Sin dato de verificación'
}

/** Es una señal para mirar primero, no una acusación ni un bloqueo (panel-veedor.md): una sala o una antena comparten red. */
export const SENAL_DE_RED = 'Viene de una red con una ráfaga de reportes a este barrio. Míralo primero.'

export type FotoDeReporte =
  | { tipo: 'sin-foto' }
  | { tipo: 'descartada' }
  | { tipo: 'visible'; nombre: string; publica: boolean }
  | { tipo: 'no-disponible' }

/** El nombre de archivo de `/api/veedor/fotos/{nombre}`; solo el panel pide la imagen, así que no se arma ninguna ruta a mano. */
export function nombreDeFoto(fotoUrl: string | undefined): string | null {
  if (!fotoUrl) return null
  const ruta = fotoUrl.split(/[?#]/)[0] ?? ''
  const ultimo = ruta.split('/').filter(Boolean).at(-1)
  if (!ultimo) return null
  let nombre: string
  try {
    nombre = decodeURIComponent(ultimo)
  } catch {
    return null
  }
  return /^[\w.-]+$/.test(nombre) ? nombre : null
}

export function fotoDe(reporte: ReporteModeracion): FotoDeReporte {
  const estado = reporte.fotoEstado
  if (!estado || estado === 'SIN_FOTO') return { tipo: 'sin-foto' }
  if (estado === 'DESCARTADA') return { tipo: 'descartada' }
  const nombre = nombreDeFoto(reporte.fotoUrl)
  if (!nombre || (estado !== 'EN_REVISION' && estado !== 'PUBLICA')) return { tipo: 'no-disponible' }
  return { tipo: 'visible', nombre, publica: estado === 'PUBLICA' }
}

export type AccionModeracion = 'aprobar' | 'descartar' | 'foto'

/** La pregunta de la confirmación: dice qué pasa con el reporte y con su foto antes de pulsar. */
export function confirmacionDe(accion: AccionModeracion, tieneFoto: boolean): { pregunta: string; boton: string; enviando: string } {
  switch (accion) {
    case 'aprobar':
      return {
        pregunta: tieneFoto
          ? 'Al aprobarlo, el reporte cuenta como revisado y su foto pasa a ser pública.'
          : 'Al aprobarlo, el reporte cuenta como revisado.',
        boton: 'Sí, aprobar',
        enviando: 'Aprobando…',
      }
    case 'descartar':
      return {
        pregunta: 'Un reporte descartado deja de contar para el consenso del barrio, pero sigue contando para el cupo del dispositivo.',
        boton: 'Sí, descartar',
        enviando: 'Descartando…',
      }
    case 'foto':
      return {
        pregunta: 'Se retira solo la foto. El reporte y su voto siguen como están.',
        boton: 'Sí, descartar la foto',
        enviando: 'Descartando…',
      }
  }
}
