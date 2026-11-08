import type { DocumentoFallido, PropuestaIngesta, SaludColector } from '../dominio/ingesta'
import { ejecutarAccion, leerDelPanel, type ResultadoAccion } from './acciones-panel'
import { api } from './cliente'
import { leerPaginacion, type Paginacion } from './paginacion'

type Cliente = typeof api
interface Lectura { signal?: AbortSignal; cliente?: Cliente }

export const TAMANO_PROPUESTAS = 20

export interface PaginaPropuestas {
  propuestas: PropuestaIngesta[]
  paginacion: Paginacion
}

/** Solo las pendientes, paginadas por cabeceras (panel-veedor.md). Cada página es una petición. */
export async function leerPropuestas(pagina: number, { signal, cliente = api }: Lectura = {}): Promise<PaginaPropuestas> {
  const { dato, respuesta } = await leerDelPanel<PropuestaIngesta[]>(() =>
    cliente.GET('/api/veedor/ingesta/propuestas', { params: { query: { pagina, tamano: TAMANO_PROPUESTAS } }, signal }))
  return { propuestas: dato, paginacion: leerPaginacion(respuesta.headers, pagina) }
}

/** Lo que sigue roto ahora (hasta 200, los más recientes primero); no es un histórico. */
export async function leerFallidos({ signal, cliente = api }: Lectura = {}): Promise<DocumentoFallido[]> {
  const { dato } = await leerDelPanel<DocumentoFallido[]>(() => cliente.GET('/api/veedor/ingesta/fallidos', { signal }))
  return dato
}

/** Una lista vacía quiere decir que el pipeline aún no corrió un ciclo en esa instancia del backend. */
export async function leerSalud({ signal, cliente = api }: Lectura = {}): Promise<SaludColector[]> {
  const { dato } = await leerDelPanel<SaludColector[]>(() => cliente.GET('/api/veedor/ingesta/salud', { signal }))
  return dato
}

/** Repetir la misma decisión responde 200; contradecirla, 409. Aprobar no garantiza que el estado del barrio cambie. */
export function aprobarPropuesta(id: string, cliente: Cliente = api): Promise<ResultadoAccion<PropuestaIngesta>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/ingesta/propuestas/{id}/aprobar', { params: { path: { id } } }))
}

export function descartarPropuesta(id: string, cliente: Cliente = api): Promise<ResultadoAccion<PropuestaIngesta>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/ingesta/propuestas/{id}/descartar', { params: { path: { id } } }))
}

/** Deshace una aprobación por error; el motivo queda en la bitácora pública y en la auditoría. */
export function anularPropuesta(id: string, motivo: string, cliente: Cliente = api): Promise<ResultadoAccion<PropuestaIngesta>> {
  return ejecutarAccion(() => cliente.PATCH('/api/veedor/ingesta/propuestas/{id}/anulacion', { params: { path: { id } }, body: { motivo } }))
}
