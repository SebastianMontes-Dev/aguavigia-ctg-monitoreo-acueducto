import type { ReporteModeracion, AccionModeracion } from '../dominio/moderacion'
import { ejecutarAccion, leerDelPanel, type ResultadoAccion } from './acciones-panel'
import { api } from './cliente'
import { leerPaginacion, type Paginacion } from './paginacion'

type Cliente = typeof api

export const TAMANO_COLA = 20

export interface PaginaPendientes {
  reportes: ReporteModeracion[]
  paginacion: Paginacion
}

/** La cola, de los más antiguos a los más nuevos, paginada por cabeceras. */
export async function leerPendientes(pagina: number, { signal, cliente = api }: { signal?: AbortSignal; cliente?: Cliente } = {}): Promise<PaginaPendientes> {
  const { dato, respuesta } = await leerDelPanel<ReporteModeracion[]>(() =>
    cliente.GET('/api/veedor/reportes/pendientes', { params: { query: { pagina, tamano: TAMANO_COLA } }, signal }))
  return { reportes: dato, paginacion: leerPaginacion(respuesta.headers, pagina) }
}

/**
 * Las fotos sin aprobar no son públicas: la imagen se pide con la cabecera `Authorization` y se muestra desde un objeto local,
 * porque un `<img src>` directo no puede mandar el token.
 */
export async function leerFotoDelPanel(nombre: string, { signal, cliente = api }: { signal?: AbortSignal; cliente?: Cliente } = {}): Promise<Blob> {
  const { dato } = await leerDelPanel<Blob>(() =>
    cliente.GET('/api/veedor/fotos/{nombre}', { params: { path: { nombre } }, parseAs: 'blob', signal }))
  return dato
}

/** Aprobar, descartar o retirar solo la foto: devuelve el reporte con su estado nuevo. */
export function moderarReporte(id: string, accion: AccionModeracion, cliente: Cliente = api): Promise<ResultadoAccion<ReporteModeracion>> {
  const params = { params: { path: { id } } }
  switch (accion) {
    case 'aprobar': return ejecutarAccion(() => cliente.PATCH('/api/veedor/reportes/{id}/aprobar', params))
    case 'descartar': return ejecutarAccion(() => cliente.PATCH('/api/veedor/reportes/{id}/descartar', params))
    case 'foto': return ejecutarAccion(() => cliente.PATCH('/api/veedor/reportes/{id}/foto/descartar', params))
  }
}

/** La foto como `data:` URL: se guarda en la caché de consultas sin objetos locales que liberar a mano. */
export function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = () => rechazar(lector.error)
    lector.readAsDataURL(blob)
  })
}
