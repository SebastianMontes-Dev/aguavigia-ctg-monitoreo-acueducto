import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Button } from 'react-aria-components'
import type { ResultadoAccion } from '../../api/acciones-panel'
import { anularPropuesta, aprobarPropuesta, descartarPropuesta } from '../../api/ingesta'
import { useAhora } from '../../app/ahora'
import { useAccion, useBarriosPanel, useFallidos, usePropuestas, useSaludColectores } from '../../app/datos-panel'
import { usePaletaGrafito } from '../../app/paleta'
import { usePermisos } from '../../app/panel'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import { GlifoSalud } from '../../componentes/GlifoSalud'
import { formatearNumero } from '../../dominio/formato'
import {
  accionesDe, citaDe, confianzaEnPalabras, confirmacionIngesta, consecuenciaDeAprobar, estadoPropuestoDe, estadoPropuestoEnPalabras,
  estaPendiente, fallosEnPalabras, fuenteDe, ordenarPorSalud, revisionEnPalabras, saludDe, saludEnPalabras, tasaDeErrorEnPalabras,
  ultimaVezEnPalabras, ventanaEnPalabras,
  type AccionIngesta, type DocumentoFallido, type PropuestaIngesta, type SaludColector,
} from '../../dominio/ingesta'
import { presentarEstado } from '../../dominio/estados'
import { mensajeAccion, type ContextoAccion } from '../../dominio/mensajes-panel'
import { nombreLegible } from '../../dominio/sectores'
import { haceCuanto, momento } from '../../dominio/tiempo'
import pagina from '../publico/Pagina.module.css'
import { FormularioAnulacion } from './FormulariosCorte'
import estilos from './Gestion.module.css'
import propios from './Ingesta.module.css'

const CONTEXTOS: Record<AccionIngesta, ContextoAccion> = {
  aprobar: 'aprobar-propuesta',
  descartar: 'descartar-propuesta',
  anular: 'anular-propuesta',
}

const ETIQUETAS: Record<AccionIngesta, string> = { aprobar: 'Aprobar', descartar: 'Descartar', anular: 'Anular la aprobación' }

const ANULAR_PROPUESTA = {
  titulo: 'Anular la aprobación',
  vacio: 'Escribe por qué se anula la aprobación.',
  ayuda: 'Queda a la vista del público en la bitácora, citando el boletín, y en la auditoría. El barrio se recalcula.',
  boton: 'Sí, anular la aprobación',
  enviandoTexto: 'Anulando…',
}

function Evidencia({ propuesta }: { propuesta: PropuestaIngesta }) {
  const cita = citaDe(propuesta)
  return (
    <div className={propios.evidencia} data-falta={cita.tipo === 'sin-cita' ? true : undefined}>
      <p className={propios.rotuloCita}>Frase del boletín</p>
      {cita.tipo === 'con-cita'
        ? <blockquote className={propios.cita}>{cita.texto}</blockquote>
        : <p className={propios.falta}>Esta propuesta no trae la frase del boletín que la respalda. Sin esa frase no se debe aprobar.</p>}
      <p className={propios.motivo}>
        <strong>Por qué espera revisión:</strong>{' '}
        {propuesta.motivoDeRevision?.trim() ? propuesta.motivoDeRevision : 'el servidor no indicó el motivo.'}
      </p>
    </div>
  )
}

function Fuente({ propuesta }: { propuesta: PropuestaIngesta }) {
  const fuente = fuenteDe(propuesta)
  if (fuente.tipo === 'enlace') {
    return (
      <a className={propios.enlace} href={fuente.url} target="_blank" rel="noopener noreferrer">
        Abrir el original en {fuente.sitio}<span className={estilos.oculto}> (se abre en otra pestaña)</span>
      </a>
    )
  }
  if (fuente.tipo === 'no-es-web') return <span className={propios.sinEnlace}>El enlace no es una dirección web: {fuente.texto}</span>
  return <span className={propios.sinEnlace}>Sin enlace al original</span>
}

interface PropiedadesFila {
  propuesta: PropuestaIngesta
  barrio: string
  estadoActual: string | null | undefined
  actualizando: boolean
  ahora: Date
  puedeRevisar: boolean
  enfocar: boolean
  alResolver: (propuesta: PropuestaIngesta | null, aviso: string | null) => void
}

function ConsecuenciaAprobada({ propuesta, barrio, estadoActual, actualizando }: Pick<PropiedadesFila, 'propuesta' | 'barrio' | 'estadoActual' | 'actualizando'>) {
  if (actualizando) return <p className={bloques.bajada}>Consultando el estado actual de {barrio}…</p>
  const { coincide, estadoActual: actual } = consecuenciaDeAprobar(propuesta, estadoActual)
  const ahora = presentarEstado(actual).texto
  return coincide
    ? <p className={bloques.bajada}>El mapa ya muestra «{ahora}» en {barrio}.</p>
    : (
      <p className={bloques.bajada}>
        Aprobar no siempre cambia el mapa: ahora {barrio} muestra «{ahora}», no «{estadoPropuestoEnPalabras(propuesta)}». Una propuesta sin ventana
        horaria, por ejemplo, queda aprobada sin cambiar el estado.
      </p>
    )
}

function FilaPropuesta({ propuesta, barrio, estadoActual, actualizando, ahora, puedeRevisar, enfocar, alResolver }: PropiedadesFila) {
  const [abierta, setAbierta] = useState<AccionIngesta | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const { enviando, ejecutar } = useAccion()
  const cliente = useQueryClient()
  const caja = useRef<HTMLFieldSetElement>(null)
  const fila = useRef<HTMLLIElement>(null)
  const acciones = useRef<HTMLDivElement>(null)
  const id = propuesta.id ?? ''
  const permitidas = accionesDe(propuesta)
  const estado = estadoPropuestoDe(propuesta)
  const hora = propuesta.detectadaEn
  const confianza = confianzaEnPalabras(propuesta.confianza)
  const textos = abierta && abierta !== 'anular' ? confirmacionIngesta(abierta, propuesta, barrio) : null

  useEffect(() => {
    if (abierta && abierta !== 'anular') caja.current?.focus()
  }, [abierta])

  // Una propuesta que acaba de pasar a «resueltas» es una fila nueva: el foco no se pierde en el cuerpo de la página.
  useEffect(() => {
    if (enfocar) fila.current?.focus()
  }, [enfocar])

  function cancelar() {
    const anterior = abierta
    setAbierta(null)
    queueMicrotask(() => {
      const controles = acciones.current?.querySelectorAll('button')
      const indice = anterior === 'descartar' ? 1 : 0
      controles?.[Math.min(indice, (controles?.length ?? 1) - 1)]?.focus()
    })
  }

  async function decidir(accion: AccionIngesta, llamada: () => Promise<ResultadoAccion<PropuestaIngesta>>) {
    const resultado = await ejecutar(llamada)
    if (!resultado) return
    if (resultado.tipo === 'hecho') {
      // Una aprobada que se anula sigue siendo la misma fila (en «resueltas»): su formulario se cierra aquí.
      setAbierta(null)
      setMensaje(null)
      alResolver({ ...propuesta, ...resultado.dato }, null)
      return
    }
    const texto = mensajeAccion(resultado, CONTEXTOS[accion])
    if (resultado.tipo === 'sin-permiso') void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
    if (resultado.tipo === 'conflicto' || resultado.tipo === 'no-existe') {
      // Lo que el servidor sabe de esta propuesta cambió: se vuelve a pedir y lo que hay que decirle va a la página.
      alResolver(null, texto)
      if (!estaPendiente(propuesta)) setMensaje(texto)
      setAbierta(null)
      return
    }
    setMensaje(texto)
    setAbierta(null)
  }

  const hayAcciones = puedeRevisar && (permitidas.aprobar || permitidas.descartar || permitidas.anular)
  const ocupado = enviando || abierta !== null

  return (
    <li className={propios.propuesta} ref={fila} tabIndex={-1}>
      <div className={propios.cabeza}>
        {estado ? <GlifoEstado estado={estado} tamano={20} /> : <span />}
        <p className={propios.que}>
          <strong>{barrio}</strong> · propone «{estadoPropuestoEnPalabras(propuesta)}»
        </p>
        {hora ? <time className={propios.hora} dateTime={hora}>{haceCuanto(hora, ahora)}</time> : <span className={propios.hora}>Sin hora</span>}
      </div>
      <ul className={propios.datos} aria-label="Datos de la propuesta">
        <li><span className={propios.fuente}>{propuesta.fuente || 'Fuente sin nombre'}</span></li>
        {confianza && <li>{confianza}</li>}
        <li>{ventanaEnPalabras(propuesta, ahora)}</li>
      </ul>
      <Evidencia propuesta={propuesta} />
      {!estaPendiente(propuesta) && (
        <div>
          <p className={propios.decision}>{revisionEnPalabras(propuesta.estadoRevision)}</p>
          {propuesta.estadoRevision === 'APROBADA' && <ConsecuenciaAprobada propuesta={propuesta} barrio={barrio} estadoActual={estadoActual} actualizando={actualizando} />}
          {propuesta.estadoRevision === 'DESCARTADA' && <p className={bloques.bajada}>No tocó {barrio}: queda archivada, no se borra.</p>}
          {propuesta.estadoRevision === 'ANULADA' && <p className={bloques.bajada}>La aprobación se deshizo y {barrio} se recalculó. La corrección quedó en la bitácora.</p>}
        </div>
      )}
      <div className={propios.pie}>
        <Fuente propuesta={propuesta} />
        {hayAcciones && abierta !== 'anular' && (
          <div className={estilos.acciones} ref={acciones}>
            {permitidas.aprobar && (
              <Button className={`${botones.secundario} ${estilos.accion}`} isDisabled={ocupado} aria-label={`Aprobar la propuesta de ${barrio}`} onPress={() => { setMensaje(null); setAbierta('aprobar') }}>
                Aprobar
              </Button>
            )}
            {permitidas.descartar && (
              <Button className={`${botones.secundario} ${estilos.accion}`} isDisabled={ocupado} aria-label={`Descartar la propuesta de ${barrio}`} onPress={() => { setMensaje(null); setAbierta('descartar') }}>
                Descartar
              </Button>
            )}
            {permitidas.anular && (
              <Button className={`${botones.secundario} ${estilos.accion}`} isDisabled={ocupado} onPress={() => { setMensaje(null); setAbierta('anular') }}>
                Anular la aprobación
              </Button>
            )}
          </div>
        )}
        {puedeRevisar && estaPendiente(propuesta) && !permitidas.aprobar && (
          <p className={propios.bloqueo}>No se puede aprobar sin la frase del boletín. Puedes descartarla.</p>
        )}
      </div>
      {abierta === 'anular' && (
        <FormularioAnulacion
          enviando={enviando}
          objeto={ANULAR_PROPUESTA}
          alEnviar={(motivo) => void decidir('anular', () => anularPropuesta(id, motivo))}
          alCancelar={() => setAbierta(null)}
        />
      )}
      {abierta && textos && (
        <fieldset className={estilos.confirmar} tabIndex={-1} ref={caja}>
          <legend className={estilos.oculto}>Confirmar: {ETIQUETAS[abierta]}</legend>
          <p>{textos.pregunta}</p>
          <div className={estilos.acciones}>
            <Button
              className={botones.principal}
              isDisabled={enviando}
              onPress={() => void decidir(abierta, () => (abierta === 'aprobar' ? aprobarPropuesta(id) : descartarPropuesta(id)))}
            >
              {enviando ? textos.enviando : textos.boton}
            </Button>
            <Button className={botones.secundario} isDisabled={enviando} onPress={cancelar}>Cancelar</Button>
          </div>
        </fieldset>
      )}
      {mensaje && <p className={estilos.resultado} role="alert">{mensaje}</p>}
    </li>
  )
}

function titularDe(cargando: boolean, fallo: boolean, cantidad: number, hayMas: boolean): string {
  if (cargando) return 'Consultando las propuestas de la ingesta…'
  if (fallo) return 'No pudimos consultar las propuestas'
  if (cantidad === 0) return 'No hay propuestas por revisar'
  const texto = `${formatearNumero(cantidad)}${hayMas ? ' o más' : ''}`
  return cantidad === 1 && !hayMas ? '1 propuesta espera tu decisión' : `${texto} propuestas esperan tu decisión`
}

function Consultado({ cuando, ahora }: { cuando: number; ahora: Date }) {
  if (!cuando) return null
  return <p className={propios.nota}>Consultado {momento(new Date(cuando), ahora)}</p>
}

function ColectorSalud({ colector, ahora }: { colector: SaludColector; ahora: Date }) {
  const salud = saludDe(colector)
  return (
    <li className={propios.colector} data-salud={salud}>
      <div className={propios.colectorCabeza}>
        <span className={propios.colectorNombre}>{colector.nombre || 'Colector sin nombre'}</span>
        <span className={propios.salud}><GlifoSalud salud={salud} />{saludEnPalabras(salud)}</span>
      </div>
      <dl className={propios.cifrasColector}>
        <div><dt>Último éxito</dt><dd>{ultimaVezEnPalabras(colector.ultimaEjecucionExitosa, ahora, 'Nunca')}</dd></div>
        <div><dt>Último fallo</dt><dd>{ultimaVezEnPalabras(colector.ultimoFallo, ahora, 'Nunca')}</dd></div>
        <div><dt>Tasa de error</dt><dd>{tasaDeErrorEnPalabras(colector.tasaDeError)}</dd></div>
        <div><dt>Fallos seguidos</dt><dd>{fallosEnPalabras(colector)}</dd></div>
      </dl>
      {colector.motivoDelUltimoFallo && <p className={propios.motivoFallo}><strong>Motivo del último fallo:</strong> {colector.motivoDelUltimoFallo}</p>}
    </li>
  )
}

function BloqueSalud({ ahora }: { ahora: Date }) {
  const consulta = useSaludColectores()
  return (
    <section className={bloques.bloque} aria-labelledby="titulo-salud">
      <h2 id="titulo-salud" className={estilos.tituloLateral}>Salud de los colectores</h2>
      {consulta.isPending && <output className={estilos.vacio}>Consultando los colectores…</output>}
      {consulta.isError && !consulta.data && (
        <p role="alert" className={estilos.vacio}>
          No pudimos consultar la salud de los colectores.{' '}
          <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      {consulta.data && consulta.data.length === 0 && (
        <p className={bloques.bajada}>Esta instancia del servidor todavía no corrió ningún ciclo de ingesta, así que no hay colectores que mostrar.</p>
      )}
      {consulta.data && consulta.data.length > 0 && (
        <ul className={estilos.lista}>
          {ordenarPorSalud(consulta.data).map((colector) => <ColectorSalud key={colector.nombre} colector={colector} ahora={ahora} />)}
        </ul>
      )}
      {consulta.isError && consulta.data && (
        <p role="alert" className={estilos.vacio}>
          No pudimos actualizar la salud. <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      <p className={propios.nota}>Con 3 fallos seguidos, un colector está caído. Estos datos viven en la memoria del servidor: un reinicio los borra y, con varias réplicas, cada una cuenta lo suyo.</p>
      <Consultado cuando={consulta.dataUpdatedAt} ahora={ahora} />
    </section>
  )
}

const VISIBLES = 3

function Documento({ documento, ahora }: { documento: DocumentoFallido; ahora: Date }) {
  const fuente = fuenteDe(documento)
  return (
    <li className={propios.documento}>
      <p className={propios.documentoTitulo}>{documento.titulo?.trim() || 'Documento sin título'}</p>
      <p className={propios.documentoMeta}>
        {documento.fuente || 'Fuente sin nombre'} · {documento.reintentos === undefined ? 'reintentos sin dato' : `${formatearNumero(documento.reintentos)} ${documento.reintentos === 1 ? 'reintento' : 'reintentos'}`}
      </p>
      {documento.motivo && <p className={propios.documentoMotivo}><strong>Motivo:</strong> {documento.motivo}</p>}
      <p className={propios.documentoMeta}>
        {documento.primerIntento ? `Primer intento ${momento(documento.primerIntento, ahora)}` : 'Primer intento sin dato'}
        {documento.ultimoIntento ? ` · último ${momento(documento.ultimoIntento, ahora)}` : ''}
      </p>
      {fuente.tipo === 'enlace' && (
        <a className={propios.enlace} href={fuente.url} target="_blank" rel="noopener noreferrer">
          Abrir el original en {fuente.sitio}<span className={estilos.oculto}> (se abre en otra pestaña)</span>
        </a>
      )}
      {fuente.tipo === 'no-es-web' && <span className={propios.sinEnlace}>El enlace no es una dirección web: {fuente.texto}</span>}
    </li>
  )
}

function BloqueFallidos({ ahora }: { ahora: Date }) {
  const consulta = useFallidos()
  const [todos, setTodos] = useState(false)
  const documentos = consulta.data ?? []
  const mostrados = todos ? documentos : documentos.slice(0, VISIBLES)
  return (
    <section className={bloques.bloque} aria-labelledby="titulo-fallidos">
      <h2 id="titulo-fallidos" className={estilos.tituloLateral}>
        Documentos fallidos{consulta.data && consulta.data.length > 0 ? ` · ${formatearNumero(consulta.data.length)}` : ''}
      </h2>
      {consulta.isPending && <output className={estilos.vacio}>Consultando los documentos…</output>}
      {consulta.isError && !consulta.data && (
        <p role="alert" className={estilos.vacio}>
          No pudimos consultar los documentos fallidos, así que no sabemos si hay alguno.{' '}
          <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      {consulta.data && documentos.length === 0 && (
        <p className={bloques.bajada}>Ningún documento está fallando ahora. Uno sale de esta lista en cuanto se procesa con éxito.</p>
      )}
      {documentos.length > 0 && (
        <>
          <ul className={estilos.lista}>
            {mostrados.map((documento) => <Documento key={`${documento.fuente}|${documento.urlOriginal}`} documento={documento} ahora={ahora} />)}
          </ul>
          {documentos.length > VISIBLES && (
            <button type="button" className={`${estilos.mas} ${propios.masDocumentos}`} aria-expanded={todos} onClick={() => setTodos(!todos)}>
              {todos ? 'Ver menos documentos' : `Ver los ${formatearNumero(documentos.length)} documentos`}
            </button>
          )}
          <p className={propios.nota}>Cada ciclo de ingesta vuelve a intentarlos. La lista muestra hasta 200, los más recientes primero.</p>
        </>
      )}
      {consulta.isError && consulta.data && (
        <p role="alert" className={estilos.vacio}>
          No pudimos actualizar la lista. <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      <Consultado cuando={consulta.dataUpdatedAt} ahora={ahora} />
    </section>
  )
}

/** Una línea que responde «¿hay algo roto?» antes de leer los bloques: colectores caídos y documentos fallando. */
function ResumenDeSalud() {
  const salud = useSaludColectores()
  const fallidos = useFallidos()
  const partes: string[] = []
  if (salud.data) {
    const caidos = salud.data.filter((colector) => saludDe(colector) === 'caido').length
    if (salud.data.length === 0) partes.push('Sin ciclos de ingesta todavía')
    else partes.push(caidos === 0 ? 'Ningún colector caído' : caidos === 1 ? '1 colector caído' : `${caidos} colectores caídos`)
  }
  if (fallidos.data) {
    partes.push(fallidos.data.length === 0 ? 'ningún documento fallando' : `${formatearNumero(fallidos.data.length)} ${fallidos.data.length === 1 ? 'documento fallando' : 'documentos fallando'}`)
  }
  if (partes.length === 0) return null
  const texto = partes.join(' · ')
  return <p className={propios.resumen}>{texto.charAt(0).toUpperCase() + texto.slice(1)}</p>
}

/** FE4 · `/panel/ingesta`: lo que detectó la ingesta automática. Verlo exige `VER_PANEL`; decidir, `REVISAR_INGESTA`. */
export function Ingesta() {
  usePaletaGrafito()
  const puedeRevisar = usePermisos().has('REVISAR_INGESTA')
  const ahora = useAhora()
  const cola = usePropuestas()
  const barrios = useBarriosPanel()
  const cliente = useQueryClient()
  const [resueltas, setResueltas] = useState<PropuestaIngesta[]>([])
  const [reciente, setReciente] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const sectores = new Map((barrios.data ?? []).map((sector) => [sector.id ?? '', sector]))
  const idsResueltas = new Set(resueltas.map((propuesta) => propuesta.id))
  const delServidor = cola.data?.pages.flatMap((carga) => carga.propuestas) ?? []
  const pendientes = delServidor.filter((propuesta) => !idsResueltas.has(propuesta.id))
  const total = cola.data?.pages[0]?.paginacion.total ?? null
  // Mientras se vuelve a pedir la cola, las que ya se resolvieron aquí aún pueden venir en el total del servidor.
  const cantidad = total === null ? pendientes.length : Math.max(0, total - (delServidor.length - pendientes.length))

  function alResolver(propuesta: PropuestaIngesta | null, mensaje: string | null) {
    setAviso(mensaje)
    if (propuesta) {
      setResueltas((actuales) => [propuesta, ...actuales.filter((otra) => otra.id !== propuesta.id)])
      setReciente(propuesta.id ?? null)
    }
    // Aprobar no implica que el estado cambie: se vuelve a pedir lo que el servidor sabe, también los barrios.
    void cliente.invalidateQueries({ queryKey: ['panel', 'ingesta', 'propuestas'] })
    void cliente.invalidateQueries({ queryKey: ['panel', 'barrios'] })
  }

  function nombreDe(propuesta: PropuestaIngesta) {
    return nombreLegible(sectores.get(propuesta.sectorId ?? '')?.nombre ?? propuesta.sectorId)
  }

  const fila = (propuesta: PropuestaIngesta) => (
    <FilaPropuesta
      key={propuesta.id}
      propuesta={propuesta}
      barrio={nombreDe(propuesta)}
      estadoActual={sectores.get(propuesta.sectorId ?? '')?.estado}
      actualizando={barrios.isFetching}
      ahora={ahora}
      puedeRevisar={puedeRevisar}
      enfocar={reciente !== null && reciente === propuesta.id}
      alResolver={alResolver}
    />
  )

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Ingesta · lo que detectaron los colectores</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>
          {titularDe(cola.isPending, cola.isError && !cola.data, cantidad, cola.hasNextPage && total === null)}
        </h1>
        <ResumenDeSalud />
      </header>
      {!puedeRevisar && (
        <p className={estilos.aviso}>Tu cuenta puede ver la ingesta, pero no decidir sobre las propuestas: faltan permisos de revisión.</p>
      )}
      {aviso && <p className={estilos.aviso} role="alert">{aviso}</p>}
      <div className={`${estilos.columnas} ${propios.dosColumnas}`} data-ancho="ancho">
        <section className={`${bloques.bloque} ${bloques.compacto}`} aria-label="Propuestas de la ingesta">
          {cola.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /><span /></div>}
          {cola.isError && !cola.data && (
            <p role="alert" className={estilos.vacio}>
              No pudimos consultar las propuestas. Revisa tu conexión e inténtalo otra vez.{' '}
              <button type="button" className={estilos.reintentar} onClick={() => void cola.refetch()}>Reintentar</button>
            </p>
          )}
          {resueltas.length > 0 && (
            <div className={propios.resueltas}>
              <h2 className={propios.tituloResueltas}>Resueltas en esta visita</h2>
              <ul className={estilos.lista}>{resueltas.map(fila)}</ul>
            </div>
          )}
          {cola.data && pendientes.length === 0 && (
            <div className={estilos.vacioBloque}>
              <p className={bloques.titulo}>No hay propuestas pendientes</p>
              <p className={bloques.bajada}>Cuando un colector detecte algo que no puede publicarse solo, aparecerá aquí con la frase del boletín que lo respalda.</p>
            </div>
          )}
          {pendientes.length > 0 && <ul className={estilos.lista}>{pendientes.map(fila)}</ul>}
          {cola.isError && cola.data && (
            <p role="alert" className={estilos.vacio}>
              No pudimos actualizar las propuestas. <button type="button" className={estilos.reintentar} onClick={() => void cola.refetch()}>Reintentar</button>
            </p>
          )}
          {cola.hasNextPage && (
            <button type="button" className={estilos.mas} disabled={cola.isFetchingNextPage} onClick={() => void cola.fetchNextPage()}>
              {cola.isFetchingNextPage ? 'Consultando…' : 'Cargar más propuestas'}
            </button>
          )}
          {cola.data && pendientes.length > 0 && (
            <p className={propios.nota}>La confianza ordena la lista; no publica nada. Solo aprobar publica, y solo con la frase del boletín a la vista.</p>
          )}
        </section>
        <aside className={`${estilos.lateral} ${propios.lateral}`} aria-label="Salud de la ingesta">
          <BloqueSalud ahora={ahora} />
          <BloqueFallidos ahora={ahora} />
        </aside>
      </div>
    </div>
  )
}
