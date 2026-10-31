import type { Coordenada } from '../dominio/ubicacion'

/** La lectura que acompaña el reporte: sin `precisionMetros` el servidor no verifica la ubicación (docs/api/reportes.md). */
export interface UbicacionCompartida { coordenada: Coordenada; precisionMetros: number }

export type ResultadoUbicacion =
  | ({ tipo: 'ubicada' } & UbicacionCompartida)
  | { tipo: 'imprecisa'; metros: number }
  | { tipo: 'denegada' }
  | { tipo: 'no-disponible' }
  | { tipo: 'agotada' }

// Un barrio de Cartagena mide pocos cientos de metros: con más error que esto, el barrio sería una adivinanza.
export const PRECISION_MAXIMA_M = 1000

const OPCIONES: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }

export function hayGeolocalizacion(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function pedirUbicacion(geolocalizacion: Geolocation | undefined = hayGeolocalizacion() ? navigator.geolocation : undefined): Promise<ResultadoUbicacion> {
  if (!geolocalizacion) return Promise.resolve({ tipo: 'no-disponible' })
  return new Promise((resolver) => {
    geolocalizacion.getCurrentPosition(
      ({ coords }) => resolver(coords.accuracy > PRECISION_MAXIMA_M
        ? { tipo: 'imprecisa', metros: Math.round(coords.accuracy) }
        : { tipo: 'ubicada', coordenada: { latitud: coords.latitude, longitud: coords.longitude }, precisionMetros: Math.round(coords.accuracy) }),
      (error) => resolver(
        error.code === error.PERMISSION_DENIED ? { tipo: 'denegada' }
          : error.code === error.TIMEOUT ? { tipo: 'agotada' }
            : { tipo: 'no-disponible' },
      ),
      OPCIONES,
    )
  })
}

// Solo en memoria y solo para esta visita: nada de la ubicación se guarda en el dispositivo.
let compartida: ({ sectorId: string } & UbicacionCompartida) | null = null

export function recordarUbicacion(sectorId: string, ubicacion: UbicacionCompartida): void {
  compartida = { sectorId, ...ubicacion }
}

/** RF007: la coordenada acompaña el reporte solo si es del barrio en el que se localizó a la persona. */
export function ubicacionPara(sectorId: string): UbicacionCompartida | null {
  return compartida?.sectorId === sectorId
    ? { coordenada: compartida.coordenada, precisionMetros: compartida.precisionMetros }
    : null
}

export function olvidarUbicacion(): void {
  compartida = null
}
