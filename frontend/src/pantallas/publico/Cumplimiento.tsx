import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCalidadCumplimiento, useIndiceCumplimiento, useListado, useSerieCumplimiento } from '../../app/datos'
import { Icono } from '../../componentes/Icono'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import {
  conclusionCumplimiento,
  diferenciaEnPalabras,
  diferenciaMensualPorCorte,
  duracionCorta,
  ESCALA_LINEA_SEGUNDOS,
  faltanteEnPalabras,
  indiceCompleto,
  mesEnPalabras,
  ordenarSerie,
  periodoEnPalabras,
  posicionEnLinea,
  respuestaEnPalabras,
  resumirCumplimiento,
  significadoIndice,
  solidezIndice,
  titularVeredicto,
  type Indice,
  type PuntoSerie,
  type ResumenCumplimiento,
} from '../../dominio/cumplimiento'
import { formatearNumero, formatearPorcentaje } from '../../dominio/formato'
import { conclusionPendiente, muestraSuficiente } from '../../dominio/muestra'
import { nombreLegible } from '../../dominio/sectores'
import bloques from '../../componentes/Bloques.module.css'
import estilosPagina from './Pagina.module.css'
import estilos from './Cumplimiento.module.css'

const MESES_VISIBLES = 6

/**
 * ADR-104: la hora anunciada es la marca del centro y el punto, cuándo volvió el agua (izquierda = antes, derecha = tarde).
 * Lo dice la frase de al lado; la línea es decorativa para el lector de pantalla.
 */
function LineaTiempo({ segundos, grande = false }: { segundos: number; grande?: boolean }) {
  const posicion = posicionEnLinea(segundos)
  const tramo = Math.abs(posicion - 50)
  return (
    <span className={estilos.pista} data-grande={grande || undefined} aria-hidden="true">
      {tramo > 0 && (
        <span
          className={estilos.tramo}
          data-sentido={segundos > 0 ? 'tarde' : 'antes'}
          style={{ left: `${Math.min(posicion, 50)}%`, width: `${tramo}%` }}
        />
      )}
      <span className={estilos.centro} />
      <span className={estilos.punto} style={{ left: `${posicion}%` }} />
    </span>
  )
}

/** F4: la solidez va junto al número; si nada lo debilita, no se dice nada. */
function Solidez({ indice }: { indice: Indice }) {
  const frases = solidezIndice(indice)
  return frases.length ? <p className={estilos.pie}>{frases.join(' ')}</p> : null
}

/**
 * ADR-105: la cifra grande se queda; las duraciones pasan a cifras secundarias. Con menos de 5 cortes la frase dice que aún no hay
 * conclusión, y si la diferencia se sale de la escala de una hora, la leyenda lo dice en vez de dejar el punto como si fuera 1 hora.
 */
function Respuesta({ resumen, indice }: { resumen: ResumenCumplimiento; indice: Indice }) {
  const diferencia = resumen.diferenciaPorCorte
  const [cifra, sentido] = diferenciaEnPalabras(diferencia).split(/ (?=antes$|tarde$)/)
  const unico = resumen.cortes === 1
  const rotulo = unico ? 'En el único corte cerrado' : 'En promedio'
  const fueraDeEscala = Math.abs(diferencia) > ESCALA_LINEA_SEGUNDOS
  return (
    <section className={`${bloques.bloque} ${bloques.tenido} ${estilos.respuesta}`} aria-label={rotulo}>
      <div>
        <p className={bloques.rotulo}>{rotulo}</p>
        <p className={estilos.cifraGrande}>
          <span className="cifra">{cifra}</span>
          {sentido && <span className={estilos.sentido}>{sentido}</span>}
        </p>
        <p className={estilos.frase}>
          {muestraSuficiente(resumen.cortes) ? respuestaEnPalabras(diferencia) : conclusionPendiente(resumen.cortes, 'cerrado')}
        </p>
      </div>
      <div className={estilos.linea}>
        <p className={estilos.anunciada}>Hora anunciada</p>
        <LineaTiempo segundos={diferencia} grande />
        <p className={estilos.extremos}>
          <span>← 1 hora antes</span>
          <span className={estilos.leyendaPunto}><span className={estilos.muestraPunto} aria-hidden="true" />Volvió el agua</span>
          <span>1 hora tarde →</span>
        </p>
        {fueraDeEscala && <p className={estilos.fueraDeEscala}>Fuera de la escala: volvió más de 1 hora {diferencia > 0 ? 'tarde' : 'antes'}.</p>}
      </div>
      <dl className={`${bloques.cifras} ${estilos.cifras}`}>
        <div><dt>{unico ? 'Se anunció' : 'Se anuncia por corte'}</dt><dd>{duracionCorta(resumen.prometidoPorCorte)}</dd></div>
        <div><dt>{unico ? 'Duró' : 'Dura por corte'}</dt><dd>{duracionCorta(resumen.realPorCorte)}</dd></div>
      </dl>
      <p className={estilos.pie}>
        <strong>Índice {formatearPorcentaje(resumen.porcentaje)}</strong>: {significadoIndice(resumen.porcentaje)}.
      </p>
      <Solidez indice={indice} />
    </section>
  )
}

/** Sin la serie no hay conteo ni promedio por corte: se dice el total sin inventar lo demás. */
function RespuestaSinSerie({ indice }: { indice: Indice }) {
  if (!indiceCompleto(indice)) return <p role="alert">No pudimos leer la comparación de los cortes. Reintenta la consulta.</p>
  return (
    <section className={`${bloques.bloque} ${bloques.tenido} ${estilos.respuesta}`} aria-label="Total de los cortes cerrados">
      <p className={estilos.frase}>{conclusionCumplimiento(indice)}</p>
      <p className={estilos.pie}><strong>Índice {formatearPorcentaje(indice.porcentajeCumplimiento)}</strong>: {significadoIndice(indice.porcentajeCumplimiento)}.</p>
      <Solidez indice={indice} />
    </section>
  )
}

function MesAMes({ puntos }: { puntos: readonly PuntoSerie[] }) {
  const [verTodos, setVerTodos] = useState(false)
  const serie = ordenarSerie(puntos)
  const visibles = verTodos ? serie : serie.slice(-MESES_VISIBLES)

  return (
    <section className={bloques.bloque} aria-labelledby="titulo-serie">
      <header>
        <h2 id="titulo-serie" className={bloques.titulo}>Mes a mes</h2>
        <p className={bloques.bajada}>Cuándo volvió el agua frente a la hora anunciada</p>
      </header>
      <p className={`${estilos.mes} ${estilos.guia}`} aria-hidden="true">
        <span />
        <span className={estilos.guiaLinea}><span>← Antes</span><strong>Hora anunciada</strong><span>Tarde →</span></span>
        <span />
      </p>
      <ol className={estilos.meses}>
        {visibles.map((punto) => {
          const diferencia = diferenciaMensualPorCorte(punto)
          return (
            <li key={punto.periodo} className={estilos.mes}>
              <span className={estilos.nombreMes}>{mesEnPalabras(punto.periodo)}</span>
              {diferencia === null ? <span /> : <LineaTiempo segundos={diferencia} />}
              <span className={estilos.valor}>
                <strong>{diferencia === null ? 'Sin dato' : diferenciaEnPalabras(diferencia)}</strong>
                <span className={estilos.cantidad}>
                  {punto.cantidadCortes === undefined ? 'sin conteo' : `${formatearNumero(punto.cantidadCortes)} ${punto.cantidadCortes === 1 ? 'corte' : 'cortes'}`}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {serie.length > MESES_VISIBLES && !verTodos && (
        <button type="button" className={estilos.accion} onClick={() => setVerTodos(true)}>
          Ver los {formatearNumero(serie.length)} meses
        </button>
      )}
    </section>
  )
}

/** «Cómo se mide» y «Ver datos» detrás de una acción (ADR-079), en un bloque aparte de la respuesta. */
function Detalles({ puntos, csv }: { puntos: readonly PuntoSerie[] | undefined; csv: string }) {
  const serie = ordenarSerie(puntos ?? [])
  return (
    <section className={`${bloques.bloque} ${bloques.compacto}`} aria-label="Detalles del cálculo">
      <details>
        <summary className={bloques.fila}>Cómo se mide <span className={bloques.giro}><Icono nombre="avanzar" tamano={18} /></span></summary>
        <p className={estilos.explicacion}>
          Solo cuentan los cortes cerrados. Se suma lo que se anunció y lo que duró cada uno, y se divide entre la cantidad
          de cortes; el índice compara esas dos sumas y no pasa de 100 %.
        </p>
      </details>
      {serie.length > 0 && (
        <details>
          <summary className={bloques.fila}>
            <span className={bloques.conIcono}><Icono nombre="descargar" tamano={18} />Ver los datos y descargar el CSV</span>
            <span className={bloques.giro}><Icono nombre="avanzar" tamano={18} /></span>
          </summary>
          <div className={estilos.tablaContenedor}>
            <table>
              <caption>Datos de la serie mensual de cumplimiento</caption>
              <thead><tr><th scope="col">Mes</th><th scope="col">Cortes</th><th scope="col">Anunciado</th><th scope="col">Duró</th><th scope="col">Índice</th></tr></thead>
              <tbody>{serie.map((punto) => (
                <tr key={punto.periodo}>
                  <th scope="row">{mesEnPalabras(punto.periodo)}</th>
                  <td>{punto.cantidadCortes === undefined ? 'Sin dato' : formatearNumero(punto.cantidadCortes)}</td>
                  <td>{punto.duracionPrometidaSegundos === undefined ? 'Sin dato' : duracionCorta(punto.duracionPrometidaSegundos)}</td>
                  <td>{punto.duracionRealSegundos === undefined ? 'Sin dato' : duracionCorta(punto.duracionRealSegundos)}</td>
                  <td>{punto.porcentajeCumplimiento === undefined ? 'Sin dato' : formatearPorcentaje(punto.porcentajeCumplimiento)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <a href={csv} download className={estilos.csv}>Descargar en CSV</a>
        </details>
      )}
    </section>
  )
}

/** RF020–RF022, RF024 · `ADR-079` y `ADR-104`: el titular es el veredicto y la respuesta, una cifra sobre la línea de tiempo. */
export function Cumplimiento() {
  const buscar = useSearch({ from: '/publico/cumplimiento' })
  const navegar = useNavigate()
  const { sectores, lectura, reintentar: reintentarListado } = useListado()
  const sector = sectores.find((candidato) => candidato.id === buscar.sector)
  const barrioNoEncontrado = !!buscar.sector && !!lectura.listado && !sector
  const indice = useIndiceCumplimiento(buscar.sector)
  const serie = useSerieCumplimiento({ sectorId: buscar.sector }, !barrioNoEncontrado)
  const errorIndice = indice.error as { estado?: number } | null
  const sinCortes = indice.isError && errorIndice?.estado === 400
  const faltante = faltanteEnPalabras(useCalidadCumplimiento(buscar.sector, sinCortes && !barrioNoEncontrado).data)
  const resumen = resumirCumplimiento(indice.data, serie.data)
  const barrio = sector ? nombreLegible(sector.nombre) : undefined
  const periodo = resumen && periodoEnPalabras(resumen.primerMes, resumen.ultimoMes)
  const cargando = !barrioNoEncontrado && (indice.isPending || (indice.isSuccess && serie.isPending))
  const csv = `/api/cumplimiento/serie.csv${buscar.sector ? `?sectorId=${encodeURIComponent(buscar.sector)}` : ''}`

  // ADR-105: el veredicto solo con muestra suficiente; con menos, el titular nombra lo que se compara.
  const suficiente = !!resumen && muestraSuficiente(resumen.cortes)
  const titular = resumen && suficiente
    ? titularVeredicto(resumen.diferenciaPorCorte, barrio)
    : barrio ? `Lo prometido y lo que duró en ${barrio}` : 'Lo prometido y lo que duró'

  return (
    <div className={`${estilosPagina.pagina} ${estilosPagina.vista}`}>
      <header className={estilos.cabecera}>
        <div className={estilosPagina.cabeceraVista}>
          <p className={bloques.rotulo}>
            Cumplimiento
            {resumen && <> · {formatearNumero(resumen.cortes)} {resumen.cortes === 1 ? 'corte cerrado' : 'cortes cerrados'}</>}
            {periodo && <> · {periodo}</>}
          </p>
          <h1 className={`${estilosPagina.titular} ${estilosPagina.titularVista}`}>{titular}</h1>
        </div>
        <div className={estilos.barra}>
          <SelectorBarrio sectores={sectores} valor={buscar.sector} etiqueta="Barrio" forma="pastilla"
            alCambiar={(id) => void navegar({ to: '/cumplimiento', search: id ? { sector: id } : {}, replace: true })} />
          {lectura.error && !sectores.length && <p role="alert">No pudimos cargar los barrios. <button type="button" className={estilos.accion} onClick={reintentarListado}>Reintentar</button></p>}
        </div>
      </header>

      {barrioNoEncontrado && <p className={`${bloques.bloque} ${estilos.vacio}`}>No encontramos este barrio.</p>}
      {cargando && <output className={estilos.esqueleto}>Consultando el cumplimiento…<span /><span /><span /></output>}
      {!barrioNoEncontrado && sinCortes && (
        <div className={`${bloques.bloque} ${estilos.vacio}`}>
          <p>Aún no hay cortes cerrados para medir{barrio ? ` en ${barrio}` : ''}. Un corte abierto todavía no se puede medir.</p>
          {faltante && <p>{faltante}</p>}
        </div>
      )}
      {!barrioNoEncontrado && indice.isError && !sinCortes && (
        <p role="alert">No pudimos consultar el cumplimiento. Revisa tu conexión e inténtalo otra vez. <button type="button" className={estilos.accion} onClick={() => void indice.refetch()}>Reintentar</button></p>
      )}
      {!barrioNoEncontrado && indice.data && !cargando && (
        <div className={estilos.columnas}>
          <div className={estilos.columna}>
            {resumen ? <Respuesta resumen={resumen} indice={indice.data} /> : <RespuestaSinSerie indice={indice.data} />}
          </div>
          <div className={estilos.columna}>
            {serie.isError && <p role="alert">No pudimos consultar el mes a mes. <button type="button" className={estilos.accion} onClick={() => void serie.refetch()}>Reintentar</button></p>}
            {/* ADR-105: un mes, o pocos cortes, no son una tendencia; las cifras siguen en «Ver los datos». */}
            {serie.data && serie.data.length > 1 && suficiente && <MesAMes puntos={serie.data} />}
            <Detalles puntos={serie.data} csv={csv} />
          </div>
        </div>
      )}
    </div>
  )
}
