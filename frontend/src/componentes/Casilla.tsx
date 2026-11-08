import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import estilos from './Casilla.module.css'

interface PropiedadesCasilla extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  etiqueta: ReactNode
  ayuda?: string
  error?: string | null
}

/** Una casilla con su error junto a ella (`aria-invalid` y `aria-describedby`); el borde del cuadro es de 3:1 como el de los campos. */
export const Casilla = forwardRef<HTMLInputElement, PropiedadesCasilla>(function Casilla({ etiqueta, ayuda, error, ...resto }, ref) {
  const id = useId()
  const descripcion = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={estilos.casilla}>
      <label htmlFor={id} className={estilos.fila}>
        <input
          {...resto}
          id={id}
          ref={ref}
          type="checkbox"
          className={estilos.cuadro}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
        />
        <span className={estilos.texto}>{etiqueta}</span>
      </label>
      {ayuda && <p id={`${id}-ayuda`} className={estilos.ayuda}>{ayuda}</p>}
      {error && <p id={`${id}-error`} className={estilos.error} role="alert">{error}</p>}
    </div>
  )
})
