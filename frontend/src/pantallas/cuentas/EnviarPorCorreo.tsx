import { Link } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import type { ResultadoSolicitud } from '../../api/cuentas'
import { Campo } from '../../componentes/Campo'
import { MarcaRecibido } from '../../componentes/MarcaRecibido'
import botones from '../../componentes/Botones.module.css'
import { mensajeSolicitud } from '../../dominio/mensajes-cuenta'
import avisos from '../publico/Avisos.module.css'
import { PaginaCuenta, type Paso } from './PaginaCuenta'
import { errorDeCorreo } from './formularios'
import estilos from './Cuenta.module.css'

interface Props {
  rotulo: string
  titular: string
  bajada: string
  tituloPasos: string
  pasos: readonly Paso[]
  boton: string
  /** Nombre accesible del bloque; sin la palabra «correo», para no chocar con el campo del mismo nombre. */
  etiqueta: string
  /** Lo que se dice tras el `202`, igual exista o no la cuenta. */
  neutro: string
  tituloRecibido: string
  enviar: (correo: string) => Promise<ResultadoSolicitud>
}

/**
 * Pedir algo por correo y nada más (olvidé mi clave, reenviar la verificación): el `202` es siempre el mismo mensaje, así que la
 * pantalla no deja ver si un correo tiene cuenta. Tampoco se reintenta sola: cada petición cuenta para el tope de `/api/cuentas/**`.
 */
export function EnviarPorCorreo({ rotulo, titular, bajada, tituloPasos, pasos, boton, etiqueta, neutro, tituloRecibido, enviar }: Props) {
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSolicitud | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  async function pedir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const problema = errorDeCorreo(entrada.current, correo)
    setError(problema)
    setResultado(null)
    if (problema) {
      entrada.current?.focus()
      return
    }
    setEnviando(true)
    setResultado(await enviar(correo.trim()))
    setEnviando(false)
  }

  const recibido = resultado?.tipo === 'recibido'
  const mensaje = resultado ? mensajeSolicitud(resultado) : null

  return (
    <PaginaCuenta rotulo={rotulo} titular={titular} bajada={bajada} tituloPasos={tituloPasos} pasos={pasos} etiqueta={etiqueta}>
      {recibido ? (
        <div className={estilos.recibido}>
          <MarcaRecibido />
          <h2 className={avisos.subtitulo}>{tituloRecibido}</h2>
          <output className={avisos.respuesta}>{neutro}</output>
          <div className={avisos.acciones}>
            <button type="button" className={avisos.enlace} onClick={() => { setResultado(null); setCorreo('') }}>Usar otro correo</button>
            <Link to="/vecino/ingreso" className={avisos.enlace}>Ingreso de vecinos</Link>
            <Link to="/panel/ingreso" className={avisos.enlace}>Acceso al panel</Link>
          </div>
        </div>
      ) : (
        <form className={estilos.formulario} onSubmit={(evento) => void pedir(evento)} noValidate>
          <Campo
            etiqueta="Correo"
            tipo="correo"
            autoComplete="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            error={error}
            ref={entrada}
          />
          {mensaje && <p className={avisos.alerta} role="alert">{mensaje}</p>}
          <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando}>
            {enviando ? 'Enviando…' : <>{boton} <span className={botones.flecha} aria-hidden="true">→</span></>}
          </Button>
        </form>
      )}
    </PaginaCuenta>
  )
}
