import { Link } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { solicitarAcceso, type ResultadoSolicitud } from '../../api/cuentas'
import { Campo } from '../../componentes/Campo'
import { MarcaRecibido } from '../../componentes/MarcaRecibido'
import botones from '../../componentes/Botones.module.css'
import { validarClaveNueva } from '../../dominio/clave'
import { mensajeSolicitud, NEUTRO } from '../../dominio/mensajes-cuenta'
import avisos from '../publico/Avisos.module.css'
import { PaginaCuenta, type Paso } from './PaginaCuenta'
import { errorDeCorreo } from './formularios'
import estilos from './Cuenta.module.css'

const PASOS: readonly Paso[] = [
  { icono: 'documento', titulo: 'Pides acceso', detalle: 'Con tu nombre, tu correo y una clave de 12 caracteres o más.' },
  { icono: 'correo', titulo: 'Confirmas tu correo', detalle: 'Abres el enlace que te enviamos y pulsas el botón de esa página. Vence en 48 horas.' },
  { icono: 'personas', titulo: 'Una persona del equipo lo aprueba', detalle: 'Hasta entonces no puedes entrar al panel: pedir acceso no lo concede.' },
]

interface Errores { nombre?: string; correo?: string; clave?: string }

/** Guía §5.3: `202` neutro, política de clave en el cliente y el `400` del servidor repartido junto a cada campo. */
export function SolicitarAcceso() {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSolicitud | null>(null)
  const campoNombre = useRef<HTMLInputElement>(null)
  const campoCorreo = useRef<HTMLInputElement>(null)
  const campoClave = useRef<HTMLInputElement>(null)

  function enfocarPrimero(nuevos: Errores) {
    // El foco va al primer campo con error, que lo anuncia por su aria-describedby.
    const primero = nuevos.nombre ? campoNombre : nuevos.correo ? campoCorreo : campoClave
    primero.current?.focus()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const nuevos: Errores = {
      ...(nombre.trim() ? {} : { nombre: 'Escribe tu nombre.' }),
      ...(errorDeCorreo(campoCorreo.current, correo) ? { correo: errorDeCorreo(campoCorreo.current, correo) as string } : {}),
      ...(validarClaveNueva(clave) ? { clave: validarClaveNueva(clave) as string } : {}),
    }
    setErrores(nuevos)
    setResultado(null)
    if (Object.keys(nuevos).length > 0) {
      enfocarPrimero(nuevos)
      return
    }
    setEnviando(true)
    const respuesta = await solicitarAcceso({ correo: correo.trim(), nombre: nombre.trim(), clave })
    setEnviando(false)
    if (respuesta.tipo === 'rechazado') {
      const delServidor: Errores = {
        ...(respuesta.campos.nombre ? { nombre: respuesta.campos.nombre } : {}),
        ...(respuesta.campos.correo ? { correo: respuesta.campos.correo } : {}),
        ...(respuesta.campos.clave ? { clave: respuesta.campos.clave } : {}),
      }
      setErrores(delServidor)
      if (Object.keys(delServidor).length > 0) enfocarPrimero(delServidor)
    }
    if (respuesta.tipo === 'recibido') setClave('')
    setResultado(respuesta)
  }

  const recibido = resultado?.tipo === 'recibido'
  const mensaje = resultado ? mensajeSolicitud(resultado) : null

  return (
    <PaginaCuenta
      rotulo="Cuenta del panel"
      titular="Pide acceso al panel"
      bajada="Para quien revisa reportes y cortes. Consultar el mapa y reportar no necesitan cuenta."
      tituloPasos="Así funciona"
      pasos={PASOS}
      etiqueta="Pedir acceso al panel"
    >
      {recibido ? (
        <div className={estilos.recibido}>
          <MarcaRecibido />
          <h2 className={avisos.subtitulo}>Revisa tu correo</h2>
          <output className={avisos.respuesta}>{NEUTRO.acceso}</output>
          <p className={estilos.nota}>Cuando confirmes tu correo, una persona del equipo tiene que aprobar la cuenta: hasta entonces no puedes entrar.</p>
          <div className={avisos.acciones}>
            <Link to="/cuenta/reenviar" className={avisos.enlace}>¿No te llegó? Reenviar el correo</Link>
            <Link to="/panel/ingreso" className={avisos.enlace}>Ir al ingreso</Link>
          </div>
        </div>
      ) : (
        <form className={estilos.formulario} onSubmit={(evento) => void enviar(evento)} noValidate>
          <Campo etiqueta="Nombre" autoComplete="name" value={nombre} onChange={(evento) => setNombre(evento.target.value)} error={errores.nombre} ref={campoNombre} />
          <Campo etiqueta="Correo" tipo="correo" autoComplete="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} error={errores.correo} ref={campoCorreo} />
          <Campo
            etiqueta="Clave"
            tipo="clave"
            autoComplete="new-password"
            value={clave}
            onChange={(evento) => setClave(evento.target.value)}
            error={errores.clave}
            ayuda="De 12 a 128 caracteres. Puedes pegarla desde tu gestor de contraseñas."
            ref={campoClave}
          />
          {mensaje && <p className={avisos.alerta} role="alert">{mensaje}</p>}
          <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando}>
            {enviando ? 'Enviando…' : <>Solicitar acceso <span className={botones.flecha} aria-hidden="true">→</span></>}
          </Button>
          <div className={estilos.pie}>
            <Link to="/panel/ingreso" className={avisos.enlace}>Ya tengo cuenta</Link>
            <Link to="/cuenta/reenviar" className={avisos.enlace}>¿No te llegó el correo?</Link>
          </div>
        </form>
      )}
    </PaginaCuenta>
  )
}
