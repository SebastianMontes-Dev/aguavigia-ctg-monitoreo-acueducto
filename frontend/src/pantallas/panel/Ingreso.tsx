import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Redirigir } from '../../app/Redirigir'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { iniciarSesion, type ResultadoIngreso } from '../../api/panel'
import { useAlcance, type MotivoIngreso } from '../../app/panel'
import { usePaletaGrafito } from '../../app/paleta'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import botones from '../../componentes/Botones.module.css'
import { mensajeIngreso } from '../../dominio/mensajes-panel'
import pagina from '../publico/Pagina.module.css'
import estilos from './Formulario.module.css'
import propios from './Ingreso.module.css'

export const MOTIVO_INGRESO: Record<MotivoIngreso, string> = {
  vencida: 'Tu sesión terminó. Ingresa de nuevo.',
  cerrada: 'Cerraste la sesión en este equipo y en los demás donde estaba abierta.',
  clave: 'Cambiaste tu clave y se cerraron todas las sesiones. Ingresa con la clave nueva.',
  'segundo-factor': 'Desactivaste el segundo factor y se cerraron todas las sesiones. Ingresa de nuevo.',
}

interface ErroresIngreso {
  correo?: string
  clave?: string
  codigo?: string
}

/**
 * RF019 · guía §5.3: correo y clave; si la cuenta tiene TOTP, el mismo formulario pide el código y repite. «Correo o clave
 * incorrectos» no dice cuál de los dos falló, así que va como mensaje del formulario y no junto a un campo.
 */
export function Ingreso() {
  usePaletaGrafito()
  const { motivo } = useSearch({ from: '/panel/ingreso' })
  const navegar = useNavigate()
  const alcance = useAlcance()
  const [conCodigo, setConCodigo] = useState(false)
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoIngreso | null>(null)
  const [errores, setErrores] = useState<ErroresIngreso>({})
  const campoCorreo = useRef<HTMLInputElement>(null)
  const campoClave = useRef<HTMLInputElement>(null)
  const campoCodigo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (conCodigo) campoCodigo.current?.focus()
  }, [conCodigo])

  if (alcance === 'ALTA_SEGUNDO_FACTOR') return <Redirigir destino={{ to: '/panel/segundo-factor' }} />
  if (alcance === 'COMPLETO') return <Redirigir destino={{ to: '/panel' }} />

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const nuevos: ErroresIngreso = {}
    if (conCodigo) {
      if (!/^\d{6}$/.test(codigo)) nuevos.codigo = 'El código tiene seis dígitos.'
    } else {
      if (!correo.trim()) nuevos.correo = 'Escribe tu correo.'
      if (!clave) nuevos.clave = 'Escribe tu clave.'
    }
    setErrores(nuevos)
    setResultado(null)
    if (Object.keys(nuevos).length > 0) {
      // El foco va al primer campo con error, que lo anuncia por su aria-describedby.
      const primero = nuevos.correo ? campoCorreo : nuevos.clave ? campoClave : campoCodigo
      primero.current?.focus()
      return
    }
    setEnviando(true)
    const respuesta = await iniciarSesion(correo.trim(), clave, conCodigo ? codigo : undefined)
    setEnviando(false)
    if (respuesta.tipo === 'ingresado') {
      setClave('')
      void navegar({ to: respuesta.alcance === 'ALTA_SEGUNDO_FACTOR' ? '/panel/segundo-factor' : '/panel', replace: true })
      return
    }
    if (respuesta.tipo === 'pide-codigo') {
      setConCodigo(true)
      return
    }
    if (conCodigo && respuesta.tipo === 'credencial-invalida') setCodigo('')
    setResultado(respuesta)
  }

  function cambiarDeCuenta() {
    setConCodigo(false)
    setClave('')
    setCodigo('')
    setResultado(null)
    setErrores({})
  }

  const mensaje = resultado ? mensajeIngreso(resultado, conCodigo) : null
  // Con el código en pantalla la clave ya se aceptó: lo que no coincide es el código, y el error va junto a él.
  const codigoRechazado = conCodigo && resultado?.tipo === 'credencial-invalida'
  const errorDelCodigo = errores.codigo ?? (codigoRechazado ? mensaje : null)
  const errorDelFormulario = codigoRechazado ? null : mensaje

  return (
    <main className={propios.pantalla}>
      <section className={propios.lado} aria-labelledby="titulo-pagina">
        <p className={propios.marca}>AguaVigía <span className={propios.rotuloMarca}>Panel</span></p>
        <div className={propios.presentacion}>
          <span className={propios.filete} aria-hidden="true" />
          <h1 id="titulo-pagina" className={`${pagina.titular} ${propios.titular}`}>Ingreso al panel</h1>
          <p className={propios.entrada}>Para veedores y administradores. Consultar el mapa y reportar no necesitan cuenta.</p>
        </div>
        <ol className={propios.pasos} aria-label="Cómo se entra">
          <li><span className={propios.numero} aria-hidden="true">1</span><span>Escribe tu correo y tu clave.</span></li>
          <li><span className={propios.numero} aria-hidden="true">2</span><span>Si tu cuenta tiene segundo factor (los administradores siempre), escribe el código de seis dígitos de tu app.</span></li>
          <li><span className={propios.numero} aria-hidden="true">3</span><span>Entras al panel. La sesión dura 8 horas y se cierra sola.</span></li>
        </ol>
      </section>
      <section className={propios.acceso} aria-label="Formulario de ingreso">
        <Link to="/" className={propios.volver}><span aria-hidden="true">←</span> Volver al mapa</Link>
        <div className={propios.formulario}>
          {motivo && !resultado && <output className={estilos.aviso}>{MOTIVO_INGRESO[motivo]}</output>}
          <form className={propios.tarjeta} onSubmit={(evento) => void enviar(evento)} noValidate aria-labelledby="titulo-ingreso">
            <h2 id="titulo-ingreso" className={propios.subtitulo}>{conCodigo ? 'Un código más' : 'Entra con tu cuenta'}</h2>
            {conCodigo ? (
              <>
                <p className={estilos.nota}>
                  La clave de <strong>{correo.trim()}</strong> es correcta. Escribe el código de seis dígitos que muestra tu app de
                  autenticación.
                </p>
                <Campo
                  etiqueta="Código de la app"
                  tipo="codigo"
                  value={codigo}
                  onChange={(evento) => setCodigo(evento.target.value)}
                  error={errorDelCodigo}
                  ref={campoCodigo}
                />
              </>
            ) : (
              <>
                <Campo
                  etiqueta="Correo"
                  tipo="correo"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                  error={errores.correo}
                  ref={campoCorreo}
                />
                <Campo
                  etiqueta="Clave"
                  tipo="clave"
                  autoComplete="current-password"
                  value={clave}
                  onChange={(evento) => setClave(evento.target.value)}
                  error={errores.clave}
                  ref={campoClave}
                />
              </>
            )}
            {errorDelFormulario && <p className={campos.error} role="alert">{errorDelFormulario}</p>}
            <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando}>
              {enviando ? 'Ingresando…' : <>Ingresar <span className={botones.flecha} aria-hidden="true">→</span></>}
            </Button>
            {conCodigo && (
              <div className={estilos.acciones}>
                <button type="button" className={estilos.enlaceBoton} onClick={cambiarDeCuenta}>Ingresar con otra cuenta</button>
              </div>
            )}
          </form>
        </div>
      </section>
    </main>
  )
}
