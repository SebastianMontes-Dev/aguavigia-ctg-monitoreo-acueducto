import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useEstadisticas } from '../../app/datos'
import { Icono } from '../../componentes/Icono'
import { formatearNumero } from '../../dominio/formato'
import { conclusionPendiente, muestraSuficiente } from '../../dominio/muestra'
import { diasExtremos, disponibilidadEstadisticas, empateDeBarrios, listaDeDias, ordenarDias, titularEstadisticas } from '../../dominio/estadisticas'
import { nombreLegible } from '../../dominio/sectores'
import bloques from '../../componentes/Bloques.module.css'
import estilosPagina from './Pagina.module.css'
import estilos from './Estadisticas.module.css'

const BARRIOS_VISIBLES = 5
const ABREVIADO: Record<string, string> = {
  Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom',
}

const cortes = (cantidad: number) => `${formatearNumero(cantidad)} ${cantidad === 1 ? 'corte' : 'cortes'}`

/** Más de dos días empatados no caben en una cifra: se cuentan («6 días») en vez de listarse. */
const nombrarDias = (dias: readonly string[]) => (dias.length > 2 ? `${formatearNumero(dias.length)} días` : listaDeDias(dias))

function Extremo({ extremo, criterio }: { extremo: ReturnType<typeof diasExtremos>; criterio: 'más' | 'menos' }) {
  if (!extremo) return <div><dt>Sin diferencias entre días</dt><dd>Iguales</dd></div>
  const varios = extremo.dias.length > 1
  return (
    <div>
      <dt>{varios ? `empatan con ${criterio} cortes: ${formatearNumero(extremo.cortes)} cada uno` : `el día con ${criterio} cortes: ${formatearNumero(extremo.cortes)}`}</dt>
      <dd>{nombrarDias(extremo.dias)}</dd>
    </div>
  )
}

/** RF023, RF025 · `ADR-079`, `ADR-104` y `ADR-105`: el titular es la duración promedio; las cifras en una fila, los días y los barrios en bloques. */
export function Estadisticas() {
  const [todosLosBarrios, setTodosLosBarrios] = useState(false)
  const consulta = useEstadisticas()
  const datos = consulta.data
  const disponibilidad = datos ? disponibilidadEstadisticas(datos) : null
  const dias = ordenarDias(datos?.cortesPorDiaDeSemana)
  const mas = diasExtremos(dias, 'mas')
  const menos = diasExtremos(dias, 'menos')
  const maximo = Math.max(1, ...dias.map((dia) => dia.cortes ?? 0))
  const barrios = (datos?.sectoresMasAfectados ?? []).map((sector) => ({
    clave: sector.sectorId ?? '',
    nombre: sector.nombre && sector.nombre.trim().toLowerCase() !== 'desconocido'
      ? nombreLegible(sector.nombre) : sector.sectorId ?? 'Barrio sin identificar',
    cortes: sector.cantidadCortes ?? null,
  }))
  const empate = empateDeBarrios(barrios.map((barrio) => barrio.cortes))
  const barriosVisibles = todosLosBarrios ? barrios : barrios.slice(0, BARRIOS_VISIBLES)
  // ADR-105: con menos de 5 cortes se muestran los conteos, pero no se nombra el día con más ni el de menos.
  const suficiente = disponibilidad ? muestraSuficiente(disponibilidad.totalCortes) : false
  const destacados = suficiente ? mas?.dias ?? [] : []

  return (
    <div className={`${estilosPagina.pagina} ${estilosPagina.vista}`}>
      <header className={estilosPagina.cabeceraVista}>
        <p className={bloques.rotulo}>Estadísticas · todos los cortes registrados</p>
        <h1 className={`${estilosPagina.titular} ${estilosPagina.titularVista}`}>
          {titularEstadisticas(disponibilidad?.duracionMedible ?? null)}
        </h1>
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
              <div><dt>cortes registrados</dt><dd>{formatearNumero(disponibilidad.totalCortes)}</dd></div>
              {suficiente && <Extremo extremo={mas} criterio="más" />}
              {suficiente && <Extremo extremo={menos} criterio="menos" />}
            </dl>
            <p className={estilos.nota}>
              {!suficiente && `${conclusionPendiente(disponibilidad.totalCortes, 'registrado')} `}
              {disponibilidad.duracionMedible === null
                ? 'La duración promedio aparece cuando haya cortes cerrados.'
                : 'La duración promedio cuenta solo los cortes cerrados.'}
            </p>
          </section>

          <div className={estilos.columnas}>
            <section className={bloques.bloque} aria-labelledby="titulo-dias">
              <header className={estilos.cabeceraBloque}>
                <h2 id="titulo-dias" className={bloques.titulo}>Cortes por día de la semana</h2>
                {suficiente && (
                  <p className={bloques.bajada}>{mas ? `Más los ${nombrarDias(mas.dias).toLowerCase()}: ${cortes(mas.cortes)}` : 'Sin diferencias entre días'}</p>
                )}
              </header>
              {disponibilidad.totalCortes === 0 ? (
                <p className={estilos.nota}>Todavía no hay cortes registrados.</p>
              ) : (
                <ol className={estilos.columnasDias} aria-label="Cortes de lunes a domingo">
                  {dias.map(({ dia, cortes: cantidad }) => (
                    <li key={dia} className={destacados.includes(dia) ? estilos.destacado : undefined} data-sin-dato={cantidad === null || undefined}>
                      <strong>
                        {cantidad === null ? <><span aria-hidden="true">–</span><span className={estilos.oculto}>Sin dato</span></> : formatearNumero(cantidad)}
                      </strong>
                      <span className={estilos.columna} aria-hidden="true">
                        <span style={{ height: `${(cantidad ?? 0) / maximo * 100}%` }} />
                      </span>
                      <abbr title={dia}>{ABREVIADO[dia] ?? dia}</abbr>
                    </li>
                  ))}
                </ol>
              )}
              <details className={estilos.verDatos}>
                <summary className={bloques.fila}>
                  <span className={bloques.conIcono}><Icono nombre="descargar" tamano={18} />Ver los datos y descargar el CSV</span>
                  <span className={bloques.giro}><Icono nombre="avanzar" tamano={18} /></span>
                </summary>
                <div className={estilos.tablaContenedor}>
                  <table>
                    <caption>Cortes registrados de lunes a domingo</caption>
                    <thead><tr><th scope="col">Día</th><th scope="col">Cortes</th></tr></thead>
                    <tbody>{dias.map(({ dia, cortes: cantidad }) => (
                      <tr key={dia}><th scope="row">{dia}</th><td>{cantidad === null ? 'Sin dato' : formatearNumero(cantidad)}</td></tr>
                    ))}</tbody>
                  </table>
                  {barrios.length > 0 && (
                    <table>
                      <caption>Barrios con más cortes</caption>
                      <thead><tr><th scope="col">Barrio</th><th scope="col">Cortes</th></tr></thead>
                      <tbody>{barrios.map((barrio) => (
                        <tr key={barrio.clave}><th scope="row">{barrio.nombre}</th><td>{barrio.cortes === null ? 'Sin dato' : formatearNumero(barrio.cortes)}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
                <a href="/api/estadisticas/exportar.csv" download className={estilos.csv}>Descargar en CSV</a>
              </details>
            </section>

            <div className={estilos.lateral}>
              <section className={bloques.bloque} aria-labelledby="titulo-barrios">
                <header>
                  <h2 id="titulo-barrios" className={bloques.titulo}>Barrios con más cortes</h2>
                  {empate !== null && (
                    <p className={bloques.bajada}>
                      {formatearNumero(barrios.length)} barrios empatan con {cortes(empate)} cada uno.
                    </p>
                  )}
                </header>
                {barrios.length === 0 ? (
                  <p className={estilos.nota}>Todavía no hay cortes registrados por barrio.</p>
                ) : (
                  <>
                    <ol className={estilos.barrios}>
                      {barriosVisibles.map((barrio) => (
                        <li key={barrio.clave}>
                          <Link to="/sectores/$id" params={{ id: barrio.clave }} className={estilos.barrio}>
                            <span className={estilos.nombreBarrio}>{barrio.nombre}</span>
                            {empate === null && <strong>{barrio.cortes === null ? 'Sin dato' : cortes(barrio.cortes)}</strong>}
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
              </section>
              <section className={`${bloques.bloque} ${bloques.tenido} ${bloques.compacto}`}>
                <Link to="/cumplimiento" className={bloques.fila}>
                  ¿Duran lo que se anuncia? Ver el cumplimiento <span aria-hidden="true">→</span>
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
