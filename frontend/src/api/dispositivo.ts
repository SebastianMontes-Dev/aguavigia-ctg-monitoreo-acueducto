import { api, normalizarError } from './cliente'

const CLAVE = 'aguavigia.dispositivo'

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null

export type ResultadoDispositivo =
  | { tipo: 'listo'; token: string }
  | { tipo: 'sin-red' }
  | { tipo: 'esperar'; segundos: number | null }
  | { tipo: 'fallo' }

interface Dependencias {
  almacen?: Almacen
  cliente?: Pick<typeof api, 'POST'>
}

// Solo cuando el almacenamiento está bloqueado: entonces el token vale para esta visita y no se pide otro por reporte.
let enMemoria: string | null = null
let pidiendo: Promise<ResultadoDispositivo> | null = null

function almacenLocal(): Almacen {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function leer(almacen: Almacen): string | null {
  try {
    return almacen?.getItem(CLAVE) || enMemoria
  } catch {
    return enMemoria
  }
}

function guardar(almacen: Almacen, token: string | null) {
  enMemoria = token
  try {
    if (token === null) almacen?.removeItem(CLAVE)
    else almacen?.setItem(CLAVE, token)
  } catch {
    // Con el almacenamiento bloqueado el token vive solo en memoria.
  }
}

async function pedir(almacen: Almacen, cliente: Pick<typeof api, 'POST'>): Promise<ResultadoDispositivo> {
  try {
    const { data, error, response } = await cliente.POST('/api/dispositivos')
    if (response.status === 201 && data?.token) {
      guardar(almacen, data.token)
      return { tipo: 'listo', token: data.token }
    }
    const problema = normalizarError(response, data ?? error)
    return response.status === 429 ? { tipo: 'esperar', segundos: problema.segundosParaReintentar } : { tipo: 'fallo' }
  } catch {
    return { tipo: 'sin-red' }
  }
}

/**
 * Guía de escala §7: el servidor emite una identidad nueva por llamada y limita 10 por hora y por IP, así que el token
 * se pide una vez, se guarda y se reutiliza. Varias pantallas pidiéndolo a la vez comparten una sola petición.
 */
export async function obtenerDispositivo({ almacen = almacenLocal(), cliente = api }: Dependencias = {}): Promise<ResultadoDispositivo> {
  const guardado = leer(almacen)
  if (guardado) return { tipo: 'listo', token: guardado }
  pidiendo ??= pedir(almacen, cliente).finally(() => { pidiendo = null })
  return pidiendo
}

/** Ante `401 dispositivo-invalido` el token guardado ya no sirve: se descarta y se pide otro. */
export async function renovarDispositivo({ almacen = almacenLocal(), cliente = api }: Dependencias = {}): Promise<ResultadoDispositivo> {
  guardar(almacen, null)
  pidiendo ??= pedir(almacen, cliente).finally(() => { pidiendo = null })
  return pidiendo
}

/** Solo para las pruebas: olvida el token en memoria y la petición en curso. */
export function olvidarDispositivo(almacen: Almacen = almacenLocal()) {
  guardar(almacen, null)
  pidiendo = null
}
