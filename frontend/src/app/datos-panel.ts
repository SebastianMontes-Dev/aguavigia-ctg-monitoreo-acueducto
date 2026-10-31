import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ResultadoAccion } from '../api/acciones-panel'
import { api, normalizarError } from '../api/cliente'
import { leerCorte, leerCortesDelBarrio, leerDisputas, leerVencidos } from '../api/cortes-veedor'
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
