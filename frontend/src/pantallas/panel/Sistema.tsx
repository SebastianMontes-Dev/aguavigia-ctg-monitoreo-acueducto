import { Button } from 'react-aria-components'
import type { ErrorApi } from '../../api/cliente'
import { useAhora } from '../../app/ahora'
import { useCopias, useMetricas } from '../../app/datos-panel'
import { usePaletaGrafito } from '../../app/paleta'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { GlifoSalud } from '../../componentes/GlifoSalud'
import type { SaludDeColector } from '../../dominio/ingesta'
import { formatearNumero } from '../../dominio/formato'
import { MUESTRA_SUFICIENTE } from '../../dominio/muestra'
import {
  cambioEnPalabras, conteoEnPalabras, conteosDeCopia, cuandoEnPalabras, duracionDeCopia, entradasDe, resultadoDeCopia, resultadoEnPalabras, tiempoHastaElCambio,
  tipoDeReporteEnPalabras, totalDe, verificacionEnPalabras,
  type CopiaAnalitica, type Contadores, type MetricasSistema, type ResultadoDeCopia,
} from '../../dominio/sistema'
import { haceCuanto, momento } from '../../dominio/tiempo'
import pagina from '../publico/Pagina.module.css'
import estilos from './Gestion.module.css'
import formularios from './Formulario.module.css'
import propios from './Sistema.module.css'

// La copia no es un estado del servicio de agua: se distingue por la forma y la palabra, igual que la salud de los colectores.
const GLIFOS: Record<ResultadoDeCopia, SaludDeColector> = { ok: 'activo', 'con-diferencias': 'con-fallos', fallida: 'caido', 'en-curso': 'sin-ciclos', desconocido: 'sin-ciclos' }

function Desglose({ titulo, contadores, nombrar }: { titulo: string; contadores: Contadores; nombrar: (clave: string) => string }) {
  const entradas = entradasDe(contadores)
  return (
    <div className={propios.desglose}>
      <h4 className={propios.tituloDesglose}>{titulo}</h4>
      {entradas.length === 0
        ? <p className={estilos.vacio}>Ninguno desde que arrancó este proceso.</p>
        : <ul>{entradas.map(({ clave, cantidad }) => <li key={clave}><span>{nombrar(clave)}</span><strong>{formatearNumero(cantidad)}</strong></li>)}</ul>}
    </div>
  )
}

function TiempoHastaElCambio({ metricas }: { metricas: MetricasSistema }) {
  const tiempo = tiempoHastaElCambio(metricas)
  if (tiempo.cambios === 0) {
    return <p className={bloques.bajada}>Todavía no hubo un cambio de estado sostenido por vecinos desde que arrancó este proceso, así que no hay tiempo que medir.</p>
  }
  if (!tiempo.suficiente) {
    return (
      <p className={bloques.bajada}>
        {formatearNumero(tiempo.cambios)} {tiempo.cambios === 1 ? 'cambio medido' : 'cambios medidos'}: con menos de {MUESTRA_SUFICIENTE} todavía no se puede sacar una conclusión sobre cuánto tarda el estado en cambiar.
      </p>
    )
  }
  return (
    <dl className={propios.tiempo}>
      <div><dt>Tarda en promedio</dt><dd>{tiempo.promedio ?? 'Sin dato'}</dd></div>
      <div><dt>Lo más que tardó</dt><dd>{tiempo.maximo ?? 'Sin dato'}</dd></div>
      <div><dt>Cambios medidos</dt><dd>{formatearNumero(tiempo.cambios)}</dd></div>
    </dl>
  )
}

function BloqueMetricas({ ahora }: { ahora: Date }) {
  const consulta = useMetricas()
  const error = consulta.isError ? (consulta.error as unknown as ErrorApi) : null
  const metricas = consulta.data
  return (
    <section className={bloques.bloque} aria-labelledby="titulo-metricas">
      <h2 id="titulo-metricas" className={estilos.tituloLateral}>Métricas de calibración</h2>
      {consulta.isPending && <output className={estilos.vacio}>Consultando las métricas…</output>}
      {error && !metricas && (
        <p role="alert" className={estilos.vacio}>
          {error.estado === 403 ? 'Tu cuenta no puede ver las métricas.' : 'No pudimos consultar las métricas.'}{' '}
          <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      {metricas && (
        <>
          <p className={bloques.bajada}>
            {metricas.desde ? `Cuentan desde ${cuandoEnPalabras(metricas.desde, ahora)} (${haceCuanto(metricas.desde, ahora)}). ` : 'No sabemos desde cuándo cuentan. '}
            Un reinicio del servidor los pone a cero y, con varias réplicas, cada una cuenta los suyos.
          </p>
          <dl className={`${bloques.cifras} ${propios.cifrasMetricas}`}>
            <div><dt>Barrios en disputa</dt><dd>{formatearNumero(metricas.disputasAbiertas ?? 0)}</dd></div>
            <div><dt>Cambios de estado</dt><dd>{formatearNumero(totalDe(metricas.cambiosDeEstado))}</dd></div>
            <div><dt>Reportes recibidos</dt><dd>{formatearNumero(totalDe(metricas.reportesPorNivelDeVerificacion))}</dd></div>
            <div><dt>Quórums sin composición</dt><dd>{formatearNumero(totalDe(metricas.quorumsRechazadosPorComposicion))}</dd></div>
            <div><dt>Fallos de colectores</dt><dd>{formatearNumero(totalDe(metricas.fallosDeColectores))}</dd></div>
          </dl>
          <div className={propios.seccion}>
            <h3 className={propios.tituloSeccion}>Cuánto tarda el estado en cambiar</h3>
            <TiempoHastaElCambio metricas={metricas} />
          </div>
          <details className={propios.detalle}>
            <summary>Ver el desglose de cada contador</summary>
            <div className={propios.desgloses}>
              <Desglose titulo="Cambios de estado, por estado y quién lo sostuvo" contadores={metricas.cambiosDeEstado} nombrar={cambioEnPalabras} />
              <Desglose titulo="Reportes, por cuánto respalda el servidor a quien reporta" contadores={metricas.reportesPorNivelDeVerificacion} nombrar={verificacionEnPalabras} />
              <Desglose titulo="Quórums que llegaron al umbral pero no a la composición" contadores={metricas.quorumsRechazadosPorComposicion} nombrar={tipoDeReporteEnPalabras} />
              <Desglose titulo="Fallos de cada colector" contadores={metricas.fallosDeColectores} nombrar={(clave) => clave} />
            </div>
          </details>
          <p className={propios.nota}>
            Sirven para calibrar umbrales y plazos que hoy son valores iniciales, no para juzgar al sistema: no hay semáforos ni límites. Consultado {momento(new Date(consulta.dataUpdatedAt), ahora)}
          </p>
        </>
      )}
      {error && metricas && (
        <p role="alert" className={estilos.vacio}>
          No pudimos actualizar las métricas. <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
    </section>
  )
}

function Copia({ copia, ahora }: { copia: CopiaAnalitica; ahora: Date }) {
  const resultado = resultadoDeCopia(copia)
  const filas = conteosDeCopia(copia)
  const duracion = duracionDeCopia(copia)
  return (
    <div className={propios.copia}>
      <p className={propios.resultado} data-resultado={resultado}>
        <GlifoSalud salud={GLIFOS[resultado]} tamano={20} />
        <span>{resultadoEnPalabras(resultado)}</span>
      </p>
      <p className={bloques.bajada}>
        {copia.terminadaEn
          ? `Terminó ${haceCuanto(copia.terminadaEn, ahora)}${duracion ? ` y tardó ${duracion}` : ''}.`
          : copia.iniciadaEn
            ? `Empezó ${haceCuanto(copia.iniciadaEn, ahora)} y todavía no terminó: sigue en curso o el servidor se detuvo a mitad de ella.`
            : 'No sabemos cuándo corrió.'}
      </p>
      <table className={propios.conteos}>
        <caption className={estilos.oculto}>Conteos en MongoDB y en la copia SQL</caption>
        <thead>
          <tr><th scope="col">Qué</th><th scope="col">MongoDB</th><th scope="col">Copia SQL</th><th scope="col">Cuadra</th></tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.nombre}>
              <th scope="row">{fila.nombre}</th>
              <td>{conteoEnPalabras(fila.mongo)}</td>
              <td>{conteoEnPalabras(fila.sql)}</td>
              <td>{fila.mongo === null || fila.sql === null ? 'Sin dato' : fila.cuadra ? 'Sí' : 'No cuadra'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {copia.detalle?.trim() && <p className={propios.detalleCopia}><strong>{resultado === 'fallida' ? 'Por qué falló:' : 'Qué no cuadró:'}</strong> {copia.detalle}</p>}
    </div>
  )
}

function BloqueCopia({ ahora }: { ahora: Date }) {
  const consulta = useCopias()
  const error = consulta.isError ? (consulta.error as unknown as ErrorApi) : null
  const apagada = error?.estado === 503
  const copias = consulta.data ?? []
  const [ultima, ...anteriores] = copias
  return (
    <section className={bloques.bloque} aria-labelledby="titulo-copia">
      <h2 id="titulo-copia" className={estilos.tituloLateral}>Copia analítica (PostgreSQL)</h2>
      {consulta.isPending && <output className={estilos.vacio}>Consultando la copia analítica…</output>}
      {apagada && (
        <div className={propios.apagada}>
          <p className={bloques.titulo}>La copia analítica está apagada o PostgreSQL no responde; el sistema funciona igual</p>
          <p className={bloques.bajada}>
            MongoDB es la única fuente de verdad y no lee de esta copia. También se ve así mientras no haya habido una primera copia.
          </p>
          <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Volver a consultar</button>
        </div>
      )}
      {error && !apagada && (
        <p role="alert" className={estilos.vacio}>
          {error.estado === 403 ? 'Tu cuenta no puede ver la copia analítica.' : 'No pudimos consultar la copia analítica.'}{' '}
          <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      )}
      {consulta.data && copias.length === 0 && (
        <div className={estilos.vacioBloque}>
          <p className={bloques.titulo}>Todavía no hubo ninguna copia</p>
          <p className={bloques.bajada}>Un job la hace cada 5 minutos desde MongoDB. Mientras tanto, el sistema funciona igual.</p>
        </div>
      )}
      {ultima && <Copia copia={ultima} ahora={ahora} />}
      {anteriores.length > 0 && (
        <details className={propios.detalle}>
          <summary>Ver las copias anteriores ({formatearNumero(anteriores.length)})</summary>
          <ul className={propios.anteriores}>
            {anteriores.map((copia, indice) => {
              const resultado = resultadoDeCopia(copia)
              return (
                <li key={copia.id ?? indice}>
                  <GlifoSalud salud={GLIFOS[resultado]} tamano={16} />
                  <span>{resultadoEnPalabras(resultado)}</span>
                  <span className={propios.cuando}>{copia.iniciadaEn ? haceCuanto(copia.iniciadaEn, ahora) : 'Sin hora'}</span>
                </li>
              )
            })}
          </ul>
        </details>
      )}
      {consulta.data && (
        <p className={propios.nota}>La copia solo guarda barrios, cortes y duraciones: ningún dato personal. Va hasta 5 minutos por detrás de MongoDB.</p>
      )}
    </section>
  )
}

function titularDe(metricas: ReturnType<typeof useMetricas>, ahora: Date): string {
  if (metricas.isPending) return 'Consultando el sistema…'
  if (metricas.isError && !metricas.data) return 'No pudimos consultar el sistema'
  const desde = metricas.data?.desde
  return desde ? `Contadores de este proceso desde ${cuandoEnPalabras(desde, ahora)}` : 'Contadores de este proceso'
}

/** FE5 · `/panel/sistema`: métricas de calibración y estado de la copia analítica. Verlas exige `VER_PANEL`. */
export function Sistema() {
  usePaletaGrafito()
  const ahora = useAhora()
  const metricas = useMetricas()
  const copias = useCopias()
  const actualizando = metricas.isFetching || copias.isFetching
  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Sistema · calibración y copia analítica</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>{titularDe(metricas, ahora)}</h1>
        <div>
          <Button
            className={botones.secundario}
            isDisabled={actualizando}
            onPress={() => { void metricas.refetch(); void copias.refetch() }}
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>
      </header>
      <div className={formularios.rejilla}>
        <BloqueMetricas ahora={ahora} />
        <BloqueCopia ahora={ahora} />
      </div>
    </div>
  )
}
