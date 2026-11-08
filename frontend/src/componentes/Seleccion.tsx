import { useId, type SelectHTMLAttributes } from 'react'
import estilos from './Campo.module.css'

export interface Opcion {
  valor: string
  texto: string
}

interface PropiedadesSeleccion extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  etiqueta: string
  opciones: readonly Opcion[]
  ayuda?: string
}

/** Una lista desplegable con su etiqueta y su ayuda enlazadas, con la caja de los campos de texto (borde a 3:1). */
export function Seleccion({ etiqueta, opciones, ayuda, ...resto }: PropiedadesSeleccion) {
  const id = useId()
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>{etiqueta}</label>
      <select {...resto} id={id} className={estilos.seleccion} aria-describedby={ayuda ? `${id}-ayuda` : undefined}>
        {opciones.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.texto}</option>)}
      </select>
      {ayuda && <p id={`${id}-ayuda`} className={estilos.ayuda}>{ayuda}</p>}
    </div>
  )
}
