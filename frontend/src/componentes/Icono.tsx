import calendario from '../iconos/calendario.svg?raw'
import documento from '../iconos/documento.svg?raw'
import megafono from '../iconos/megafono.svg?raw'
import estilos from './GlifoEstado.module.css'

const SVG = { calendario, documento, megafono }

export type NombreIcono = keyof typeof SVG

/** ADR-103: iconos funcionales de la ficha del barrio, siempre junto a una palabra; decorativos para el lector de pantalla. */
export function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: 16 | 20 | 24 }) {
  return (
    <span
      aria-hidden="true"
      className={estilos.glifo}
      style={{ width: tamano, height: tamano }}
      dangerouslySetInnerHTML={{ __html: SVG[nombre] }}
    />
  )
}
