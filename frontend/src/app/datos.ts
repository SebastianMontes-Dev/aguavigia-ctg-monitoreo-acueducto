import { QueryClient, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { api, normalizarError } from '../api/cliente'
import { crearCanal, entornoNavegador, type LecturaCanal } from '../api/canal-en-vivo'
import { almacenIndexedDb, cargarGeometria } from '../api/geometria'
import { leerPaginacion } from '../api/paginacion'
import type { Corte } from '../dominio/cortes'
import type { Sector } from '../dominio/sectores'
import type { Calidad, Indice, PuntoSerie } from '../dominio/cumplimiento'
import type { TipoBitacora } from '../dominio/historia'
import type { components } from '../api/generado/esquema'

// Solo GET: TanStack Query no reintenta mutaciones por defecto y aquí no se cambia (plan §6.1).
export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (fallos, error) => fallos < 3 && (error as { reintentable?: boolean }).reintentable !== false,
      retryDelay: (intento) => Math.min(30_000, 1000 * 2 ** intento * (0.5 + Math.random())),
      refetchOnWindowFocus: false,
    },
  },
})

let canal: ReturnType<typeof crearCanal> | null = null
let usuarios = 0
function obtenerCanal() {
  canal ??= crearCanal(entornoNavegador())
  return canal
}

// Varias piezas leen el listado a la vez; el canal se abre con la primera y se cierra con la última.
function usarCanal(instancia: ReturnType<typeof crearCanal>): () => void {
  if (usuarios++ === 0) instancia.iniciar()
  return () => { if (--usuarios === 0) instancia.detener() }
}

export interface Listado {
  lectura: LecturaCanal
  porId: ReadonlyMap<string, Sector>
  sectores: readonly Sector[]
  reintentar: () => void
}

/** El canal en vivo es el dueño del listado: lo pide al empezar, al recibir un aviso y al volver a la pestaña. */
export function useListado(): Listado {
  const instancia = obtenerCanal()
  const lectura = useSyncExternalStore(instancia.suscribir, instancia.lectura)
  useEffect(() => usarCanal(instancia), [instancia])
  const sectores = useMemo(() => lectura.listado?.sectores ?? [], [lectura.listado])
  const porId = useMemo(() => new Map(sectores.map((sector) => [sector.id ?? '', sector])), [sectores])
  return { lectura, porId, sectores, reintentar: instancia.actualizar }
}

/**
 * F4: el modo se pide una vez al abrir la aplicación (el servidor lo recuerda un minuto). Si falla no se insiste: sin
 * respuesta no hay banner, y la consulta nunca retrasa la primera respuesta del mapa.
 */
export function useModoSistema() {
  return useQuery({
    queryKey: ['modo-sistema'],
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/sistema/modo', { signal })
        .catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return data
    },
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useGeometria() {
  return useQuery({
    queryKey: ['geometria'],
    queryFn: () => cargarGeometria(almacenIndexedDb()),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

const TAMANO_CORTES = 10

/** Se pide al abrir la ficha, nunca en segundo plano (docs/api/sectores-y-tiempo-real.md). */
export function useCortes(id: string) {
  return useInfiniteQuery({
    queryKey: ['cortes', id],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error, response } = await api.GET('/api/sectores/{sectorId}/cortes', {
        params: { path: { sectorId: id }, query: { pagina: pageParam, tamano: TAMANO_CORTES } },
        signal,
      }).catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return { cortes: data as Corte[], paginacion: leerPaginacion(response.headers, pageParam) }
    },
    getNextPageParam: (ultima) => (ultima.paginacion.hayMas ? ultima.paginacion.pagina + 1 : undefined),
    staleTime: 60_000,
  })
}

export function useIndiceCumplimiento(sectorId?: string) {
  return useQuery({
    queryKey: ['cumplimiento', sectorId ?? 'global'],
    queryFn: async ({ signal }) => {
      const resultado = sectorId
        ? await api.GET('/api/cumplimiento/sectores/{sectorId}', { params: { path: { sectorId } }, signal })
          .catch(() => ({ data: undefined, error: undefined, response: null }))
        : await api.GET('/api/cumplimiento', { signal })
          .catch(() => ({ data: undefined, error: undefined, response: null }))
      const { data, error, response } = resultado
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return data as Indice
    },
    staleTime: 5_000,
  })
}

/** F4: responde siempre, también cuando el índice da 400; solo se pide entonces, porque el índice ya trae su solidez. */
export function useCalidadCumplimiento(sectorId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['cumplimiento-calidad', sectorId ?? 'global'],
    enabled: habilitado,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/cumplimiento/calidad', { params: { query: { sectorId } }, signal })
        .catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return data as Calidad
    },
    staleTime: 5_000,
  })
}

/** El índice de un corte entero; se pide al abrir su detalle. `409` = el corte aún no tiene todos sus barrios cerrados. */
export function useIndiceCorte(corteId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['cumplimiento-corte', corteId],
    enabled: habilitado && Boolean(corteId),
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/cumplimiento/cortes/{corteId}', { params: { path: { corteId } }, signal })
        .catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return data as Indice
    },
    retry: (fallos, error) => fallos < 2 && ![404, 409].includes((error as { estado?: number }).estado ?? 0),
    staleTime: 60_000,
  })
}

export interface FiltrosSerie {
  sectorId?: string
  desde?: string
  hasta?: string
}

export function useSerieCumplimiento(filtros: FiltrosSerie, habilitado = true) {
  return useQuery({
    queryKey: ['cumplimiento-serie', filtros.sectorId, filtros.desde, filtros.hasta],
    enabled: habilitado,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/cumplimiento/serie', {
        params: { query: { sectorId: filtros.sectorId, desde: filtros.desde, hasta: filtros.hasta } }, signal,
      }).catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return data as PuntoSerie[]
    },
    staleTime: 5_000,
  })
}

export function useEstadisticas() {
  return useQuery({
    queryKey: ['estadisticas'],
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/estadisticas', { signal })
        .catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return data as components['schemas']['EstadisticasRespuesta']
    },
    staleTime: 5_000,
  })
}

export interface FiltrosBitacora {
  sector?: string
  tipo?: TipoBitacora
  desde?: string
  hasta?: string
}

// ADR-077: en el celular, un lote que quepa en pantalla y media; en escritorio, uno que llene el primer pliegue.
function tamanoLoteBitacora(): number {
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 599px)').matches ? 6 : 10
}

export function useBitacora(filtros: FiltrosBitacora) {
  const tamano = useMemo(() => tamanoLoteBitacora(), [])
  return useInfiniteQuery({
    queryKey: ['bitacora', tamano, filtros.sector, filtros.tipo, filtros.desde, filtros.hasta],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error, response } = await api.GET('/api/bitacora', {
        params: { query: { pagina: pageParam, tamano, sectorId: filtros.sector, tipo: filtros.tipo,
          desde: filtros.desde, hasta: filtros.hasta } },
        signal,
      }).catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return {
        eventos: data as components['schemas']['EventoBitacoraRespuesta'][],
        paginacion: leerPaginacion(response.headers, pageParam),
      }
    },
    getNextPageParam: (ultima) => ultima.paginacion.hayMas ? ultima.paginacion.pagina + 1 : undefined,
    staleTime: 5_000,
  })
}

/**
 * Cuántos eventos hay de cada tipo con los demás filtros, para las pestañas (`identidad.md` §4.1). La API no tiene
 * un conteo por tipo: se pide una página de un elemento por tipo y se lee `X-Total-Count`.
 */
export function useConteosBitacora(filtros: Omit<FiltrosBitacora, 'tipo'>, tipos: readonly TipoBitacora[]) {
  const consultas = useQueries({
    queries: tipos.map((tipo) => ({
      queryKey: ['bitacora-conteo', tipo, filtros.sector, filtros.desde, filtros.hasta],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const { error, response } = await api.GET('/api/bitacora', {
          params: { query: { pagina: 0, tamano: 1, tipo, sectorId: filtros.sector, desde: filtros.desde, hasta: filtros.hasta } },
          signal,
        }).catch(() => ({ error: undefined, response: null }))
        if (!response || !response.ok) throw normalizarError(response ?? null, error)
        return leerPaginacion(response.headers, 0).total
      },
      staleTime: 5_000,
    })),
  })
  return Object.fromEntries(tipos.map((tipo, indice) => [tipo, consultas[indice]?.data ?? null])) as Record<TipoBitacora, number | null>
}

/**
 * Último aviso detectado en un boletín o nota para este barrio. El contrato no enlaza la fuente de un corte concreto
 * (`CorteRespuesta` no trae URL y estos eventos llegan sin `corteId`), así que se enlaza el aviso más reciente del
 * barrio con su fecha, sin afirmar que fue el que anunció un corte en particular.
 */
export function useUltimoAviso(sectorId: string) {
  return useQuery({
    queryKey: ['ultimo-aviso', sectorId],
    enabled: Boolean(sectorId),
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET('/api/bitacora', {
        params: { query: { sectorId, tipo: 'CORTE_DETECTADO_POR_INGESTA', pagina: 0, tamano: 1 } },
        signal,
      }).catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return (data as components['schemas']['EventoBitacoraRespuesta'][])[0] ?? null
    },
    staleTime: 60_000,
  })
}

/**
 * La pestaña «Todos»: el total sin filtrar por tipo. No sale de sumar las demás, porque cinco tipos de evento se ven en
 * la lista pero la API no los deja filtrar (solo acepta cuatro).
 */
export function useTotalBitacora(filtros: Omit<FiltrosBitacora, 'tipo'>) {
  return useQuery({
    queryKey: ['bitacora-conteo', 'todos', filtros.sector, filtros.desde, filtros.hasta],
    queryFn: async ({ signal }) => {
      const { error, response } = await api.GET('/api/bitacora', {
        params: { query: { pagina: 0, tamano: 1, sectorId: filtros.sector, desde: filtros.desde, hasta: filtros.hasta } },
        signal,
      }).catch(() => ({ error: undefined, response: null }))
      if (!response || !response.ok) throw normalizarError(response ?? null, error)
      return leerPaginacion(response.headers, 0).total
    },
    staleTime: 5_000,
  })
}

export function useSustento(id: string, abierto: boolean) {
  return useInfiniteQuery({
    queryKey: ['sustento', id],
    enabled: abierto,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error, response } = await api.GET('/api/bitacora/{id}/sustento', {
        params: { path: { id }, query: { pagina: pageParam, tamano: 50 } },
        signal,
      }).catch(() => ({ data: undefined, error: undefined, response: null }))
      if (!response || !response.ok || !data) throw normalizarError(response ?? null, error)
      return { ids: data as string[], paginacion: leerPaginacion(response.headers, pageParam) }
    },
    getNextPageParam: (ultima) => ultima.paginacion.hayMas ? ultima.paginacion.pagina + 1 : undefined,
    staleTime: 60_000,
  })
}
