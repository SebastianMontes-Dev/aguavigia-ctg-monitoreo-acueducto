import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { sesionVecino } from '../api/sesion-vecino'
import { consultarPerfil } from '../api/vecino'
import { clienteConsultas } from './datos'

// El perfil pertenece a una sesión: al entrar, salir o cambiar de cuenta no se reutiliza nada de la anterior.
sesionVecino.alCambiar(() => clienteConsultas.removeQueries({ queryKey: ['vecino'] }))

/** `true` mientras haya una sesión de vecino. Es independiente de la del panel (otro almacén, otro token). */
export function useHaySesionVecino(): boolean {
  return useSyncExternalStore(sesionVecino.alCambiar, () => sesionVecino.token() !== null, () => false)
}

/** El perfil con el estado vigente en la base de datos (`GET /api/vecino/yo`); sin sesión no pide nada. */
export function usePerfilVecino() {
  const conSesion = useHaySesionVecino()
  return useQuery({
    queryKey: ['vecino', 'yo'],
    enabled: conSesion,
    queryFn: ({ signal }) => consultarPerfil({ signal }),
    staleTime: 60_000,
    // Un 401 ya borró la sesión: reintentar solo gastaría peticiones.
    retry: (fallos, error) => (error as { estado?: number }).estado !== 401 && fallos < 2,
  })
}

export const MOTIVOS_VECINO = ['vencida', 'cerrada'] as const
export type MotivoVecino = typeof MOTIVOS_VECINO[number]

export function esMotivoVecino(valor: unknown): valor is MotivoVecino {
  return MOTIVOS_VECINO.some((motivo) => motivo === valor)
}
