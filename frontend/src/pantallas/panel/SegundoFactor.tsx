import { Link, useNavigate } from '@tanstack/react-router'
import { Redirigir } from '../../app/Redirigir'
import { useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import {
  cerrarSesion,
  confirmarSegundoFactor,
  iniciarAltaSegundoFactor,
  type ResultadoAlta,
  type ResultadoConfirmacionFactor,
} from '../../api/panel'
import { motivoDeSalida, useAlcance, useCuentaActual, useSesionPerdida } from '../../app/panel'
import { usePaletaGrafito } from '../../app/paleta'
import { Campo } from '../../componentes/Campo'
import { CodigoQr } from '../../componentes/CodigoQr'
import campos from '../../componentes/Campo.module.css'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { mensajeSegundoFactor } from '../../dominio/mensajes-panel'
import pagina from '../publico/Pagina.module.css'
import estilos from './Formulario.module.css'

/** Grupos de cuatro para copiarlo a mano sin perderse; la app lo acepta con o sin espacios. */
export function agruparSecreto(secreto: string): string {
  return secreto.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') ?? secreto
}

/**
 * RNF025 · guía §5.3: el alta se pide al tocar, no al montar, porque cada alta reemplaza el secreto pendiente; el
 * secreto se muestra una sola vez y el segundo factor solo queda activo tras confirmar un código. Quien ya lo tiene activo
 * (cambió de teléfono) escribe primero el código actual: sin él, un token robado sustituiría el segundo factor.
 */
export function SegundoFactor() {
  usePaletaGrafito()
  const alcance = useAlcance()
  const perdida = useSesionPerdida(alcance)
  const navegar = useNavigate()
  const cuenta = useCuentaActual(alcance === 'COMPLETO')
  const [alta, setAlta] = useState<{ uri: string; secreto: string } | null>(null)
  const [codigoActual, setCodigoActual] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoAlta | ResultadoConfirmacionFactor | null>(null)
  const [saliendo, setSaliendo] = useState(false)

  if (!alcance) {
    const motivo = motivoDeSalida(perdida, saliendo)
    return <Redirigir destino={{ to: '/panel/ingreso', search: motivo ? { motivo } : {} }} />
  }

  const restringida = alcance === 'ALTA_SEGUNDO_FACTOR'
  const rehace = !restringida && cuenta.data?.segundoFactorActivo === true
  const esperandoCuenta = !restringida && cuenta.isPending

  async function generar(evento?: FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    if (enviando) return
    setEnviando(true)
    setResultado(null)
    const respuesta = await iniciarAltaSegundoFactor(rehace ? codigoActual : undefined)
    setEnviando(false)
    if (respuesta.tipo === 'alta') {
      setAlta({ uri: respuesta.uri, secreto: respuesta.secreto })
      setCodigo('')
      setCodigoActual('')
      return
    }
    if (respuesta.tipo === 'codigo-incorrecto') setCodigoActual('')
    setResultado(respuesta)
  }

  async function activar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    setEnviando(true)
    setResultado(null)
    const respuesta = await confirmarSegundoFactor(codigo)
    setEnviando(false)
    if (respuesta.tipo === 'activado') {
      setAlta(null)
      void navegar({ to: restringida ? '/panel' : '/panel/seguridad', replace: true })
      return
    }
    if (respuesta.tipo === 'codigo-incorrecto') setCodigo('')
    if (respuesta.tipo === 'sin-alta') setAlta(null)
    setResultado(respuesta)
  }

  // Al borrar el token, la guarda de arriba lleva al ingreso con el motivo correcto.
  function salir() {
    setSaliendo(true)
    void cerrarSesion()
  }

  const mensaje = resultado ? mensajeSegundoFactor(resultado) : null
  const rechazoDelActual = rehace && resultado?.tipo === 'codigo-incorrecto' && !alta
  const rechazoDelNuevo = resultado?.tipo === 'codigo-incorrecto' && !rechazoDelActual

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Seguridad de la cuenta</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>Segundo factor</h1>
        <p className={pagina.entrada}>
          {restringida
            ? 'Tu cuenta de administrador necesita un segundo factor antes de entrar al panel.'
            : rehace
              ? 'Cambia de teléfono: el código nuevo reemplaza al anterior en cuanto lo confirmes.'
              : 'Protege tu cuenta con un código de tu app de autenticación además de la clave.'}
        </p>
      </header>
      <div className={estilos.columna}>
        <section className={`${bloques.bloque} ${estilos.formulario}`} aria-label="Alta del segundo factor">
          <ol className={estilos.pasos}>
            <li className={estilos.paso}>
              <h2>Genera el código QR</h2>
              <p className={estilos.nota}>Necesitas una app de autenticación en el teléfono, como las de Google o Microsoft.</p>
              {!alta && rehace && (
                <form className={estilos.formulario} onSubmit={(evento) => void generar(evento)} noValidate>
                  <Campo
                    etiqueta="Código actual de la app"
                    tipo="codigo"
                    value={codigoActual}
                    onChange={(evento) => setCodigoActual(evento.target.value)}
                    error={rechazoDelActual ? mensaje : null}
                    ayuda="El de tu teléfono de ahora, para comprobar que eres tú."
                  />
                  <Button type="submit" className={botones.secundario} isDisabled={enviando || codigoActual.length !== 6}>
                    {enviando ? 'Generando…' : 'Generar código QR'}
                  </Button>
                </form>
              )}
              {!alta && !rehace && (
                <Button className={botones.secundario} isDisabled={enviando || esperandoCuenta} onPress={() => void generar()}>
                  {enviando ? 'Generando…' : 'Generar código QR'}
                </Button>
              )}
            </li>
            <li className={estilos.paso}>
              <h2>Escanéalo con la app</h2>
              {alta ? (
                <>
                  <CodigoQr texto={alta.uri} />
                  <p className={estilos.nota}>Si la cámara no lo lee, escribe esta clave en la app:</p>
                  <p className={estilos.secreto}>{agruparSecreto(alta.secreto)}</p>
                  <p className={estilos.nota}>
                    La clave se muestra una sola vez. Si recargas la página antes de terminar, tendrás que generar otro código.
                  </p>
                </>
              ) : (
                <p className={estilos.nota}>El código aparece aquí cuando lo generes.</p>
              )}
            </li>
            <li className={estilos.paso}>
              <h2>Escribe el código que muestra la app</h2>
              <form className={estilos.formulario} onSubmit={(evento) => void activar(evento)} noValidate>
                <Campo
                  etiqueta="Código de la app"
                  tipo="codigo"
                  value={codigo}
                  onChange={(evento) => setCodigo(evento.target.value)}
                  disabled={!alta}
                  error={rechazoDelNuevo ? mensaje : null}
                />
                <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={!alta || enviando || codigo.length !== 6}>
                  {enviando && alta ? 'Activando…' : <>Activar segundo factor <span className={botones.flecha} aria-hidden="true">→</span></>}
                </Button>
              </form>
            </li>
          </ol>
          {mensaje && !rechazoDelActual && !rechazoDelNuevo && <p className={campos.error} role="alert">{mensaje}</p>}
        </section>
        {restringida
          ? <button type="button" className={estilos.enlaceBoton} onClick={salir}>Salir sin configurarlo</button>
          : <Link to="/panel/seguridad" className={pagina.enlace}>Volver a Seguridad</Link>}
      </div>
    </div>
  )
}
