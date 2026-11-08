import { useQuery } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'
import { consultarCuentaActual } from '../api/panel'
import { sesion, type Alcance } from '../api/sesion'
import { permisosDe, type Permiso } from '../dominio/permisos'
import { clienteConsultas } from './datos'

// Lo del panel pertenece a una sesión: al entrar, salir o cambiar de cuenta no se reutiliza nada de la anterior.
sesion.alCambiar(() => clienteConsultas.removeQueries({ queryKey: ['panel'] }))

export const MOTIVOS_INGRESO = ['vencida', 'cerrada', 'clave', 'segundo-factor'] as const
export type MotivoIngreso = typeof MOTIVOS_INGRESO[number]

export function esMotivoIngreso(valor: unknown): valor is MotivoIngreso {
  return MOTIVOS_INGRESO.some((motivo) => motivo === valor)
}

// Quien cierra la sesión por una acción propia (cambiar la clave, quitar el TOTP) dice por qué, para que el ingreso lo explique.
let motivoAnunciado: MotivoIngreso | null = null
sesion.alCambiar(() => {
  if (sesion.token()) motivoAnunciado = null
})

/** Se anuncia antes de llamar a la API, porque la sesión se borra dentro de ella; `null` retira el anuncio si la acción falló. */
export function anunciarSalida(motivo: MotivoIngreso | null): void {
  motivoAnunciado = motivo
}

/** Por qué se llegó al ingreso: lo anunciado, «cerrada» si la persona pulsó salir, o «vencida» si la sesión terminó sola. */
export function motivoDeSalida(perdida: boolean, saliendo = false): MotivoIngreso | undefined {
  return motivoAnunciado ?? (saliendo ? 'cerrada' : perdida ? 'vencida' : undefined)
}

export function useAlcance(): Alcance | null {
  return useSyncExternalStore(sesion.alCambiar, sesion.alcance, () => null)
}

/** Distingue «nunca hubo sesión» de «la sesión terminó mientras la pantalla estaba abierta». */
export function useSesionPerdida(alcance: Alcance | null): boolean {
  const [tuvoSesion, setTuvoSesion] = useState(alcance !== null)
  if (alcance !== null && !tuvoSesion) setTuvoSesion(true)
  return tuvoSesion && alcance === null
}

/** Permisos vigentes en la base de datos, no los que dice el token (cuentas-y-sesion.md, «Al recargar»). */
export function useCuentaActual(habilitada: boolean) {
  return useQuery({
    queryKey: ['panel', 'yo'],
    enabled: habilitada,
    queryFn: consultarCuentaActual,
    staleTime: 60_000,
  })
}

/**
 * Los permisos con los que la pantalla pinta sus acciones (panel-veedor.md): ocultar un botón no es seguridad, el servidor
 * valida siempre, pero un botón que el servidor va a rechazar es mala experiencia.
 */
export function usePermisos(): ReadonlySet<Permiso> {
  return permisosDe(useCuentaActual(true).data?.permisosEfectivos)
}
