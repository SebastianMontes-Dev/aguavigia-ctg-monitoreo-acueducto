import { useLayoutEffect } from 'react'

/**
 * ADR-105 y ADR-107 (D1): el grafito va en <body> y nunca en <html>, de donde el mapa lee sus colores. Quien lo pone lo quita al
 * desmontarse, porque el panel y el marco público se reemplazan entre sí sin pasar por un efecto común.
 */
export function usePaletaGrafito(activa = true): void {
  useLayoutEffect(() => {
    if (!activa) return
    document.body.dataset.paleta = 'grafito'
    return () => {
      delete document.body.dataset.paleta
    }
  }, [activa])
}
