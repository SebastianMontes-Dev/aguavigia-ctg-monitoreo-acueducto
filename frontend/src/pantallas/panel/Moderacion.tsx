import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Button } from 'react-aria-components'
import { moderarReporte, type PaginaPendientes } from '../../api/moderacion'
import { useAhora } from '../../app/ahora'
import { useAccion, useBarriosPanel, useFotoPanel, usePendientes } from '../../app/datos-panel'
import { usePermisos } from '../../app/panel'
import { usePaletaGrafito } from '../../app/paleta'
import { Icono } from '../../componentes/Icono'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { mensajeAccion } from '../../dominio/mensajes-panel'
import { confirmacionDe, fotoDe, SENAL_DE_RED, tipoEnPalabras, verificacionEnPalabras, type AccionModeracion, type FotoDeReporte, type ReporteModeracion } from '../../dominio/moderacion'
import { nombreLegible } from '../../dominio/sectores'
import { formatearNumero } from '../../dominio/formato'
import { claveDiaCartagena, fechaCorta, formatearHora, haceCuanto } from '../../dominio/tiempo'
import pagina from '../publico/Pagina.module.css'
import estilos from './Gestion.module.css'

function FotoVisible({ nombre, publica, barrio }: { nombre: string; publica: boolean; barrio: string }) {
  const consulta = useFotoPanel(nombre)
  const url = consulta.data
  const [grande, setGrande] = useState(false)
  if (consulta.isError) {
    return (
      <div className={estilos.sinFoto}>
        <span>No pudimos cargar la foto</span>
        <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
      </div>
    )
  }
  if (!url) return <output className={estilos.sinFoto}>Cargando foto…</output>
  return (
    <>
      <button type="button" className={estilos.miniatura} aria-expanded={grande} aria-label={grande ? 'Reducir la foto' : 'Ampliar la foto'} onClick={() => setGrande(!grande)}>
        <img src={url} alt={`Foto del reporte en ${barrio}`} />
      </button>
      <p className={estilos.pieFoto}>{publica ? 'Foto pública' : 'Foto en revisión'}</p>
    </>
  )
}

function Foto({ foto, barrio }: { foto: FotoDeReporte; barrio: string }) {
  if (foto.tipo === 'sin-foto') return null
  return (
    <div className={estilos.foto}>
      {foto.tipo === 'visible' && <FotoVisible nombre={foto.nombre} publica={foto.publica} barrio={barrio} />}
      {foto.tipo === 'descartada' && <p className={estilos.sinFoto}>Foto descartada</p>}
      {foto.tipo === 'no-disponible' && <p className={estilos.sinFoto}>Foto no disponible</p>}
    </div>
  )
}

const ETIQUETAS: Record<AccionModeracion, string> = { aprobar: 'Aprobar', descartar: 'Descartar', foto: 'Descartar solo la foto' }

function FilaReporte({ reporte, barrio, ahora, puedeModerar, alDecidir }: {
  reporte: ReporteModeracion
  barrio: string
  ahora: Date
  puedeModerar: boolean
  alDecidir: (id: string, accion: AccionModeracion, aviso?: string | null) => void
}) {
  const [confirmando, setConfirmando] = useState<AccionModeracion | null>(null)
  const [mensaje, setMensaje] = useState<{ texto: string; exito: boolean } | null>(null)
  const { enviando, ejecutar } = useAccion()
  const clientePaginas = useQueryClient()
  const caja = useRef<HTMLFieldSetElement>(null)
  const acciones = useRef<HTMLDivElement>(null)
  const foto = fotoDe(reporte)
  const tieneFoto = foto.tipo === 'visible'
  const id = reporte.id ?? ''

  useEffect(() => {
    if (confirmando) caja.current?.focus()
  }, [confirmando])

  function cancelar() {
    const anterior = confirmando
    setConfirmando(null)
    // El foco vuelve al botón que abrió la confirmación, no se pierde en el cuerpo de la página.
    queueMicrotask(() => {
      const controles = acciones.current?.querySelectorAll('button')
      const indice = anterior ? ['aprobar', 'descartar', 'foto'].indexOf(anterior) : 0
      controles?.[Math.max(0, indice)]?.focus()
    })
  }

  async function confirmar() {
    if (!confirmando) return
    const accion = confirmando
    const resultado = await ejecutar(() => moderarReporte(id, accion))
    if (!resultado) return
    if (resultado.tipo === 'hecho' || resultado.tipo === 'no-existe' || resultado.tipo === 'conflicto') {
      // El reporte ya no es de la cola (o, con la foto, su foto cambió): se refresca lo que el servidor sabe.
      // La fila de un reporte que ya no está en la cola se va con él: lo que hay que decirle a la persona va a la página.
      const texto = resultado.tipo === 'hecho'
        ? (accion === 'foto' ? 'Foto descartada. El reporte sigue en la cola.' : null)
        : mensajeAccion(resultado, accion)
      const sigueEnLaCola = accion === 'foto' && resultado.tipo === 'hecho'
      if (sigueEnLaCola) setMensaje(texto ? { texto, exito: true } : null)
      setConfirmando(null)
      alDecidir(id, accion, sigueEnLaCola ? null : texto)
      return
    }
    if (resultado.tipo === 'sin-permiso') void clientePaginas.invalidateQueries({ queryKey: ['panel', 'yo'] })
    const texto = mensajeAccion(resultado, accion)
    setMensaje(texto ? { texto, exito: false } : null)
    setConfirmando(null)
  }

  const textos = confirmando ? confirmacionDe(confirmando, tieneFoto) : null
  const hora = reporte.timestamp
  return (
    <li className={estilos.reporte} data-sin-foto={foto.tipo === 'sin-foto' ? true : undefined}>
      <span className={estilos.glifo}><Icono nombre="megafono" tamano={16} /></span>
      <div className={estilos.cuerpo}>
        <p className={estilos.que}><strong>{barrio}</strong> · {tipoEnPalabras(reporte.tipo)}</p>
        <p className={estilos.meta}>{verificacionEnPalabras(reporte.verificacion)}</p>
        {reporte.senalRed === true && <p className={estilos.senal}><Icono nombre="personas" tamano={16} />{SENAL_DE_RED}</p>}
      </div>
      {hora ? (
        <time className={estilos.hora} dateTime={hora}>
          {formatearHora(hora)}
          <span>{claveDiaCartagena(hora) === claveDiaCartagena(ahora) ? '' : `${fechaCorta(hora, ahora)} · `}{haceCuanto(hora, ahora)}</span>
        </time>
      ) : <span className={estilos.hora}>Sin hora</span>}
      <Foto foto={foto} barrio={barrio} />
      {puedeModerar && (
        <div className={estilos.acciones} ref={acciones}>
          {(['aprobar', 'descartar', ...(tieneFoto ? ['foto' as const] : [])] as AccionModeracion[]).map((accion) => (
            <Button
              key={accion}
              className={`${botones.secundario} ${estilos.accion}`}
              isDisabled={enviando || confirmando !== null}
              onPress={() => {
                setMensaje(null)
                setConfirmando(accion)
              }}
            >
              {ETIQUETAS[accion]}
            </Button>
          ))}
        </div>
      )}
      {confirmando && textos && (
        <fieldset className={estilos.confirmar} tabIndex={-1} ref={caja}>
          <legend className={estilos.oculto}>Confirmar: {ETIQUETAS[confirmando]}</legend>
          <p>{textos.pregunta}</p>
          <div className={estilos.acciones}>
            <Button className={botones.principal} isDisabled={enviando} onPress={() => void confirmar()}>
              {enviando ? textos.enviando : textos.boton}
            </Button>
            <Button className={botones.secundario} isDisabled={enviando} onPress={cancelar}>Cancelar</Button>
          </div>
        </fieldset>
      )}
      {mensaje && (mensaje.exito
        ? <output className={estilos.resultado}>{mensaje.texto}</output>
        : <p className={estilos.resultado} role="alert">{mensaje.texto}</p>)}
    </li>
  )
}

type Datos = InfiniteData<PaginaPendientes, number>

/** Quita de la cola, sin esperar otra petición, el reporte que ya no es pendiente. */
function sinReporte(datos: Datos | undefined, id: string): Datos | undefined {
  if (!datos) return datos
  return { ...datos, pages: datos.pages.map((carga) => ({ ...carga, reportes: carga.reportes.filter((reporte) => reporte.id !== id) })) }
}

function titularDe(cargando: boolean, fallo: boolean, cantidad: number, hayMas: boolean): string {
  if (cargando) return 'Consultando la cola de reportes…'
  if (fallo) return 'No pudimos consultar la cola'
  if (cantidad === 0) return 'No hay reportes por revisar'
  const texto = `${formatearNumero(cantidad)}${hayMas ? ' o más' : ''}`
  return cantidad === 1 && !hayMas ? '1 reporte por revisar' : `${texto} reportes por revisar`
}

/** FE3 · `/panel`: la cola de moderación, los más antiguos primero. Decidir exige `MODERAR_REPORTES`; verla, solo `VER_PANEL`. */
export function Moderacion() {
  usePaletaGrafito()
  const permisos = usePermisos()
  const puedeModerar = permisos.has('MODERAR_REPORTES')
  const ahora = useAhora()
  const cola = usePendientes()
  const barrios = useBarriosPanel()
  const cliente = useQueryClient()
  const [aviso, setAviso] = useState<string | null>(null)
  const nombres = new Map((barrios.data ?? []).map((sector) => [sector.id ?? '', sector.nombre]))
  const reportes = cola.data?.pages.flatMap((carga) => carga.reportes) ?? []
  const total = cola.data?.pages[0]?.paginacion.total ?? null
  const cantidad = total ?? reportes.length
  const conFoto = reportes.filter((reporte) => fotoDe(reporte).tipo === 'visible').length
  const conSenal = reportes.filter((reporte) => reporte.senalRed === true).length

  function alDecidir(id: string, accion: AccionModeracion, mensaje?: string | null) {
    setAviso(mensaje ?? null)
    // Descartar solo la foto deja al reporte en la cola, con la foto retirada: se vuelve a pedir en vez de quitarlo.
    if (accion !== 'foto') cliente.setQueryData<Datos>(['panel', 'pendientes'], (datos) => sinReporte(datos, id))
    void cliente.invalidateQueries({ queryKey: ['panel', 'pendientes'] })
  }

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Moderación · los más antiguos primero</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>
          {titularDe(cola.isPending, cola.isError && !cola.data, cantidad, cola.hasNextPage && total === null)}
        </h1>
      </header>
      {!puedeModerar && (
        <p className={estilos.aviso}>Tu cuenta puede ver la cola, pero no decidir sobre los reportes: faltan permisos de moderación.</p>
      )}
      {aviso && <p className={estilos.aviso} role="alert">{aviso}</p>}
      <div className={estilos.columnas}>
        <section className={`${bloques.bloque} ${bloques.compacto}`} aria-label="Reportes pendientes">
          {cola.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /><span /></div>}
          {cola.isError && !cola.data && (
            <p role="alert" className={estilos.vacio}>
              No pudimos consultar la cola. Revisa tu conexión e inténtalo otra vez.{' '}
              <button type="button" className={estilos.reintentar} onClick={() => void cola.refetch()}>Reintentar</button>
            </p>
          )}
          {cola.data && reportes.length === 0 && (
            <div className={estilos.vacioBloque}>
              <p className={bloques.titulo}>No hay reportes pendientes</p>
              <p className={bloques.bajada}>Cuando un vecino reporte, aparecerá aquí, el más antiguo primero.</p>
            </div>
          )}
          {reportes.length > 0 && (
            <ul className={estilos.lista}>
              {reportes.map((reporte) => (
                <FilaReporte
                  key={reporte.id}
                  reporte={reporte}
                  barrio={nombreLegible(nombres.get(reporte.sectorId ?? '') ?? reporte.sectorId)}
                  ahora={ahora}
                  puedeModerar={puedeModerar}
                  alDecidir={alDecidir}
                />
              ))}
            </ul>
          )}
          {cola.isError && cola.data && (
            <p role="alert" className={estilos.vacio}>
              No pudimos actualizar la cola. <button type="button" className={estilos.reintentar} onClick={() => void cola.refetch()}>Reintentar</button>
            </p>
          )}
          {cola.hasNextPage && (
            <button type="button" className={estilos.mas} disabled={cola.isFetchingNextPage} onClick={() => void cola.fetchNextPage()}>
              {cola.isFetchingNextPage ? 'Consultando…' : 'Cargar más reportes'}
            </button>
          )}
        </section>
        <aside className={estilos.lateral} data-solo-ancho aria-label="Cómo leer la cola">
          <section className={bloques.bloque} aria-labelledby="titulo-cola">
            <h2 id="titulo-cola" className={estilos.tituloLateral}>En la cola</h2>
            <dl className={`${bloques.cifras} ${estilos.tresCifras}`}>
              <div><dt>Cargados</dt><dd>{formatearNumero(reportes.length)}</dd></div>
              <div><dt>Con foto</dt><dd>{formatearNumero(conFoto)}</dd></div>
              <div><dt>Señal de red</dt><dd>{formatearNumero(conSenal)}</dd></div>
            </dl>
          </section>
          <section className={bloques.bloque} aria-labelledby="titulo-lectura">
            <h2 id="titulo-lectura" className={estilos.tituloLateral}>Cómo leerlo</h2>
            <p className={bloques.bajada}><strong>Verificación:</strong> la decide el servidor; dice cuánto respalda que quien reportó está en el barrio.</p>
            <p className={bloques.bajada}><strong>Señal de red:</strong> una sala o una antena móvil comparten red. Es dónde mirar primero, no una acusación ni un bloqueo.</p>
            <p className={bloques.bajada}><strong>Foto:</strong> solo el panel la ve hasta que apruebes el reporte.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
