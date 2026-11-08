import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ResultadoAccion } from '../api/acciones-panel'
import { leerAuditoria, leerCopias, leerCuentas, leerCuentasVisibles, leerMetricas, type FiltroCuentas } from '../api/administracion'
import { api, normalizarError } from '../api/cliente'
import { leerCorte, leerCortesDelBarrio, leerDisputas, leerVencidos } from '../api/cortes-veedor'
import { leerFallidos, leerPropuestas, leerSalud } from '../api/ingesta'
import { blobADataUrl, leerFotoDelPanel, leerPendientes } from '../api/moderacion'
import type { Sector } from '../dominio/sectores'

// Todo cuelga de ['panel']: al entrar, salir o cambiar de cuenta, `app/panel.ts` lo borra (nada de una sesión pasa a la siguiente).

/** La cola de moderación; cada página es una petición, pedida solo al pulsar «Cargar más». */
export function usePendientes() {
  return useInfiniteQuery({
    queryKey: ['panel', 'pendientes'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => leerPendientes(pageParam, { signal }),
    getNextPageParam: (ultima) => (ultima.paginacion.hayMas ? ultima.paginacion.pagina + 1 : undefined),
    staleTime: 15_000,
  })
}

/** La foto de un reporte, pedida con el token. Un archivo no cambia: se conserva mientras la pestaña siga abierta. */
export function useFotoPanel(nombre: string | null) {
  return useQuery({
    queryKey: ['panel', 'foto', nombre],
    enabled: nombre !== null,
    queryFn: async ({ signal }) => blobADataUrl(await leerFotoDelPanel(nombre ?? '', { signal })),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  })
}

/** Un GET puntual y no `useListado()`: el listado abriría el canal en vivo en una pantalla que no muestra el mapa. */
export function useBarriosPanel() {
  return useQuery({
    queryKey: ['panel', 'barrios'],
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/sectores', { signal }).catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response?.ok || !data) throw normalizarError(response ?? null, error)
      return data.sectores as Sector[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useCortesDelBarrio(sectorId: string | undefined) {
  return useQuery({
    queryKey: ['panel', 'cortes', 'barrio', sectorId],
    enabled: Boolean(sectorId),
    queryFn: ({ signal }) => leerCortesDelBarrio(sectorId ?? '', { signal }),
    staleTime: 15_000,
  })
}

export function useCorteDelPanel(id: string | undefined) {
  return useQuery({
    queryKey: ['panel', 'cortes', 'detalle', id],
    enabled: Boolean(id),
    queryFn: ({ signal }) => leerCorte(id ?? '', { signal }),
    staleTime: 15_000,
  })
}

export function useVencidos() {
  return useQuery({ queryKey: ['panel', 'cortes', 'vencidos'], queryFn: ({ signal }) => leerVencidos({ signal }), staleTime: 15_000 })
}

export function useDisputas() {
  return useQuery({ queryKey: ['panel', 'disputas'], queryFn: ({ signal }) => leerDisputas({ signal }), staleTime: 15_000 })
}

/** FE4 · Las propuestas de la ingesta que esperan a un veedor; cada página es una petición, pedida al pulsar «Cargar más». */
export function usePropuestas() {
  return useInfiniteQuery({
    queryKey: ['panel', 'ingesta', 'propuestas'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => leerPropuestas(pageParam, { signal }),
    getNextPageParam: (ultima) => (ultima.paginacion.hayMas ? ultima.paginacion.pagina + 1 : undefined),
    staleTime: 15_000,
  })
}

export function useFallidos() {
  return useQuery({ queryKey: ['panel', 'ingesta', 'fallidos'], queryFn: ({ signal }) => leerFallidos({ signal }), staleTime: 15_000 })
}

export function useSaludColectores() {
  return useQuery({ queryKey: ['panel', 'ingesta', 'salud'], queryFn: ({ signal }) => leerSalud({ signal }), staleTime: 15_000 })
}

/**
 * FE5 · Una página de cuentas con el filtro elegido, a partir de `inicio`; sin las sintéticas, salta las páginas hechas solo de ellas.
 * Al cambiar de página se conserva la anterior mientras llega la nueva.
 */
export function useCuentas(filtro: FiltroCuentas, inicio: number, ocultarSinteticas: boolean, habilitada = true) {
  return useQuery({
    enabled: habilitada,
    queryKey: ['panel', 'cuentas', 'lista', filtro.estado ?? '', filtro.barrioId ?? '', inicio, ocultarSinteticas],
    queryFn: ({ signal }) => leerCuentasVisibles(inicio, filtro, ocultarSinteticas, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

const ESTADOS_EN_COLA = ['PENDIENTE_APROBACION', 'INVITADA', 'SUSPENDIDA'] as const

/** Lo que espera una decisión: una página por estado (son listas cortas) para contar sin las sintéticas. */
export function useColaDeCuentas(habilitada = true) {
  return useQueries({
    queries: ESTADOS_EN_COLA.map((estado) => ({
      enabled: habilitada,
      queryKey: ['panel', 'cuentas', 'cola', estado],
      queryFn: ({ signal }: { signal: AbortSignal }) => leerCuentas(0, { estado }, { signal }),
      staleTime: 15_000,
    })),
  })
}

export function useAuditoria(pagina: number, habilitada = true) {
  return useQuery({
    enabled: habilitada,
    queryKey: ['panel', 'auditoria', pagina],
    queryFn: ({ signal }) => leerAuditoria(pagina, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useMetricas() {
  return useQuery({ queryKey: ['panel', 'sistema', 'metricas'], queryFn: ({ signal }) => leerMetricas({ signal }), staleTime: 15_000 })
}

/** Un `503` no se reintenta: la copia está apagada y volver a pedirla no la enciende. */
export function useCopias() {
  return useQuery({
    queryKey: ['panel', 'sistema', 'copias'],
    queryFn: ({ signal }) => leerCopias({ signal }),
    staleTime: 15_000,
    retry: (fallos, error) => (error as { estado?: number }).estado !== 503 && fallos < 2 && (error as { reintentable?: boolean }).reintentable !== false,
  })
}

/**
 * Una acción del panel a la vez: el cerrojo se cierra de inmediato, no al re-pintar, así que dos clics seguidos no mandan dos
 * peticiones (un `PATCH` repetido respondería `409` sobre lo que sí se hizo).
 */
export function useAccion() {
  const [enviando, setEnviando] = useState(false)
  const cerrojo = useRef(false)
  const ejecutar = useCallback(async <T>(accion: () => Promise<ResultadoAccion<T>>): Promise<ResultadoAccion<T> | null> => {
    if (cerrojo.current) return null
    cerrojo.current = true
    setEnviando(true)
    try {
      return await accion()
    } finally {
      cerrojo.current = false
      setEnviando(false)
    }
  }, [])
  return { enviando, ejecutar }
}
