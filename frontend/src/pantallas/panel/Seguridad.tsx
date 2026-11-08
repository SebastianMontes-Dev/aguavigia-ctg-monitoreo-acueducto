import { Link } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { cambiarClave, cerrarSesion, desactivarSegundoFactor, type ResultadoCuenta } from '../../api/panel'
import { anunciarSalida, useCuentaActual } from '../../app/panel'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { validarClaveNueva } from '../../dominio/clave'
import { mensajeCuenta } from '../../dominio/mensajes-panel'
import pagina from '../publico/Pagina.module.css'
import estilos from './Formulario.module.css'

interface ErroresClave {
  actual?: string
  nueva?: string
}

function CambiarClave() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [errores, setErrores] = useState<ErroresClave>({})
  const [resultado, setResultado] = useState<ResultadoCuenta | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campoActual = useRef<HTMLInputElement>(null)
  const campoNueva = useRef<HTMLInputElement>(null)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const nuevos: ErroresClave = {}
    if (!actual) nuevos.actual = 'Escribe tu clave de hoy.'
    const problema = validarClaveNueva(nueva, actual)
    if (problema) nuevos.nueva = problema
    setErrores(nuevos)
    setResultado(null)
    if (nuevos.actual || nuevos.nueva) {
      // El foco va al primer campo con error, que lo anuncia por su aria-describedby.
      ;(nuevos.actual ? campoActual : campoNueva).current?.focus()
      return
    }
    setEnviando(true)
    anunciarSalida('clave')
    const respuesta = await cambiarClave(actual, nueva)
    if (respuesta.tipo !== 'hecho') anunciarSalida(null)
    setEnviando(false)
    if (respuesta.tipo === 'hecho') return
    if (respuesta.tipo === 'rechazado') setNueva('')
    setResultado(respuesta)
  }

  const mensaje = resultado ? mensajeCuenta(resultado) : null

  return (
    <form className={`${bloques.bloque} ${estilos.formulario}`} onSubmit={(evento) => void enviar(evento)} noValidate aria-labelledby="titulo-clave">
      <h2 id="titulo-clave" className={estilos.subtitulo}>Cambiar la clave</h2>
      <Campo etiqueta="Clave actual" tipo="clave" autoComplete="current-password" value={actual} onChange={(evento) => setActual(evento.target.value)} error={errores.actual} ref={campoActual} />
      <Campo
        etiqueta="Clave nueva"
        tipo="clave"
        autoComplete="new-password"
        value={nueva}
        onChange={(evento) => setNueva(evento.target.value)}
        error={errores.nueva}
        ayuda="De 12 a 128 caracteres y distinta de la actual."
        ref={campoNueva}
      />
      <p className={estilos.nota}>Al cambiarla se cierran <strong>todas tus sesiones</strong>, también esta. Ingresarás de nuevo con la clave nueva.</p>
      {mensaje && <p className={campos.error} role="alert">{mensaje}</p>}
      <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando}>
        {enviando ? 'Cambiando…' : <>Cambiar clave y cerrar sesiones <span className={botones.flecha} aria-hidden="true">→</span></>}
      </Button>
    </form>
  )
}

function DesactivarSegundoFactor() {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoCuenta | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    setResultado(null)
    if (!/^\d{6}$/.test(codigo)) {
      setError('El código tiene seis dígitos.')
      campo.current?.focus()
      return
    }
    setError(null)
    setEnviando(true)
    anunciarSalida('segundo-factor')
    const respuesta = await desactivarSegundoFactor(codigo)
    if (respuesta.tipo !== 'hecho') anunciarSalida(null)
    setEnviando(false)
    if (respuesta.tipo === 'hecho') return
    if (respuesta.tipo === 'codigo-incorrecto') setCodigo('')
    setResultado(respuesta)
  }

  const mensaje = resultado ? mensajeCuenta(resultado) : null
  const rechazado = resultado?.tipo === 'codigo-incorrecto'

  return (
    <form className={`${estilos.formulario} ${estilos.aparte}`} onSubmit={(evento) => void enviar(evento)} noValidate aria-labelledby="titulo-desactivar">
      <h3 id="titulo-desactivar" className={estilos.subtitulo}>Desactivar el segundo factor</h3>
      <Campo
        etiqueta="Código de la app"
        tipo="codigo"
        value={codigo}
        onChange={(evento) => setCodigo(evento.target.value)}
        error={error ?? (rechazado ? mensaje : null)}
        ref={campo}
      />
      <p className={estilos.nota}>Al desactivarlo se cierran <strong>todas tus sesiones</strong>. Tu cuenta quedará protegida solo por la clave.</p>
      {mensaje && !rechazado && <p className={campos.error} role="alert">{mensaje}</p>}
      <Button type="submit" className={botones.secundario} isDisabled={enviando}>
        {enviando ? 'Desactivando…' : 'Desactivar y cerrar sesiones'}
      </Button>
    </form>
  )
}

function CerrarSesiones() {
  const [confirmando, setConfirmando] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  function cerrar() {
    setCerrando(true)
    anunciarSalida('cerrada')
    void cerrarSesion()
  }

  return (
    <section className={bloques.bloque} aria-labelledby="titulo-sesiones">
      <h2 id="titulo-sesiones" className={estilos.subtitulo}>Cerrar todas mis sesiones</h2>
      <p className={estilos.nota}>
        Cierra la sesión en este equipo y en cualquier otro donde la hayas dejado abierta, por ejemplo si perdiste un teléfono o
        usaste un equipo compartido.
      </p>
      {confirmando ? (
        <div className={estilos.advertencia}>
          <p>Se cerrarán todas tus sesiones, también esta. Tendrás que ingresar de nuevo.</p>
          <div className={estilos.acciones}>
            <Button className={botones.principal} isDisabled={cerrando} onPress={cerrar}>
              {cerrando ? 'Cerrando…' : 'Sí, cerrar todas'}
            </Button>
            <button type="button" className={estilos.enlaceBoton} onClick={() => setConfirmando(false)} disabled={cerrando}>Cancelar</button>
          </div>
        </div>
      ) : (
        <Button className={botones.secundario} onPress={() => setConfirmando(true)}>Cerrar todas mis sesiones</Button>
      )}
    </section>
  )
}

/**
 * Guía §5.4: cambiar la clave, el segundo factor y cerrar todas las sesiones. Cada acción que cierra sesiones lo dice antes de
 * pulsarla. El ADMIN no puede desactivar el segundo factor (su rol lo exige) y cambiar de teléfono pide el código actual.
 */
export function Seguridad() {
  const cuenta = useCuentaActual(true).data
  const activo = cuenta?.segundoFactorActivo === true
  const esAdmin = cuenta?.rol === 'ADMIN'

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Tu cuenta</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>
          {activo ? 'Tu cuenta pide un código además de la clave' : 'Tu cuenta se protege solo con la clave'}
        </h1>
      </header>
      <div className={estilos.rejilla}>
        <CambiarClave />
        <section className={`${bloques.bloque} ${estilos.formulario}`} aria-labelledby="titulo-factor">
          <h2 id="titulo-factor" className={estilos.subtitulo}>Segundo factor</h2>
          {activo ? (
            <>
              <p className={estilos.nota}>
                Activo. {esAdmin ? 'El rol de administrador lo exige: no se puede desactivar.' : 'Es opcional para tu rol.'}
              </p>
              <Link to="/panel/segundo-factor" className={botones.secundario}>Cambiar de teléfono</Link>
              {!esAdmin && <DesactivarSegundoFactor />}
            </>
          ) : (
            <>
              <p className={estilos.nota}>Sin activar. Es opcional para tu rol: con una app de autenticación, la clave sola ya no basta para entrar.</p>
              <Link to="/panel/segundo-factor" className={botones.secundario}>Activar el segundo factor</Link>
            </>
          )}
        </section>
      </div>
      <CerrarSesiones />
    </div>
  )
}
