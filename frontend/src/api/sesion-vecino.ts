const CLAVE = 'aguavigia.vecino.token'
const eventos = new EventTarget()

// Otra clave y otro evento que la sesión del panel: el token de un vecino no abre nada del panel y no deben mezclarse (FE6).
// sessionStorage, como el panel: el equipo puede ser compartido y la sesión muere con la pestaña.
function almacen(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export const sesionVecino = {
  token(): string | null {
    return almacen()?.getItem(CLAVE) ?? null
  },
  guardar(token: string): void {
    almacen()?.setItem(CLAVE, token)
    eventos.dispatchEvent(new Event('cambio'))
  },
  limpiar(): void {
    if (sesionVecino.token() === null) return
    almacen()?.removeItem(CLAVE)
    eventos.dispatchEvent(new Event('cambio'))
  },
  alCambiar(callback: () => void): () => void {
    eventos.addEventListener('cambio', callback)
    return () => eventos.removeEventListener('cambio', callback)
  },
}
