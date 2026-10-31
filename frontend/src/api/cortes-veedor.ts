import type { Corte } from '../dominio/cortes'
import type { SolicitudCorte } from '../dominio/cortes-panel'
import type { Sector } from '../dominio/sectores'
import { ejecutarAccion, leerDelPanel, type ResultadoAccion } from './acciones-panel'
import { api } from './cliente'

type Cliente = typeof api
interface Lectura { signal?: AbortSignal; cliente?: Cliente }

/** Los cortes que afectan a un barrio, en cualquier estado. El barrio es obligatorio en el contrato. */
export async function leerCortesDelBarrio(sectorId: string, { signal, cliente = api }: Lectura = {}): Promise<Corte[]> {
  const { dato } = await leerDelPanel<Corte[]>(() => cliente.GET('/api/veedor/cortes', { params: { query: { sectorId } }, signal }))
  return dato
}

export async function leerCorte(id: string, { signal, cliente = api }: Lectura = {}): Promise<Corte> {
  const { dato } = await leerDelPanel<Corte>(() => cliente.GET('/api/veedor/cortes/{id}', { params: { path: { id } }, signal }))
  return dato
}

/** Promesa vencida sin cierre, o con un cierre provisional por confirmar; del más antiguo al más reciente. */
export async function leerVencidos({ signal, cliente = api }: Lectura = {}): Promise<Corte[]> {
  const { dato } = await leerDelPanel<Corte[]>(() => cliente.GET('/api/veedor/cortes/vencidos', { signal }))
  return dato
}

/** Barrios donde los vecinos contradicen a la fuente oficial, los más contradichos primero. */
export async function leerDisputas({ signal, cliente = api }: Lectura = {}): Promise<Sector[]> {
  const { dato } = await leerDelPanel<Sector[]>(() => cliente.GET('/api/veedor/disputas', { signal }))
  return dato
}

export function registrarCorte(solicitud: SolicitudCorte, cliente: Cliente = api): Promise<ResultadoAccion<Corte>> {
  return ejecutarAccion(() => cliente.POST('/api/veedor/cortes', { body: solicitud }))
}

/** Atajo: cierra de una vez todos los barrios que siguen pendientes; los ya cerrados se respetan. */
export function cerrarCorte(id: string, horaReal: string, cliente: Cliente = api): Promise<ResultadoAccion<Corte>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/cortes/{id}/cierre', { params: { path: { id } }, body: { horaReal } }))
}

export function cerrarBarrio(id: string, sectorId: string, horaReal: string, cliente: Cliente = api): Promise<ResultadoAccion<Corte>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/cortes/{id}/sectores/{sectorId}/cierre', { params: { path: { id, sectorId } }, body: { horaReal } }))
}

/** Confirma, o corrige la hora de, el cierre provisional que pusieron los vecinos. Uno ya confirmado responde `409`. */
export function confirmarCierre(id: string, sectorId: string, horaReal: string, cliente: Cliente = api): Promise<ResultadoAccion<Corte>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/cortes/{id}/sectores/{sectorId}/confirmacion', { params: { path: { id, sectorId } }, body: { horaReal } }))
}

export function anularCorte(id: string, motivo: string, cliente: Cliente = api): Promise<ResultadoAccion<Corte>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/cortes/{id}/anulacion', { params: { path: { id } }, body: { motivo } }))
}
