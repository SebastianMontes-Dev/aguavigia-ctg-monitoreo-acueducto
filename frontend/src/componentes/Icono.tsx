import avanzar from '../iconos/avanzar.svg?raw'
import buscar from '../iconos/buscar.svg?raw'
import calendario from '../iconos/calendario.svg?raw'
import campana from '../iconos/campana.svg?raw'
import correo from '../iconos/correo.svg?raw'
import descargar from '../iconos/descargar.svg?raw'
import desplegar from '../iconos/desplegar.svg?raw'
import documento from '../iconos/documento.svg?raw'
import mas from '../iconos/mas.svg?raw'
import megafono from '../iconos/megafono.svg?raw'
import menos from '../iconos/menos.svg?raw'
import personas from '../iconos/personas.svg?raw'
import quitar from '../iconos/quitar.svg?raw'
import ubicacion from '../iconos/ubicacion.svg?raw'
import estilos from './GlifoEstado.module.css'

const SVG = { avanzar, buscar, calendario, campana, correo, descargar, desplegar, documento, mas, megafono, menos, personas, quitar, ubicacion }

export type NombreIcono = keyof typeof SVG

/** ADR-103 y ADR-104: iconos funcionales, siempre junto a una palabra; decorativos para el lector de pantalla. */
export function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: 14 | 16 | 18 | 20 | 24 }) {
  return (
    <span
      aria-hidden="true"
      className={estilos.glifo}
      style={{ width: tamano, height: tamano }}
      dangerouslySetInnerHTML={{ __html: SVG[nombre] }}
    />
  )
}
