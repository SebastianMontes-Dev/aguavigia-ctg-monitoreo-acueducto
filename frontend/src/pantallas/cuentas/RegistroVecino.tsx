import { Link } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { registrarVecino, type ResultadoSolicitud } from '../../api/cuentas'
import { useBarrios } from '../../app/datos'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import { Casilla } from '../../componentes/Casilla'
import { MarcaRecibido } from '../../componentes/MarcaRecibido'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import botones from '../../componentes/Botones.module.css'
import { mensajeSolicitud, NEUTRO } from '../../dominio/mensajes-cuenta'
import { nombreLegible } from '../../dominio/sectores'
import avisos from '../publico/Avisos.module.css'
import { PaginaCuenta, type Paso } from './PaginaCuenta'
import { errorDeCorreo } from './formularios'
import estilos from './Cuenta.module.css'

const PASOS: readonly Paso[] = [
  { icono: 'documento', titulo: 'Te registras', detalle: 'Con tu correo, tu nombre y tu barrio. No escribes ninguna clave aquí.' },
  { icono: 'correo', titulo: 'Eliges tu clave desde el correo', detalle: 'Al abrir el enlace y elegirla, la cuenta queda activa. Nadie tiene que aprobarla.' },
  { icono: 'ubicacion', titulo: 'Verificas tu barrio (opcional)', detalle: 'Con tu ubicación del momento, que no se guarda. Tus reportes llegan marcados como de cuenta verificada.' },
]

interface Errores { correo?: string; nombre?: string; barrio?: string; privacidad?: string }

/**
 * Guía §5.5: sin clave (la elige quien abre el enlace del correo, para que nadie registre el correo de otra persona con una clave
 * suya). `202` siempre y el mismo mensaje. Sin barrio o sin la casilla de privacidad, el error va junto al campo y no sale ninguna petición.
 */
export function RegistroVecino() {
  const barrios = useBarrios()
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [barrioId, setBarrioId] = useState<string | undefined>()
  const [privacidad, setPrivacidad] = useState(false)
  const [avisosBarrio, setAvisosBarrio] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSolicitud | null>(null)
  const formulario = useRef<HTMLFormElement>(null)
  const campoCorreo = useRef<HTMLInputElement>(null)
  const campoNombre = useRef<HTMLInputElement>(null)
  const campoPrivacidad = useRef<HTMLInputElement>(null)

  const disponibles = barrios.data ?? []
  const barrio = disponibles.find((sector) => sector.id === barrioId)

  function enfocarPrimero(nuevos: Errores) {
    if (nuevos.correo) campoCorreo.current?.focus()
    else if (nuevos.nombre) campoNombre.current?.focus()
    else if (nuevos.barrio) formulario.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
    else campoPrivacidad.current?.focus()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const nuevos: Errores = {
      ...(errorDeCorreo(campoCorreo.current, correo) ? { correo: errorDeCorreo(campoCorreo.current, correo) as string } : {}),
      ...(nombre.trim() ? {} : { nombre: 'Escribe tu nombre.' }),
      ...(barrio ? {} : { barrio: 'Elige tu barrio de la lista.' }),
      ...(privacidad ? {} : { privacidad: 'Para crear la cuenta tienes que aceptarlo.' }),
    }
    setErrores(nuevos)
    setResultado(null)
    if (Object.keys(nuevos).length > 0 || !barrioId) {
      enfocarPrimero(nuevos)
      return
    }
    setEnviando(true)
    const respuesta = await registrarVecino({ correo: correo.trim(), nombre: nombre.trim(), barrioId, privacidad, avisos: avisosBarrio })
    setEnviando(false)
    if (respuesta.tipo === 'rechazado') {
      const delServidor: Errores = {
        ...(respuesta.campos.correo ? { correo: respuesta.campos.correo } : {}),
        ...(respuesta.campos.nombre ? { nombre: respuesta.campos.nombre } : {}),
        ...(respuesta.campos.barrioId ? { barrio: respuesta.campos.barrioId } : {}),
        ...(respuesta.campos.privacidad ? { privacidad: respuesta.campos.privacidad } : {}),
      }
      setErrores(delServidor)
      if (Object.keys(delServidor).length > 0) enfocarPrimero(delServidor)
    }
    setResultado(respuesta)
  }

  const recibido = resultado?.tipo === 'recibido'
  const mensaje = resultado ? mensajeSolicitud(resultado) : null

  return (
    <PaginaCuenta
      rotulo="Cuenta de vecino · gratis"
      titular="Regístrate como vecino de tu barrio"
      bajada="Con tu barrio verificado, tus reportes llegan marcados como de cuenta verificada y puedes enviar 5 por barrio cada 30 minutos en vez de 3. Reportar sin cuenta sigue siendo posible."
      tituloPasos="Así funciona"
      pasos={PASOS}
      etiqueta="Registro de vecino"
    >
      {recibido ? (
        <div className={estilos.recibido}>
          <MarcaRecibido />
          <h2 className={avisos.subtitulo}>Revisa tu correo</h2>
          <output className={avisos.respuesta}>{NEUTRO.vecino}</output>
          <p className={estilos.nota}>Al elegir tu clave con ese enlace, la cuenta queda activa{barrio ? <> como vecino de <strong>{nombreLegible(barrio.nombre)}</strong></> : null}.</p>
          <div className={avisos.acciones}>
            <Link to="/cuenta/reenviar" className={avisos.enlace}>¿No te llegó? Reenviar el correo</Link>
            <Link to="/vecino/ingreso" className={avisos.enlace}>Ir al ingreso</Link>
          </div>
        </div>
      ) : (
        <form ref={formulario} className={estilos.formulario} onSubmit={(evento) => void enviar(evento)} noValidate>
          <Campo etiqueta="Correo" tipo="correo" autoComplete="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} error={errores.correo} ref={campoCorreo} />
          <Campo etiqueta="Nombre" autoComplete="name" value={nombre} onChange={(evento) => setNombre(evento.target.value)} error={errores.nombre} ref={campoNombre} />
          <div className={estilos.fila2}>
            {barrios.isPending ? <output className={estilos.nota}>Cargando barrios…</output> : barrios.isError ? (
              <p role="alert">No pudimos cargar los barrios. <button type="button" className={avisos.enlace} onClick={() => void barrios.refetch()}>Volver a intentar</button></p>
            ) : (
              <>
                <SelectorBarrio
                  forma="campo"
                  etiquetaVisible
                  sinQuitar
                  sectores={disponibles}
                  valor={barrioId}
                  etiqueta="Tu barrio"
                  marcador="Busca tu barrio"
                  alCambiar={(id) => {
                    setBarrioId(id)
                    if (id) setErrores({ ...errores, barrio: undefined })
                  }}
                />
                {errores.barrio && <p className={campos.error} role="alert">{errores.barrio}</p>}
              </>
            )}
          </div>
          <Casilla
            ref={campoPrivacidad}
            checked={privacidad}
            onChange={(evento) => setPrivacidad(evento.target.checked)}
            etiqueta="Acepto que AguaVigía guarde mi correo, mi nombre y mi barrio para mi cuenta."
            ayuda="La ubicación que uses para verificar tu barrio no se guarda."
            error={errores.privacidad}
          />
          <Casilla
            checked={avisosBarrio}
            onChange={(evento) => setAvisosBarrio(evento.target.checked)}
            etiqueta="Quiero recibir por correo los avisos de cortes de mi barrio."
          />
          {mensaje && <p className={avisos.alerta} role="alert">{mensaje}</p>}
          <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando || !barrios.isSuccess}>
            {enviando ? 'Enviando…' : <>Crear mi cuenta <span className={botones.flecha} aria-hidden="true">→</span></>}
          </Button>
          <div className={estilos.pie}>
            <Link to="/vecino/ingreso" className={avisos.enlace}>Ya tengo cuenta</Link>
            <Link to="/cuenta/reenviar" className={avisos.enlace}>¿No te llegó el correo?</Link>
          </div>
        </form>
      )}
    </PaginaCuenta>
  )
}
