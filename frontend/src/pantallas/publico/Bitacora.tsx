import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { components } from '../../api/generado/esquema'
import { useBitacora, useConteosBitacora, useListado, useSustento, useTotalBitacora, useUltimoBoletin } from '../../app/datos'
import { useAhora } from '../../app/ahora'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import { Icono } from '../../componentes/Icono'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import type { EstadoServicio } from '../../dominio/estados'
import {
  descripcionAporta,
  descripcionLegible,
  enlaceExterno,
  esTipoEvento,
  FILTRO_TIPO,
  imagenDeBitacora,
  limiteDiaCartagena,
  procedenciaEnPalabras,
  quePasoEnPalabras,
  rangoDiasValido,
  TIPOS_BITACORA,
  type TipoBitacora,
} from '../../dominio/historia'
import { fuenteEnPalabras } from '../../dominio/cortes'
import { formatearNumero } from '../../dominio/formato'
import { nombreLegible } from '../../dominio/sectores'
import { claveDiaCartagena, diaConFecha, etiquetaDia, formatearHora, haceCuanto } from '../../dominio/tiempo'
import bloques from '../../componentes/Bloques.module.css'
import estilosPagina from './Pagina.module.css'
import estilos from './Bitacora.module.css'

type Evento = components['schemas']['EventoBitacoraRespuesta']

function estadoValido(valor?: string | null): EstadoServicio | null {
  return valor === 'CON_SERVICIO' || valor === 'SIN_SERVICIO' || valor === 'PRESION_BAJA' || valor === 'CORTE_PROGRAMADO'
    ? valor : null
}

function Sustento({ id, cantidad }: { id: string; cantidad: number }) {
  const [abierto, setAbierto] = useState(false)
  const consulta = useSustento(id, abierto)
  return (
    <>
      <button type="button" className={estilos.enlace} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}
        aria-label={`Ver sustento: ${formatearNumero(cantidad)} ${cantidad === 1 ? 'reporte' : 'reportes'}`}>
        Ver sustento
      </button>
      {abierto && (
        <div className={estilos.referencias}>
          <p>Referencias de trazabilidad; el contenido de los reportes no es público.</p>
          {consulta.isPending && <output>Consultando referencias…</output>}
          {consulta.isError && <p role="alert">No pudimos consultar las referencias. <button type="button" className={estilos.enlace} onClick={() => void consulta.refetch()}>Reintentar</button></p>}
          {consulta.data && (
            <>
              <ul>{consulta.data.pages.flatMap((pagina) => pagina.ids).map((referencia) => <li key={referencia}><code>{referencia}</code></li>)}</ul>
              {consulta.hasNextPage && (
                <button type="button" className={estilos.enlace} disabled={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>
                  {consulta.isFetchingNextPage ? 'Consultando…' : 'Cargar más referencias'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function Portada({ url }: { url: string }) {
  const [fallo, setFallo] = useState(false)
  if (fallo) return null
  return <img src={url} alt="Portada del boletín" loading="lazy" onError={() => setFallo(true)} className={estilos.portada} />
}

/**
 * ADR-104: cada evento es una tarjeta de dos líneas. Arriba, el barrio y lo que pasó en palabras del vecino; abajo, quién lo
 * sostiene. La descripción solo si dice algo que el tipo y el respaldo no dicen ya; lo que no existe no se nombra.
 */
function EventoBitacora({ evento, nombreDe, originalDe }: {
  evento: Evento
  nombreDe: (id: string) => string | undefined
  originalDe: (id: string) => string | undefined
}) {
  const estado = estadoValido(evento.estado)
  const imagen = imagenDeBitacora(evento.imagenUrl)
  const fuenteOriginal = enlaceExterno(evento.urlOriginal)
  const tipo = esTipoEvento(evento.tipo) ? evento.tipo : null
  const barrio = evento.sectorId ? nombreDe(evento.sectorId) ?? evento.sectorId : null
  const original = evento.sectorId ? originalDe(evento.sectorId) : undefined
  const sustento = evento.cantidadReportesSustento ?? 0
  const procedencia = procedenciaEnPalabras(tipo, evento.respaldo, fuenteEnPalabras(evento.fuente))
  const descripcion = evento.descripcion && descripcionAporta(tipo)
    ? descripcionLegible(evento.descripcion, nombreDe, original && barrio ? { original, legible: barrio } : undefined)
    : null
  return (
    <li className={estilos.evento} data-estado={estado ?? undefined}>
      <span className={estilos.glifo}>
        {estado ? <GlifoEstado estado={estado} tamano={20} /> : <Icono nombre="documento" tamano={18} />}
      </span>
      <p className={estilos.queP}>
        {barrio && <><strong>{barrio}</strong> · </>}
        {quePasoEnPalabras(tipo, evento.estado)}
      </p>
      <time className={estilos.hora} dateTime={evento.timestamp}>{evento.timestamp ? formatearHora(evento.timestamp) : 'Sin hora'}</time>
      <div className={estilos.detalle}>
        {descripcion && <p className={estilos.descripcion}>{descripcion}</p>}
        {(procedencia || fuenteOriginal || (sustento > 0 && evento.id)) && (
          <div className={estilos.pie}>
            {procedencia && (
              <p className={estilos.procedencia}>
                {evento.respaldo?.vecinos != null && <Icono nombre="personas" tamano={16} />}
                {procedencia}
              </p>
            )}
            {(fuenteOriginal || (sustento > 0 && evento.id)) && (
              <p className={estilos.acciones}>
            {fuenteOriginal && (
              <a href={fuenteOriginal} target="_blank" rel="noopener noreferrer" className={estilos.enlace}>
                {tipo === 'CORTE_DETECTADO_POR_INGESTA' ? 'Boletín de Acuacar' : 'Ver fuente original'}
              </a>
            )}
                {sustento > 0 && evento.id && <Sustento id={evento.id} cantidad={sustento} />}
              </p>
            )}
          </div>
        )}
        {imagen && <Portada url={imagen} />}
      </div>
    </li>
  )
}

function agruparPorDia(eventos: readonly Evento[], ahora: Date) {
  const grupos: { clave: string; etiqueta: string; eventos: Evento[] }[] = []
  for (const evento of eventos) {
    const clave = evento.timestamp ? claveDiaCartagena(evento.timestamp) : 'sin-fecha'
    const ultimo = grupos.at(-1)
    if (ultimo?.clave === clave) ultimo.eventos.push(evento)
    else grupos.push({ clave, etiqueta: evento.timestamp ? etiquetaDia(evento.timestamp, ahora) : 'Sin fecha de registro', eventos: [evento] })
  }
  return grupos
}

/** A la derecha en escritorio: el último boletín (o nota) que llegó, con su fuente, y la invitación a recibir avisos. */
function Lateral({ sector, nombreDe, ahora }: { sector?: string; nombreDe: (id: string) => string | undefined; ahora: Date }) {
  const boletin = useUltimoBoletin(sector).data
  const fuente = enlaceExterno(boletin?.urlOriginal)
  return (
    <aside className={estilos.lateral} aria-label="Fuentes y avisos">
      {boletin && (
        <section className={bloques.bloque} aria-labelledby="titulo-boletin">
          <h2 id="titulo-boletin" className={`${estilos.tituloLateral} ${bloques.conIcono}`}>
            <Icono nombre="documento" tamano={18} />
            {boletin.fuente === 'PRENSA' ? 'Última nota de prensa' : 'Último boletín de Acuacar'}
          </h2>
          {boletin.timestamp && (
            <p className={bloques.bajada}>
              <time dateTime={boletin.timestamp}>{diaConFecha(boletin.timestamp, ahora, { pasado: true })} · {formatearHora(boletin.timestamp)}</time>
            </p>
          )}
          {boletin.descripcion && <p className={estilos.textoBoletin}>{descripcionLegible(boletin.descripcion, nombreDe)}</p>}
          {fuente && <a href={fuente} target="_blank" rel="noopener noreferrer" className={estilos.enlaceFuerte}>Abrir el boletín ↗</a>}
        </section>
      )}
      <section className={`${bloques.bloque} ${bloques.tenido}`} aria-labelledby="titulo-avisos">
        <h2 id="titulo-avisos" className={estilos.tituloLateral}>¿Quieres saberlo sin entrar?</h2>
        <p className={bloques.bajada}>Te escribimos cuando cambie el agua en tus barrios.</p>
        <Link to="/avisos" search={sector ? { sector } : {}} className={estilos.botonAvisos}>
          <Icono nombre="campana" tamano={18} />Recibir avisos <span aria-hidden="true">→</span>
        </Link>
      </section>
    </aside>
  )
}

/** RF011, RF026–RF028 · `ADR-079` y `ADR-104`: el titular dice cuándo fue el último cambio; los filtros, en una barra. */
export function Bitacora() {
  const buscar = useSearch({ from: '/publico/bitacora' })
  const navegar = useNavigate()
  const { sectores, lectura, reintentar: reintentarListado } = useListado()
  const ahora = useAhora()
  const fechasActivas = Boolean(buscar.desde || buscar.hasta)
  const [panel, setPanel] = useState<'barrio' | 'fechas' | null>(null)
  const valido = rangoDiasValido(buscar.desde, buscar.hasta)
  const rango = {
    sector: buscar.sector,
    desde: buscar.desde ? limiteDiaCartagena(buscar.desde) ?? undefined : undefined,
    hasta: buscar.hasta ? limiteDiaCartagena(buscar.hasta, true) ?? undefined : undefined,
  }
  const consulta = useBitacora({ ...rango, tipo: buscar.tipo })
  const conteos = useConteosBitacora(rango, TIPOS_BITACORA)
  const eventos = consulta.data?.pages.flatMap((pagina) => pagina.eventos) ?? []
  const total = consulta.data?.pages[0]?.paginacion.total ?? null
  const error = consulta.error as { estado?: number } | null
  const actualizar = (cambio: Partial<typeof buscar>) => void navegar({ to: '/bitacora', search: { ...buscar, ...cambio }, replace: true })
  const nombres = new Map(sectores.map((sector) => [sector.id, nombreLegible(sector.nombre)]))
  const originales = new Map(sectores.map((sector) => [sector.id, sector.nombre]))
  const nombreDe = (id: string) => nombres.get(id)
  const originalDe = (id: string) => originales.get(id)
  const barrioFiltrado = buscar.sector ? nombreDe(buscar.sector) ?? buscar.sector : null
  const conteoTotal = useTotalBitacora(rango).data ?? null

  const ultimo = eventos[0]
  const barrioUltimo = ultimo?.sectorId ? nombreDe(ultimo.sectorId) ?? null : null
  const titular = ultimo?.timestamp
    ? `El último cambio fue ${haceCuanto(ultimo.timestamp, ahora)}${barrioUltimo && !barrioFiltrado ? `, en ${barrioUltimo}` : ''}`
    : 'Cada cambio del agua, con su fuente'

  const pestana = (tipo: TipoBitacora | undefined, texto: string, cantidad: number | null) => (
    <button
      key={tipo ?? 'todos'}
      type="button"
      className={estilos.pestana}
      aria-pressed={buscar.tipo === tipo}
      onClick={() => actualizar({ tipo })}
    >
      {texto}{cantidad !== null && <>{' '}<span className={estilos.cantidad}>{formatearNumero(cantidad)}</span></>}
    </button>
  )

  const alternar = (cual: 'barrio' | 'fechas') => setPanel(panel === cual ? null : cual)

  return (
    <div className={`${estilosPagina.pagina} ${estilos.pagina}`}>
      <header className={estilos.cabecera}>
        <p className={bloques.rotulo}>
          Bitácora{barrioFiltrado && <> · {barrioFiltrado}</>}{total !== null && <> · {formatearNumero(total)} {total === 1 ? 'evento' : 'eventos'}</>}
        </p>
        <h1 className={`${estilosPagina.titular} ${estilos.titular}`}>{titular}</h1>
      </header>

      <section className={estilos.filtros} aria-label="Filtros de la bitácora">
        <div className={estilos.barra}>
          <fieldset className={estilos.pestanas}>
            <legend className={estilos.oculto}>Tipo de evento</legend>
            {pestana(undefined, 'Todos', conteoTotal)}
            {TIPOS_BITACORA.map((tipo) => pestana(tipo, FILTRO_TIPO[tipo], conteos[tipo]))}
          </fieldset>
          <div className={estilos.botonesFiltro}>
            <button type="button" className={estilos.botonFiltro} aria-expanded={panel === 'barrio'} aria-controls="panel-filtros"
              data-activo={buscar.sector ? true : undefined} onClick={() => alternar('barrio')}>
              <Icono nombre="buscar" tamano={18} />{barrioFiltrado ?? 'Barrio'}
            </button>
            <button type="button" className={estilos.botonFiltro} aria-expanded={panel === 'fechas'} aria-controls="panel-filtros"
              data-activo={fechasActivas || undefined} onClick={() => alternar('fechas')}>
              <Icono nombre="calendario" tamano={18} />{fechasActivas ? 'Fechas · activas' : 'Fechas'}
            </button>
          </div>
        </div>
        {panel && (
          <div id="panel-filtros" className={estilos.panel}>
            {panel === 'barrio' ? (
              <SelectorBarrio sectores={sectores} valor={buscar.sector} alCambiar={(sector) => actualizar({ sector })} />
            ) : (
              <div className={estilos.campos}>
                <label className={estilos.campo}>Desde (día de Cartagena)
                  <input type="date" value={buscar.desde ?? ''} onChange={(e) => actualizar({ desde: e.target.value || undefined })} />
                </label>
                <label className={estilos.campo}>Hasta (inclusive, día de Cartagena)
                  <input type="date" value={buscar.hasta ?? ''} onChange={(e) => actualizar({ hasta: e.target.value || undefined })} />
                </label>
              </div>
            )}
          </div>
        )}
        {(!valido || error?.estado === 400) && (
          <p role="alert" className={estilos.errorFiltro}>Revisa las fechas: la final debe ser igual o posterior a la inicial.</p>
        )}
        {lectura.error && !sectores.length && (
          <p role="alert" className={estilos.errorFiltro}>No pudimos cargar los barrios. <button type="button" className={estilos.enlace} onClick={reintentarListado}>Reintentar</button></p>
        )}
      </section>

      <div className={estilos.columnas}>
        <section aria-label="Eventos de la bitácora" className={estilos.resultados}>
          {consulta.isPending && <output className={estilos.esqueleto}>Consultando la bitácora…<span /><span /><span /></output>}
          {consulta.isError && error?.estado !== 400 && (
            <p role="alert">No pudimos consultar la bitácora. Revisa tu conexión e inténtalo otra vez. <button type="button" className={estilos.enlace} onClick={() => void consulta.refetch()}>Reintentar</button></p>
          )}
          {consulta.data && eventos.length === 0 && <p className={`${bloques.bloque} ${estilos.vacio}`}>No hay eventos con esos filtros</p>}
          {agruparPorDia(eventos, ahora).map((grupo) => (
            <section key={grupo.clave} className={estilos.dia} aria-label={grupo.etiqueta}>
              <h2 className={estilos.etiquetaDia}>{grupo.etiqueta}</h2>
              <ol className={estilos.lista}>
                {grupo.eventos.map((evento, indice) => <EventoBitacora key={evento.id ?? `${grupo.clave}-${indice}`} evento={evento} nombreDe={nombreDe} originalDe={originalDe} />)}
              </ol>
            </section>
          ))}
          {consulta.hasNextPage && (
            <button type="button" className={estilos.mas} disabled={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>
              {consulta.isFetchingNextPage ? 'Consultando…' : 'Cargar más eventos'}
            </button>
          )}
        </section>
        <Lateral sector={buscar.sector} nombreDe={nombreDe} ahora={ahora} />
      </div>
    </div>
  )
}
