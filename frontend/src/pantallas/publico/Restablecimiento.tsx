import { Link, useParams, useSearch } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useState } from 'react'
import { Button } from 'react-aria-components'
import { useListado } from '../../app/datos'
import { confirmarRestablecimiento, type ResultadoRestablecimiento } from '../../api/restablecimiento'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import { MarcaRecibido } from '../../componentes/MarcaRecibido'
import { presentarEstado } from '../../dominio/estados'
import { nombreLegible } from '../../dominio/sectores'
import { duracionEnPalabras } from '../../dominio/tiempo'
import botones from '../../componentes/Botones.module.css'
import pagina from './Pagina.module.css'
import estilos from './Avisos.module.css'

function mensajeError(resultado: Exclude<ResultadoRestablecimiento, { tipo: 'recibido' }>): string {
  switch (resultado.tipo) {
    case 'enlace-invalido': return 'Este enlace ya no sirve: venció o ya no recibes avisos de este barrio.'
    case 'esperar': return resultado.segundos
      ? `Ya enviaste varias respuestas sobre este barrio. Espera ${duracionEnPalabras(resultado.segundos * 1000)} antes de volver a intentarlo.`
      : 'Ya enviaste varias respuestas sobre este barrio. Espera un rato antes de volver a intentarlo.'
    case 'sin-red': return 'No pudimos comprobar si se recibió tu respuesta. Revisa tu conexión antes de volver a intentarlo.'
    case 'fallo': return 'No pudimos registrar tu respuesta. Inténtalo de nuevo más tarde.'
  }
}

/**
 * Guía §5.1, FE1: la pantalla a la que lleva el correo de aviso. Abrirla no vota (los clientes de correo abren los enlaces
 * solos): el `POST` sale solo del botón, y el token se retira de la URL al leerlo.
 */
export function Restablecimiento() {
  const { id } = useParams({ from: '/publico/sectores/$id/restablecimiento' })
  const { token } = useSearch({ from: '/publico/sectores/$id/restablecimiento' })
  const { porId } = useListado()
  const sector = porId.get(id)
  const barrio = sector ? nombreLegible(sector.nombre) : null
  const estado = presentarEstado(sector?.estado ?? null)
  const [tokenInicial] = useState(token)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoRestablecimiento | null>(null)
  const [esperaHasta, setEsperaHasta] = useState<number | null>(null)

  useLayoutEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token')) return
    url.searchParams.delete('token')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  // Con un 429 el botón espera lo que dice `Retry-After` antes de dejar intentar otra vez.
  useEffect(() => {
    if (esperaHasta === null) return
    const temporizador = window.setTimeout(() => setEsperaHasta(null), Math.max(0, esperaHasta - Date.now()))
    return () => window.clearTimeout(temporizador)
  }, [esperaHasta])

  async function responder() {
    if (!tokenInicial || enviando || esperaHasta !== null) return
    setEnviando(true)
    const respuesta = await confirmarRestablecimiento(id, tokenInicial)
    setResultado(respuesta)
    if (respuesta.tipo === 'esperar' && respuesta.segundos) setEsperaHasta(Date.now() + respuesta.segundos * 1000)
    setEnviando(false)
  }

  const verBarrio = (
    <Link to="/sectores/$id" params={{ id }} className={botones.secundario}>
      {barrio ? `Ver ${barrio}` : 'Ver el barrio'}
    </Link>
  )

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={estilos.rotulo}>Avisos por correo</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>¿Ya volvió el agua a {barrio ?? 'tu barrio'}?</h1>
        {sector && (
          <p className={estilos.estado}>
            <GlifoEstado estado={sector.estado} tamano={16} />
            Ahora figura como: {estado.texto}
          </p>
        )}
      </header>
      <div className={estilos.columnas}>
        <section className={estilos.tarea} aria-label="Responder si volvió el agua">
          {!tokenInicial ? (
            <>
              <p role="alert">Falta el enlace completo. Abre el que llegó a tu correo.</p>
              {verBarrio}
            </>
          ) : resultado?.tipo === 'recibido' ? (
            <>
              <MarcaRecibido />
              <output className={estilos.respuesta}>Gracias. Tu respuesta cuenta junto con la de tus vecinos.</output>
              {verBarrio}
            </>
          ) : resultado?.tipo === 'enlace-invalido' ? (
            <>
              <p role="alert" className={estilos.respuesta}>{mensajeError(resultado)}</p>
              {verBarrio}
            </>
          ) : (
            <>
              <p className={estilos.nota}>Pulsa el botón solo si ya tienes agua en tu casa. Abrir el enlace no cambia nada por sí solo.</p>
              <Button className={botones.principal} isDisabled={enviando || esperaHasta !== null} onPress={() => void responder()}>
                {enviando ? 'Enviando…' : <>Sí, ya volvió el agua <span className={botones.flecha} aria-hidden="true">→</span></>}
              </Button>
              {resultado && <p role="alert" className={estilos.alerta}>{mensajeError(resultado)}</p>}
            </>
          )}
        </section>
        <aside className={estilos.explicacion} aria-labelledby="titulo-respuesta">
          <h2 id="titulo-respuesta">Al responder</h2>
          <ol className={estilos.pasos}>
            <li><strong>Tu respuesta cuenta como la de un vecino más.</strong></li>
            <li><strong>El barrio cambia en el mapa cuando suficientes vecinos confirman que volvió el agua.</strong></li>
          </ol>
        </aside>
      </div>
    </div>
  )
}
