import { useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useAhora } from '../../app/ahora'
import { useConteosBitacora, useEstadisticas, useSerieCumplimiento, useTotalBitacora } from '../../app/datos'
import { imprimirEnClaro } from '../../app/tema'
import { Icono } from '../../componentes/Icono'
import { mesEnPalabras } from '../../dominio/cumplimiento'
import { formatearNumero } from '../../dominio/formato'
import { TIPOS_BITACORA } from '../../dominio/historia'
import { conclusionPendiente, muestraSuficiente } from '../../dominio/muestra'
import {
  bajadaBarrios,
  cantidadDeCierres,
  cantidadDeCortes,
  diasExtremos,
  disponibilidadEstadisticas,
  empateDeBarrios,
  GRAFICAS,
  horasCortas,
  horasEnPalabras,
  listaDeDias,
  mesCorto,
  mesDestacado,
  mesesConCierres,
  NOMBRE_GRAFICA,
  novedadesPorTipo,
  ordenarBarrios,
  ordenarDias,
  reglasDeBarrios,
  reglasDeGrafica,
  reglasDelInforme,
  resumenDeSerie,
  SIN_CONCLUSION,
  titularEstadisticas,
  type ColumnaGrafica,
  type DatosDeMedicion,
  type Grafica,
} from '../../dominio/estadisticas'
import { nombreLegible } from '../../dominio/sectores'
import { claveDiaCartagena, fechaYHora } from '../../dominio/tiempo'
import bloques from '../../componentes/Bloques.module.css'
import estilosPagina from './Pagina.module.css'
import estilos from './Estadisticas.module.css'
import type { ContenidoGrafica, Informe } from './InformeEstadisticas'

const BARRIOS_VISIBLES = 5
const COLUMNAS_MINIMAS = 4
const TITULO_GRAFICA: Record<Grafica, string> = {
  dia: 'Cortes por día de la semana',
  duracion: 'Duración promedio por mes',
  cierres: 'Cierres por mes',
  novedades: 'Novedades por tipo',
}
const ABREVIADO: Record<string, string> = {
  Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom',
}

/** Más de dos días empatados no caben en una cifra: se cuentan («6 días») en vez de listarse. */
const nombrarDias = (dias: readonly string[]) => (dias.length > 2 ? `${formatearNumero(dias.length)} días` : listaDeDias(dias))

function cifraDeExtremo(extremo: ReturnType<typeof diasExtremos>, criterio: 'más' | 'menos') {
  if (!extremo) return { etiqueta: 'Sin diferencias entre días', valor: 'Iguales' }
  const varios = extremo.dias.length > 1
  return {
    etiqueta: varios ? `empatan con ${criterio} cortes: ${formatearNumero(extremo.cortes)} cada uno` : `el día con ${criterio} cortes: ${formatearNumero(extremo.cortes)}`,
    valor: nombrarDias(extremo.dias),
  }
}

/** Una columna por día o por mes: la cifra encima y, debajo, qué es. Un dato ausente lleva guion y base punteada, nunca un cero. */
function Columnas({ etiqueta, columnas }: { etiqueta: string; columnas: readonly ColumnaGrafica[] }) {
  const maximo = Math.max(1, ...columnas.map((columna) => columna.medida ?? 0))
  return (
    <ol className={estilos.grafica} aria-label={etiqueta} style={{ '--columnas': Math.max(columnas.length, COLUMNAS_MINIMAS) } as React.CSSProperties}>
      {columnas.map(({ clave, nombre, abreviado, valor, medida, base, destacada }) => (
        <li key={clave} className={destacada ? estilos.destacado : undefined} data-sin-dato={valor === null || undefined}>
          <strong>
            {valor === null ? <><span aria-hidden="true">–</span><span className={estilos.oculto}>Sin dato</span></> : valor}
          </strong>
          <span className={estilos.columna} aria-hidden="true">
            <span style={{ height: `${(medida ?? 0) / maximo * 100}%` }} />
          </span>
          <span className={estilos.pieColumna}>
            <abbr title={nombre}>{abreviado}</abbr>
            {base && <small>{base}</small>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function BarrasPorTipo({ novedades, resaltar }: { novedades: ReturnType<typeof novedadesPorTipo>; resaltar: boolean }) {
  const maximo = Math.max(1, ...novedades.map((novedad) => novedad.eventos ?? 0))
  return (
    <ol className={estilos.barras} aria-label="Eventos de la bitácora por tipo">
      {novedades.map(({ tipo, nombre, eventos }, indice) => (
        <li key={tipo} className={resaltar && indice === 0 ? estilos.destacado : undefined}>
          <span>{nombre}</span>
          <strong>{eventos === null ? 'Sin dato' : formatearNumero(eventos)}</strong>
          <span className={estilos.pista} aria-hidden="true"><span style={{ width: `${(eventos ?? 0) / maximo * 100}%` }} /></span>
        </li>
      ))}
    </ol>
  )
}

interface TablaDeDatos {
  titulo: string
  columnas: readonly string[]
  filas: readonly (readonly [string, ...string[]])[]
}

function Tabla({ titulo, columnas, filas }: TablaDeDatos) {
  return (
    <table>
      <caption>{titulo}</caption>
      <thead><tr>{columnas.map((columna) => <th key={columna} scope="col">{columna}</th>)}</tr></thead>
      <tbody>{filas.map(([primera, ...resto]) => (
        <tr key={primera}><th scope="row">{primera}</th>{resto.map((celda, indice) => <td key={indice}>{celda}</td>)}</tr>
      ))}</tbody>
    </table>
  )
}

function Panel({ id, activa, titulo, bajada, children }: { id: Grafica; activa: boolean; titulo: string; bajada: string; children: ReactNode }) {
  return (
    <section className={estilos.panelGrafica} data-activa={activa || undefined} aria-labelledby={`titulo-${id}`}>
      <header>
        <h2 id={`titulo-${id}`} className={bloques.titulo}>{titulo}</h2>
        <p className={bloques.bajada}>{bajada}</p>
      </header>
      <div className={estilos.cuerpo}>{children}</div>
    </section>
  )
}

/**
 * RF023, RF025 · `ADR-079`, `ADR-104`, `ADR-105` y `ADR-106`: el titular es la duración promedio; debajo, las cifras y dos bloques a ras.
 * Las cuatro gráficas están siempre en la página: en pantalla el selector muestra una y en el papel salen todas, por eso sus datos no
 * esperan a que se elijan.
 */
export function Estadisticas() {
  const [todosLosBarrios, setTodosLosBarrios] = useState(false)
  const [grafica, setGrafica] = useState<Grafica>('dia')
  const [generacion, setGeneracion] = useState<'quieta' | 'generando' | 'fallida'>('quieta')
  const ahora = useAhora()
  const consulta = useEstadisticas()
  const serie = useSerieCumplimiento({})
  const conteos = useConteosBitacora({}, TIPOS_BITACORA)
  const consultaTotal = useTotalBitacora({})
  const totalEventos = consultaTotal.data ?? null
  useEffect(() => imprimirEnClaro(), [])

  const datos = consulta.data
  const disponibilidad = datos ? disponibilidadEstadisticas(datos) : null
  const dias = ordenarDias(datos?.cortesPorDiaDeSemana)
  const mas = diasExtremos(dias, 'mas')
  const menos = diasExtremos(dias, 'menos')
  const barrios = ordenarBarrios((datos?.sectoresMasAfectados ?? []).map((sector) => ({
    clave: sector.sectorId ?? '',
    nombre: sector.nombre && sector.nombre.trim().toLowerCase() !== 'desconocido'
      ? nombreLegible(sector.nombre) : sector.sectorId ?? 'Barrio sin identificar',
    cortes: sector.cantidadCortes ?? null,
  })))
  const cantidades = barrios.map((barrio) => barrio.cortes)
  const empate = empateDeBarrios(cantidades)
  const barriosVisibles = todosLosBarrios ? barrios : barrios.slice(0, BARRIOS_VISIBLES)
  // ADR-105: con menos de 5 cortes se muestran los conteos, pero no se nombra el día con más ni el de menos.
  const suficiente = disponibilidad ? muestraSuficiente(disponibilidad.totalCortes) : false
  const destacados = suficiente ? mas?.dias ?? [] : []

  const meses = mesesConCierres(serie.data ?? [])
  const mesMasLargo = mesDestacado(meses, (mes) => mes.segundosPorCierre)
  const mesConMasCierres = mesDestacado(meses, (mes) => mes.cierres)
  const novedades = novedadesPorTipo(conteos)
  const sumaNovedades = novedades.reduce((total, novedad) => total + (novedad.eventos ?? 0), 0)
  const hayNovedades = novedades.some((novedad) => novedad.eventos !== null)
  const primeraNovedad = novedades[0]
  const medicion: DatosDeMedicion = {
    totalCortes: disponibilidad?.totalCortes ?? 0,
    suficiente,
    duracionHoras: disponibilidad?.duracionMedible ?? null,
    serie: resumenDeSerie(serie.data ?? []),
    eventosFuera: totalEventos === null || !hayNovedades ? null : totalEventos - sumaNovedades,
  }
  const nota = !disponibilidad || disponibilidad.vacioGeneral ? null : [
    !suficiente && conclusionPendiente(disponibilidad.totalCortes, 'registrado'),
    disponibilidad.duracionMedible === null
      ? 'La duración promedio aparece cuando haya cortes cerrados.'
      : 'La duración promedio cuenta solo los cortes cerrados.',
  ].filter(Boolean).join(' ')
  const cifras = [
    { etiqueta: 'cortes registrados', valor: formatearNumero(medicion.totalCortes) },
    ...(suficiente ? [cifraDeExtremo(mas, 'más'), cifraDeExtremo(menos, 'menos')] : []),
  ]
  const bajadas: Record<Grafica, string> = {
    dia: !suficiente ? SIN_CONCLUSION : mas ? `Más los ${nombrarDias(mas.dias).toLowerCase()}: ${cantidadDeCortes(mas.cortes)}` : 'Sin diferencias entre días',
    duracion: mesMasLargo?.segundosPorCierre ? `El más largo fue ${mesEnPalabras(mesMasLargo.periodo).split(' ')[0]}: ${horasEnPalabras(mesMasLargo.segundosPorCierre)}` : SIN_CONCLUSION,
    cierres: mesConMasCierres?.cierres ? `Más en ${mesEnPalabras(mesConMasCierres.periodo).split(' ')[0]}: ${cantidadDeCierres(mesConMasCierres.cierres)}` : SIN_CONCLUSION,
    novedades: suficiente && primeraNovedad?.eventos ? `Más ${primeraNovedad.nombre.toLowerCase()}: ${formatearNumero(primeraNovedad.eventos)} eventos` : SIN_CONCLUSION,
  }
  const columnasDia: ColumnaGrafica[] = dias.map(({ dia, cortes: cantidad }) => ({
    clave: dia,
    nombre: dia,
    abreviado: ABREVIADO[dia] ?? dia,
    valor: cantidad === null ? null : formatearNumero(cantidad),
    medida: cantidad,
    destacada: destacados.includes(dia),
  }))
  const columnasDuracion: ColumnaGrafica[] = meses.map(({ periodo, segundosPorCierre, cierres }) => ({
    clave: periodo,
    nombre: mesEnPalabras(periodo),
    abreviado: mesCorto(periodo),
    valor: segundosPorCierre === null ? null : horasCortas(segundosPorCierre),
    medida: segundosPorCierre,
    ...(cierres !== null && { base: cantidadDeCierres(cierres) }),
    destacada: periodo === mesMasLargo?.periodo,
  }))
  const columnasCierres: ColumnaGrafica[] = meses.map(({ periodo, cierres }) => ({
    clave: periodo,
    nombre: mesEnPalabras(periodo),
    abreviado: mesCorto(periodo),
    valor: cierres === null ? null : formatearNumero(cierres),
    medida: cierres,
    destacada: periodo === mesConMasCierres?.periodo,
  }))
  const sinCierres = serie.isError
    ? <p className={estilos.nota}>No pudimos consultar los meses. <button type="button" className={estilos.accion} onClick={() => void serie.refetch()}>Reintentar</button></p>
    : <p className={estilos.nota}>{serie.isPending ? 'Consultando los meses…' : 'Todavía no hay cortes cerrados por mes.'}</p>

  const tablas: Record<Grafica, TablaDeDatos> = {
    dia: {
      titulo: 'Cortes registrados de lunes a domingo',
      columnas: ['Día', 'Cortes'],
      filas: dias.map(({ dia, cortes: cantidad }) => [dia, cantidad === null ? 'Sin dato' : formatearNumero(cantidad)]),
    },
    duracion: {
      titulo: 'Duración promedio por mes',
      columnas: ['Mes', 'Duración', 'Cierres'],
      filas: meses.map(({ periodo, segundosPorCierre, cierres }) => [
        mesEnPalabras(periodo),
        segundosPorCierre === null ? 'Sin dato' : horasEnPalabras(segundosPorCierre),
        cierres === null ? 'Sin dato' : formatearNumero(cierres),
      ]),
    },
    cierres: {
      titulo: 'Cierres por mes',
      columnas: ['Mes', 'Cierres'],
      filas: meses.map(({ periodo, cierres }) => [mesEnPalabras(periodo), cierres === null ? 'Sin dato' : formatearNumero(cierres)]),
    },
    novedades: {
      titulo: 'Novedades por tipo',
      columnas: ['Tipo', 'Eventos'],
      filas: novedades.map(({ nombre, eventos }) => [nombre, eventos === null ? 'Sin dato' : formatearNumero(eventos)]),
    },
  }

  const descargarPdf = async () => {
    const avisoDeMeses: ContenidoGrafica = {
      tipo: 'aviso',
      texto: serie.isError ? 'No pudimos consultar los meses.' : 'Todavía no hay cortes cerrados por mes.',
    }
    const contenidos: Record<Grafica, ContenidoGrafica> = {
      dia: medicion.totalCortes === 0 ? { tipo: 'aviso', texto: 'Todavía no hay cortes registrados.' } : { tipo: 'columnas', columnas: columnasDia },
      duracion: meses.length === 0 ? avisoDeMeses : { tipo: 'columnas', columnas: columnasDuracion },
      cierres: meses.length === 0 ? avisoDeMeses : { tipo: 'columnas', columnas: columnasCierres },
      novedades: hayNovedades ? { tipo: 'barras', novedades, resaltar: suficiente } : { tipo: 'aviso', texto: 'Las novedades no están disponibles en este momento.' },
    }
    const informe: Informe = {
      claveDia: claveDiaCartagena(ahora),
      generado: fechaYHora(ahora),
      titular: titularEstadisticas(disponibilidad?.duracionMedible ?? null),
      nota,
      cifras,
      graficas: GRAFICAS.map((clave) => ({ titulo: TITULO_GRAFICA[clave], bajada: bajadas[clave], contenido: contenidos[clave] })),
      bajadaBarrios: bajadaBarrios(barrios, suficiente),
      barrios: barrios.slice(0, BARRIOS_VISIBLES).map(({ clave, nombre, cortes }) => ({
        clave,
        nombre,
        cortes: empate !== null ? null : cortes === null ? 'Sin dato' : cantidadDeCortes(cortes),
      })),
      reglas: reglasDelInforme(medicion, cantidades),
    }
    setGeneracion('generando')
    try {
      const { descargarInforme } = await import('./InformeEstadisticas')
      await descargarInforme(informe)
      setGeneracion('quieta')
    } catch {
      setGeneracion('fallida')
    }
  }

  return (
    <div className={`${estilosPagina.pagina} ${estilosPagina.vista} ${estilos.informe}`}>
      <p className={estilos.membrete}>
        <span className={estilos.marcaInforme}>AguaVigía</span> Cartagena · Generado el {fechaYHora(ahora)}
      </p>
      <header className={estilosPagina.cabeceraVista}>
        <p className={bloques.rotulo}>Estadísticas · todos los cortes registrados</p>
        <h1 className={`${estilosPagina.titular} ${estilosPagina.titularVista}`}>
          {titularEstadisticas(disponibilidad?.duracionMedible ?? null)}
        </h1>
        {nota && <p className={estilos.nota}>{nota}</p>}
      </header>

      {consulta.isPending && <output className={estilos.esqueleto}>Consultando las estadísticas…<span /><span /><span /></output>}
      {consulta.isError && (
        <p role="alert">
          No pudimos consultar las estadísticas. Revisa tu conexión e inténtalo otra vez.{' '}
          <button type="button" className={estilos.accion} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      {disponibilidad?.vacioGeneral && <p className={`${bloques.bloque} ${estilos.vacio}`}>Todavía no hay datos registrados para resumir.</p>}

      {datos && disponibilidad && !disponibilidad.vacioGeneral && (
        <>
          <section className={`${bloques.bloque} ${estilos.resumen}`} aria-label="Resumen" data-pocos={!suficiente || undefined}>
            <dl className={`${bloques.cifras} ${estilos.datos}`}>
              {cifras.map(({ etiqueta, valor }, indice) => <div key={indice}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
            </dl>
          </section>

          <div className={estilos.columnas}>
            <div className={`${bloques.bloque} ${estilos.panel} ${estilos.graficas}`}>
              <Panel id="dia" activa={grafica === 'dia'} titulo={TITULO_GRAFICA.dia} bajada={bajadas.dia}>
                {disponibilidad.totalCortes === 0
                  ? <p className={estilos.nota}>Todavía no hay cortes registrados.</p>
                  : <Columnas etiqueta="Cortes de lunes a domingo" columnas={columnasDia} />}
              </Panel>

              <Panel id="duracion" activa={grafica === 'duracion'} titulo={TITULO_GRAFICA.duracion} bajada={bajadas.duracion}>
                {meses.length === 0 ? sinCierres : <Columnas etiqueta="Duración promedio de cada mes" columnas={columnasDuracion} />}
              </Panel>

              <Panel id="cierres" activa={grafica === 'cierres'} titulo={TITULO_GRAFICA.cierres} bajada={bajadas.cierres}>
                {meses.length === 0 ? sinCierres : <Columnas etiqueta="Cierres de cada mes" columnas={columnasCierres} />}
              </Panel>

              <Panel id="novedades" activa={grafica === 'novedades'} titulo={TITULO_GRAFICA.novedades} bajada={bajadas.novedades}>
                {hayNovedades ? <BarrasPorTipo novedades={novedades} resaltar={suficiente} /> : <p className={estilos.nota}>Las novedades no están disponibles en este momento.</p>}
              </Panel>

              <fieldset className={estilos.selector}>
                <legend className={estilos.oculto}>Elegir gráfica</legend>
                {GRAFICAS.map((clave) => (
                  <button key={clave} type="button" aria-pressed={grafica === clave} onClick={() => setGrafica(clave)}>{NOMBRE_GRAFICA[clave]}</button>
                ))}
              </fieldset>
            </div>

            <section className={`${bloques.bloque} ${estilos.panel}`} aria-labelledby="titulo-barrios">
              <header>
                <h2 id="titulo-barrios" className={bloques.titulo}>Barrios con más cortes</h2>
                <p className={bloques.bajada}>{bajadaBarrios(barrios, suficiente)}</p>
              </header>
              <div className={`${estilos.cuerpo} ${estilos.cuerpoLista}`}>
                {barrios.length === 0 ? (
                  <p className={estilos.nota}>Todavía no hay cortes registrados por barrio.</p>
                ) : (
                  <>
                    <ol className={estilos.barrios}>
                      {barriosVisibles.map((barrio) => (
                        <li key={barrio.clave}>
                          <Link to="/sectores/$id" params={{ id: barrio.clave }} className={estilos.barrio}>
                            <span className={estilos.nombreBarrio}>{barrio.nombre}</span>
                            {empate === null && <strong>{barrio.cortes === null ? 'Sin dato' : cantidadDeCortes(barrio.cortes)}</strong>}
                            <span aria-hidden="true">→</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                    {barrios.length > BARRIOS_VISIBLES && !todosLosBarrios && (
                      <button type="button" className={estilos.accion} onClick={() => setTodosLosBarrios(true)}>
                        Ver los {formatearNumero(barrios.length)} barrios
                      </button>
                    )}
                  </>
                )}
              </div>
              <Link to="/cumplimiento" className={`${bloques.fila} ${estilos.pieBloque}`}>
                ¿Duran lo que se anuncia? Ver el cumplimiento <span aria-hidden="true">→</span>
              </Link>
            </section>

            <section className={`${bloques.bloque} ${estilos.reglasInforme}`} aria-labelledby="titulo-reglas">
              <h2 id="titulo-reglas" className={bloques.titulo}>Cómo se mide</h2>
              <ul className={estilos.reglas}>
                {reglasDelInforme(medicion, cantidades).map((regla) => <li key={regla}>{regla}</li>)}
              </ul>
            </section>
          </div>

          <div className={estilos.ayudas}>
            <section className={`${bloques.bloque} ${bloques.compacto}`}>
              <details>
                <summary className={bloques.fila}>
                  <span>Cómo se mide</span>
                  <span className={bloques.giro}><Icono nombre="avanzar" tamano={18} /></span>
                </summary>
                <ul className={estilos.reglas}>
                  {[...reglasDeGrafica(grafica, medicion), ...reglasDeBarrios(cantidades)].map((regla) => <li key={regla}>{regla}</li>)}
                </ul>
              </details>
            </section>

            <section className={`${bloques.bloque} ${bloques.compacto}`}>
              <details className={estilos.verDatos}>
                <summary className={bloques.fila}>
                  <span className={bloques.conIcono}><Icono nombre="descargar" tamano={18} />Ver los datos y descargar el CSV</span>
                  <span className={bloques.giro}><Icono nombre="avanzar" tamano={18} /></span>
                </summary>
                <div className={estilos.tablaContenedor}>
                  <Tabla {...tablas[grafica]} />
                  {barrios.length > 0 && (
                    <Tabla
                      titulo="Barrios con más cortes"
                      columnas={['Barrio', 'Cortes']}
                      filas={barrios.map((barrio) => [barrio.nombre, barrio.cortes === null ? 'Sin dato' : formatearNumero(barrio.cortes)])}
                    />
                  )}
                </div>
                <p className={estilos.descargas}>
                  <a href="/api/estadisticas/exportar.csv" download className={estilos.csv}>Descargar en CSV</a>
                  <button
                    type="button"
                    className={estilos.accion}
                    disabled={generacion === 'generando' || serie.isPending || consultaTotal.isPending}
                    onClick={() => void descargarPdf()}
                  >
                    {generacion === 'generando' ? 'Generando el PDF…' : 'Descargar en PDF'}
                  </button>
                  {generacion === 'fallida' && <span role="alert">No pudimos generar el PDF. Inténtalo otra vez.</span>}
                </p>
              </details>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
