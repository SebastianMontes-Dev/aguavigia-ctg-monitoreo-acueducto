import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { iniciarSesionVecino, type ResultadoIngresoVecino } from '../../api/vecino'
import { Redirigir } from '../../app/Redirigir'
import { useHaySesionVecino, type MotivoVecino } from '../../app/vecino'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import botones from '../../componentes/Botones.module.css'
import { mensajeIngresoVecino } from '../../dominio/mensajes-cuenta'
import avisos from '../publico/Avisos.module.css'
import { PaginaCuenta, type Paso } from './PaginaCuenta'
import estilos from './Cuenta.module.css'

export const MOTIVO_VECINO: Record<MotivoVecino, string> = {
  vencida: 'Tu sesión terminó. Ingresa de nuevo.',
  cerrada: 'Cerraste la sesión en este equipo y en los demás donde estaba abierta.',
}

const PASOS: readonly Paso[] = [
  { icono: 'megafono', titulo: 'Reportas como vecino', detalle: 'Tu reporte lleva tu cuenta y puedes enviar 5 por barrio cada 30 minutos, en vez de 3.' },
  { icono: 'ubicacion', titulo: 'Verificas tu barrio', detalle: 'Con tu ubicación del momento: no se guarda y tienes 3 intentos al día.' },
  { icono: 'campana', titulo: 'Decides si recibes avisos', detalle: 'Cambias tu nombre, tu barrio y los avisos de tu perfil cuando quieras.' },
]

interface Errores { correo?: string; clave?: string }

/** `POST /api/vecino/sesion`: una cuenta del panel, una sin clave y una clave mala reciben la misma `401`, y el mensaje no las distingue. */
export function IngresoVecino() {
  const { motivo } = useSearch({ from: '/publico/vecino/ingreso' })
  const navegar = useNavigate()
  const haySesion = useHaySesionVecino()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoIngresoVecino | null>(null)
  const campoCorreo = useRef<HTMLInputElement>(null)
  const campoClave = useRef<HTMLInputElement>(null)

  if (haySesion && !enviando) return <Redirigir destino={{ to: '/vecino/perfil' }} />

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const nuevos: Errores = {
      ...(correo.trim() ? {} : { correo: 'Escribe tu correo.' }),
      ...(clave ? {} : { clave: 'Escribe tu clave.' }),
    }
    setErrores(nuevos)
    setResultado(null)
    if (Object.keys(nuevos).length > 0) {
      // El foco va al primer campo con error, que lo anuncia por su aria-describedby.
      ;(nuevos.correo ? campoCorreo : campoClave).current?.focus()
      return
    }
    setEnviando(true)
    const respuesta = await iniciarSesionVecino(correo.trim(), clave)
    if (respuesta.tipo === 'ingresado') {
      setClave('')
      void navegar({ to: '/vecino/perfil', replace: true })
      return
    }
    setEnviando(false)
    setResultado(respuesta)
  }

  const mensaje = resultado ? mensajeIngresoVecino(resultado) : null

  return (
    <PaginaCuenta
      rotulo="Cuenta de vecino"
      titular="Ingresa a tu cuenta de vecino"
      bajada="Con tu cuenta tus reportes llevan tu nombre de vecino y tu barrio verificado. Reportar sin cuenta sigue siendo posible."
      tituloPasos="Con tu cuenta puedes"
      pasos={PASOS}
      etiqueta="Ingreso de vecino"
    >
      <form className={estilos.formulario} onSubmit={(evento) => void enviar(evento)} noValidate>
        {motivo && !resultado && <output className={estilos.aviso}>{MOTIVO_VECINO[motivo]}</output>}
        <Campo etiqueta="Correo" tipo="correo" autoComplete="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} error={errores.correo} ref={campoCorreo} />
        <Campo etiqueta="Clave" tipo="clave" autoComplete="current-password" value={clave} onChange={(evento) => setClave(evento.target.value)} error={errores.clave} ref={campoClave} />
        {mensaje && <p className={campos.error} role="alert">{mensaje}</p>}
        <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando}>
          {enviando ? 'Ingresando…' : <>Ingresar <span className={botones.flecha} aria-hidden="true">→</span></>}
        </Button>
        <div className={estilos.pie}>
          <Link to="/cuenta/olvide" className={avisos.enlace}>Olvidé mi clave</Link>
          <Link to="/cuenta/reenviar" className={avisos.enlace}>¿No te llegó el correo?</Link>
          <Link to="/vecino/registro" className={avisos.enlace}>Regístrate como vecino</Link>
        </div>
      </form>
    </PaginaCuenta>
  )
}
