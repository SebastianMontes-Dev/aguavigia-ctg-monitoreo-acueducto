import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react'
import estilos from './Campo.module.css'

interface PropiedadesCampo extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  etiqueta: string
  /** `clave` añade «Mostrar»/«Ocultar» (guía §5.3); `codigo` es el de seis dígitos de la app de autenticación; `fechaHora` es un `datetime-local`, sin zona: quien lo usa dice cuál es. */
  tipo?: 'texto' | 'correo' | 'clave' | 'codigo' | 'fechaHora'
  error?: string | null
  ayuda?: string
}

const soloDigitos = (valor: string) => valor.replace(/\D/g, '').slice(0, 6)

/**
 * Un campo con su error al lado: `aria-invalid` y `aria-describedby` apuntan al texto, para que el lector de pantalla lo diga al
 * enfocar. El borde es de 3:1 también en claro (ADR-105).
 */
export const Campo = forwardRef<HTMLInputElement, PropiedadesCampo>(function Campo(
  { etiqueta, tipo = 'texto', error, ayuda, onChange, ...resto },
  ref,
) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const descripcion = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(' ') || undefined
  const propios: InputHTMLAttributes<HTMLInputElement> =
    tipo === 'codigo'
      ? { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}' }
      : tipo === 'correo'
        ? { type: 'email', autoComplete: 'username' }
        : tipo === 'clave'
          ? { type: visible ? 'text' : 'password', autoCapitalize: 'none', spellCheck: false }
          : tipo === 'fechaHora'
            ? { type: 'datetime-local' }
            : { type: 'text' }
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>{etiqueta}</label>
      <span className={`${estilos.caja} ${tipo === 'codigo' ? estilos.codigo : ''}`} data-invalido={error ? true : undefined}>
        <input
          {...propios}
          {...resto}
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          onChange={(evento) => {
            if (tipo === 'codigo') evento.target.value = soloDigitos(evento.target.value)
            onChange?.(evento)
          }}
        />
        {tipo === 'clave' && (
          <button type="button" className={estilos.ver} onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${etiqueta.toLowerCase()}`}>
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </span>
      {ayuda && <p id={`${id}-ayuda`} className={estilos.ayuda}>{ayuda}</p>}
      {error && <p id={`${id}-error`} className={estilos.error} role="alert">{error}</p>}
    </div>
  )
})
