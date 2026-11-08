declare global {
  interface Window {
    /** Lecturas que `index.html` empezó a pedir antes de que bajara el resto de la aplicación (RNF001), por ruta; cada una se usa una sola vez. */
    precargas?: Record<string, Promise<Response | null>>
  }
}

/** Entrega la respuesta adelantada de esa ruta y la suelta: las lecturas siguientes van a la red. `null` es que la petición adelantada falló. */
export function tomarPrecargado(ruta: string): Promise<Response | null> | undefined {
  if (typeof window === 'undefined' || !window.precargas) return undefined
  const precargado = window.precargas[ruta]
  delete window.precargas[ruta]
  return precargado
}

/** Lee el JSON de una respuesta adelantada; `null` si no hay nada que usar y se debe pedir de nuevo (o si falló: el llamante decide con la respuesta). */
export async function leerPrecargado<T>(ruta: string): Promise<{ respuesta: Response; cuerpo: T | undefined } | null> {
  const respuesta = await tomarPrecargado(ruta)
  if (!respuesta) return null
  return { respuesta, cuerpo: await respuesta.json().then((valor: T) => valor, () => undefined) }
}
