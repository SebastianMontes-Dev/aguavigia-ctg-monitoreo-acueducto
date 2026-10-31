import { Link, useSearch } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { MAXIMO_BARRIOS_POR_AVISO, MENSAJE_NEUTRO, pedirAvisos, type ResultadoAlta } from '../../api/avisos'
import { useBarrios } from '../../app/datos'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import { Icono, type NombreIcono } from '../../componentes/Icono'
import { MarcaRecibido } from '../../componentes/MarcaRecibido'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import botones from '../../componentes/Botones.module.css'
import { presentarEstado, type EstadoServicio } from '../../dominio/estados'
import { formatearNumero } from '../../dominio/formato'
import { nombreLegible, type Sector } from '../../dominio/sectores'
import pagina from './Pagina.module.css'
import estilos from './Avisos.module.css'

function mensajeAdicional(resultado: ResultadoAlta): string | null {
  switch (resultado.tipo) {
    case 'recibido': return null
    case 'invalido': return 'Revisa el correo y los barrios elegidos antes de volver a enviarlo.'
    case 'demasiados-barrios': return `Puedes pedir avisos de hasta ${formatearNumero(MAXIMO_BARRIOS_POR_AVISO)} barrios a la vez. Quita algunos e inténtalo de nuevo.`
    case 'esperar': return resultado.segundos === null
      ? 'Hay demasiadas solicitudes. Espera antes de volver a intentarlo.'
      : `Hay demasiadas solicitudes. Espera ${formatearNumero(resultado.segundos)} segundos antes de volver a intentarlo.`
    case 'sin-red': return 'No pudimos comprobar si se recibió la solicitud. Revisa tu conexión antes de volver a enviarla.'
    case 'fallo': return 'No pudimos comprobar si se recibió la solicitud. Inténtalo de nuevo más tarde.'
  }
}

const bot = import.meta.env.VITE_TELEGRAM_BOT?.trim().replace(/^@/, '')
const botValido = bot && /^[a-zA-Z0-9_]{5,32}$/.test(bot) ? bot : null

function estadoDe(sector: Sector | undefined): EstadoServicio | null {
  const estado = sector?.estado
  return estado === 'CON_SERVICIO' || estado === 'SIN_SERVICIO' || estado === 'PRESION_BAJA' || estado === 'CORTE_PROGRAMADO' ? estado : null
}

const PASOS: { icono: NombreIcono; titulo: string; detalle: string }[] = [
  { icono: 'ubicacion', titulo: 'Eliges tus barrios', detalle: 'Los que quieras, sin cuenta ni contraseña.' },
  { icono: 'correo', titulo: 'Confirmas desde el correo', detalle: 'Abrir el enlace no basta: pulsas «Confirmar avisos». Vence en 48 horas.' },
  { icono: 'campana', titulo: 'Te escribimos cuando cambie el agua', detalle: 'Cada correo trae un enlace para darte de baja.' },
]

/** ADR-108: la respuesta de la página, en un bloque teñido de cardenillo; los tres pasos se reparten toda su altura, uno por fila. */
export function ComoFunciona() {
  return (
    <aside className={estilos.explicacion} aria-labelledby="titulo-como-funciona">
      <h2 id="titulo-como-funciona">Así funciona</h2>
      <ol className={`${estilos.pasos} ${estilos.conIconos}`}>
        {PASOS.map((paso) => (
          <li key={paso.titulo}>
            <span className={estilos.circulo}><Icono nombre={paso.icono} tamano={20} /></span>
            <strong>{paso.titulo}</strong>
            <span>{paso.detalle}</span>
          </li>
        ))}
      </ol>
      {botValido && <a href={`https://t.me/${botValido}`} target="_blank" rel="noreferrer" className={estilos.enlace}>También por Telegram</a>}
    </aside>
  )
}

/** ADR-105: el error del correo, o null. El formato lo juzga el navegador (`type="email"`); el backend vuelve a validarlo. */
function errorDeCorreo(entrada: HTMLInputElement | null, correo: string): string | null {
  if (!correo.trim()) return 'Escribe tu correo.'
  if (entrada?.validity.typeMismatch) return 'Revisa el correo: debe tener la forma nombre@correo.com.'
  return null
}

/** RF012–RF015 · `ADR-079`, `ADR-105` y `ADR-108`: los barrios van primero y muestran su estado de ahora; el correo, después. Cada campo dice su error. */
export function Avisos() {
  const { sector } = useSearch({ from: '/publico/avisos' })
  const barrios = useBarrios()
  const [correo, setCorreo] = useState('')
  const [elegidos, setElegidos] = useState<string[]>(sector ? [sector] : [])
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoAlta | null>(null)
  const [errores, setErrores] = useState<{ barrios?: string | null; correo?: string | null }>({})
  const entradaCorreo = useRef<HTMLInputElement>(null)
  const formulario = useRef<HTMLFormElement>(null)

  const disponibles = barrios.data ?? []
  const porId = new Map(disponibles.map((barrio) => [barrio.id, barrio]))
  const elegidosValidos = elegidos.filter((id) => porId.has(id))
  const barrioDesconocido = barrios.isSuccess && elegidosValidos.length !== elegidos.length
  const nombreDe = (id: string) => nombreLegible(porId.get(id)?.nombre)

  function elegir(nuevos: string[]) {
    setElegidos(nuevos)
    if (errores.barrios && nuevos.length) setErrores({ ...errores, barrios: null })
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const encontrados = {
      barrios: elegidosValidos.length === 0 ? 'Elige al menos un barrio de la lista.' : null,
      correo: errorDeCorreo(entradaCorreo.current, correo),
    }
    setErrores(encontrados)
    if (encontrados.barrios || encontrados.correo || barrioDesconocido) {
      // El foco va al primer campo con error, que lo anuncia por su aria-describedby.
      if (encontrados.barrios) formulario.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
      else if (encontrados.correo) entradaCorreo.current?.focus()
      return
    }
    setEnviando(true)
    setResultado(await pedirAvisos(correo.trim(), elegidosValidos))
    setEnviando(false)
  }

  function otraSolicitud() {
    setResultado(null)
    setCorreo('')
  }

  const recibido = resultado?.tipo === 'recibido'

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={estilos.rotulo}>Avisos por correo · gratis y sin cuenta</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>Te escribimos cuando cambie el agua en tu barrio</h1>
      </header>

      <div className={estilos.columnas}>
        {recibido ? (
          <section className={estilos.tarea} aria-labelledby="titulo-recibido">
            <MarcaRecibido />
            <h2 id="titulo-recibido" className={estilos.subtitulo}>Revisa tu correo</h2>
            <output className={estilos.respuesta}>{MENSAJE_NEUTRO}.</output>
            <p className={estilos.nota}>Pediste avisos de {elegidosValidos.map(nombreDe).join(', ')}.</p>
            <div className={estilos.acciones}>
              <button type="button" className={estilos.enlace} onClick={otraSolicitud}>Usar otro correo</button>
              <Link to="/" className={estilos.enlace}>Ver el mapa</Link>
            </div>
          </section>
        ) : (
          <form ref={formulario} className={estilos.tarea} onSubmit={(evento) => void enviar(evento)} noValidate>
            <fieldset className={estilos.grupo}>
              <legend className={estilos.paso}><span className={estilos.numero} aria-hidden="true">1</span>Elige tus barrios</legend>
              {barrios.isPending ? <output className={estilos.vacio}>Cargando barrios…</output> : barrios.isError ? (
                <div role="alert" className={estilos.error}>
                  <span>No pudimos cargar los barrios. <button type="button" className={estilos.enlace} onClick={() => void barrios.refetch()}>Volver a intentar</button></span>
                </div>
              ) : (
                <>
                  <SelectorBarrio key={elegidosValidos.join(',')} forma="campo" marcador="Escribe el nombre del barrio"
                    sectores={disponibles.filter((barrio) => !elegidosValidos.includes(barrio.id ?? ''))}
                    etiqueta={elegidosValidos.length ? 'Agregar otro barrio' : 'Busca tu barrio'}
                    invalido={Boolean(errores.barrios)} descritoPor={errores.barrios ? 'error-barrios' : undefined}
                    alCambiar={(id) => { if (id && !elegidos.includes(id)) elegir([...elegidosValidos, id]) }} />
                  {errores.barrios && <p id="error-barrios" className={estilos.error}>{errores.barrios}</p>}
                  {elegidosValidos.length > 0 ? (
                    <ul className={estilos.elegidos} aria-label="Barrios elegidos">
                      {elegidosValidos.map((id) => {
                        const estado = estadoDe(porId.get(id))
                        return (
                          <li key={id} className={estilos.fila}>
                            <span className={estilos.barrio}>{nombreDe(id)}</span>
                            <span className={estilos.estado}>
                              {estado
                                ? <><GlifoEstado estado={estado} tamano={16} />{presentarEstado(estado).texto}</>
                                : <><span className={estilos.sinDatos} aria-hidden="true" />Sin datos verificados</>}
                            </span>
                            <button type="button" className={estilos.quitar} aria-label={`Quitar ${nombreDe(id)}`}
                              onClick={() => elegir(elegidosValidos.filter((elegido) => elegido !== id))}>
                              <Icono nombre="quitar" tamano={16} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className={estilos.vacio}>Aún no elegiste ningún barrio. Los que elijas aparecen aquí con su estado de ahora.</p>
                  )}
                  {barrioDesconocido && <p role="alert" className={estilos.error}>El barrio del enlace no está disponible. Elige uno de la lista.</p>}
                </>
              )}
            </fieldset>
            <div className={estilos.campo}>
              <label htmlFor="correo-avisos" className={estilos.paso}><span className={estilos.numero} aria-hidden="true">2</span>Tu correo</label>
              <span className={estilos.caja} data-invalido={errores.correo ? true : undefined}>
                <Icono nombre="correo" tamano={18} />
                <input ref={entradaCorreo} id="correo-avisos" type="email" autoComplete="email" required placeholder="nombre@correo.com"
                  value={correo} aria-invalid={errores.correo ? true : undefined} aria-describedby={errores.correo ? 'error-correo' : undefined}
                  onChange={(evento) => {
                    setCorreo(evento.target.value)
                    if (errores.correo) setErrores({ ...errores, correo: errorDeCorreo(evento.target, evento.target.value) })
                  }}
                  onBlur={(evento) => { if (evento.target.value.trim()) setErrores({ ...errores, correo: errorDeCorreo(evento.target, evento.target.value) }) }} />
              </span>
              {errores.correo && <p id="error-correo" className={estilos.error}>{errores.correo}</p>}
            </div>
            <div className={estilos.envio}>
              <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={enviando || !barrios.isSuccess}>
                {enviando ? 'Enviando…' : <>Enviar enlace de confirmación <span className={botones.flecha} aria-hidden="true">→</span></>}
              </Button>
              <p className={estilos.nota}>El enlace vence en 48 horas. Sin confirmarlo no te llega ningún aviso.</p>
            </div>
            {resultado && (
              <output className={estilos.alerta}>
                {MENSAJE_NEUTRO}.{mensajeAdicional(resultado) && <> {mensajeAdicional(resultado)}</>}
              </output>
            )}
          </form>
        )}
        <ComoFunciona />
      </div>
    </div>
  )
}
