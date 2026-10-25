import { Link, useParams } from '@tanstack/react-router'
import { lazy, Suspense, useMemo } from 'react'
import { useAhora } from '../../app/ahora'
import type { LecturaCanal } from '../../api/canal-en-vivo'
import { useCortes, useListado, useUltimoAviso } from '../../app/datos'
import { CorteAbierto } from '../../componentes/CorteAbierto'
import { CortesCerrados, CortesSinHoraReal } from '../../componentes/CortesCerrados'
import { EnVivo, EstadoListado } from '../../componentes/EstadoListado'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import { estaAbierto, estaCerrado, sinHoraRealEnPalabras } from '../../dominio/cortes'
import { presentarEstado } from '../../dominio/estados'
import { sinVerificacionReciente } from '../../dominio/frescura'
import { nombreLegible, type Sector } from '../../dominio/sectores'
import { enlaceExterno } from '../../dominio/historia'
import { haceCuanto, momento } from '../../dominio/tiempo'
import botones from '../../componentes/Botones.module.css'
import estilos from './Panel.module.css'

const numero = new Intl.NumberFormat('es-CO')
// El cajón del reporte solo se necesita al tocar el botón: no pesa en la primera respuesta.
const Reporte = lazy(() => import('./Reporte').then((modulo) => ({ default: modulo.Reporte })))

function Volver() {
  return <Link to="/" className={estilos.volver}><span aria-hidden="true">←</span> Cartagena ahora</Link>
}

/**
 * ADR-102: una sola línea de frescura. «Verificado hace…» solo importa cuando pasan 24 horas sin verificar y entonces lo dice
 * la advertencia del encabezado; «Listado generado…» es de toda la ciudad y solo se dice cuando la lectura es guardada.
 */
function Registro({ sector, lectura, ahora, reintentar }: { sector: Sector; lectura: LecturaCanal; ahora: Date; reintentar: () => void }) {
  if (lectura.error || lectura.estado === 'sin-red') return <EstadoListado lectura={lectura} ahora={ahora} reintentar={reintentar} />
  return (
    <p className={estilos.nota}>
      {sector.actualizadoEn
        ? <>Actualizado <time dateTime={sector.actualizadoEn} title={momento(sector.actualizadoEn, ahora)}>{haceCuanto(sector.actualizadoEn, ahora)}</time></>
        : 'Sin fecha de registro.'}
      {lectura.estado === 'en-vivo' && <> · <EnVivo /></>}
    </p>
  )
}

/** Un botón a la fuente: la persona puede comprobar por sí misma lo que dice la ficha. */
function FuenteDelAviso({ sector, ahora }: { sector: Sector; ahora: Date }) {
  const { data: aviso } = useUltimoAviso(sector.id ?? '')
  const enlace = enlaceExterno(aviso?.urlOriginal)
  if (!aviso || !enlace) return null
  const origen = aviso.fuente === 'PRENSA' ? 'la nota de prensa' : aviso.fuente === 'ACUACAR' ? 'el boletín de Acuacar' : 'la fuente del aviso'
  return (
    <section aria-label="Fuente del aviso" className={estilos.bloque}>
      <a href={enlace} target="_blank" rel="noopener noreferrer" className={botones.secundario}>
        Ver {origen} <span className={botones.flecha} aria-hidden="true">↗</span>
      </a>
      {aviso.timestamp && (
        <p className={estilos.nota}>
          Último aviso sobre este barrio: <time dateTime={aviso.timestamp}>{momento(aviso.timestamp, ahora)}</time> · se abre en otra pestaña
        </p>
      )}
    </section>
  )
}

function useCortesDelSector(sector: Sector) {
  const consulta = useCortes(sector.id ?? '')
  const cortes = useMemo(() => consulta.data?.pages.flatMap((pagina) => pagina.cortes) ?? [], [consulta.data])
  return { consulta, cortes }
}

function Horario({ sector, ahora }: { sector: Sector; ahora: Date }) {
  const { consulta, cortes } = useCortesDelSector(sector)
  const abiertos = cortes.filter((corte) => estaAbierto(corte, sector.id))
  const afectado = sector.estado && sector.estado !== 'CON_SERVICIO'
  if (!consulta.isPending && !consulta.isError && abiertos.length === 0 && !afectado) return null

  return (
    <section aria-label="Horario del corte" className={estilos.bloque} aria-busy={consulta.isPending}>
      {consulta.isPending ? (
        <div className={estilos.esqueleto} aria-hidden="true"><span /><span /></div>
      ) : consulta.isError && cortes.length === 0 ? (
        <div className={estilos.alerta} role="alert">
          <p>No pudimos consultar los cortes de este barrio.</p>
          <button type="button" className={estilos.botonSecundario} onClick={() => consulta.refetch()}>Reintentar</button>
        </div>
      ) : abiertos.length > 0 ? (
        abiertos.map((corte) => <CorteAbierto key={corte.id} corte={corte} ahora={ahora} />)
      ) : (
        <p className={estilos.nota}>Hora de restablecimiento no informada.</p>
      )}
    </section>
  )
}

function Historial({ sector, ahora }: { sector: Sector; ahora: Date }) {
  const { consulta, cortes } = useCortesDelSector(sector)
  const cerrados = cortes.filter((corte) => estaCerrado(corte, sector.id))
  const sinHoraReal = cortes.filter((corte) => sinHoraRealEnPalabras(corte) !== null)
  return (
    <section aria-labelledby="titulo-cerrados" className={estilos.bloque}>
      <h2 id="titulo-cerrados" className={estilos.seccion}>Cortes cerrados en {nombreLegible(sector.nombre)}</h2>
      {consulta.isPending || (consulta.isError && cortes.length === 0) ? null : cerrados.length === 0 ? (
        <p className={estilos.nota}>No hay cortes cerrados registrados para este barrio.</p>
      ) : (
        <CortesCerrados cortes={cerrados} sectorId={sector.id} ahora={ahora} />
      )}
      {sinHoraReal.length > 0 && <CortesSinHoraReal cortes={sinHoraReal} ahora={ahora} />}
      {consulta.hasNextPage && (
        <button
          type="button"
          className={estilos.enlaceBoton}
          disabled={consulta.isFetchingNextPage}
          onClick={() => consulta.fetchNextPage()}
        >
          {consulta.isFetchingNextPage ? 'Consultando…' : 'Ver cortes anteriores'}
        </button>
      )}
    </section>
  )
}

export function FichaSector() {
  const { id } = useParams({ from: '/publico/mapa/sectores/$id' })
  const { lectura, porId, reintentar } = useListado()
  const ahora = useAhora()
  const sector = porId.get(id)

  if (!lectura.listado) {
    return (
      <div className={estilos.contenido}>
        <Volver />
        <EstadoListado lectura={lectura} ahora={ahora} reintentar={reintentar} />
        <div className={estilos.esqueleto} aria-hidden="true"><span /><span /><span /></div>
      </div>
    )
  }

  if (!sector) {
    return (
      <div className={estilos.contenido}>
        <Volver />
        <header className={estilos.entrada}>
          <h1 className={estilos.titular}>No encontramos este barrio</h1>
          <p className={estilos.bajada}>El enlace no corresponde a ninguno de los barrios del listado. Búscalo por su nombre.</p>
        </header>
      </div>
    )
  }

  const nombre = nombreLegible(sector.nombre)
  const estado = presentarEstado(sector.estado)
  const advertir = sinVerificacionReciente(sector.verificadoEn, ahora)

  return (
    <article className={estilos.contenido} aria-labelledby="nombre-barrio">
      <Volver />
      <header className={estilos.ficha}>
        <p className={estilos.rotulo}>
          Barrio · {sector.poblacion == null ? 'sin dato censal' : `${numero.format(sector.poblacion)} habitantes`}
        </p>
        <h1 id="nombre-barrio" className={estilos.barrio}>{nombre}</h1>
        <p className={estilos.estado}>
          <GlifoEstado estado={sector.estado} tamano={24} />
          {estado.texto}
        </p>
        {!sector.estado && <p className={estilos.nota}>Puedes reportar lo que pasa en tu casa.</p>}
        {advertir && (
          <p className={estilos.advertencia}>
            Sin verificación reciente: nadie lo confirma desde hace más de 24 horas. El estado es el último registrado.
          </p>
        )}
      </header>

      <Horario sector={sector} ahora={ahora} />

      <section aria-label="Registro del dato" className={estilos.bloque}>
        <Registro sector={sector} lectura={lectura} ahora={ahora} reintentar={reintentar} />
      </section>

      <FuenteDelAviso sector={sector} ahora={ahora} />

      <section aria-label="Qué puedes hacer" className={`${estilos.bloque} ${estilos.acciones}`}>
        <Suspense fallback={<span className={estilos.reservaBoton} aria-hidden="true" />}>
          <Reporte sector={sector} />
        </Suspense>
        <Link to="/avisos" search={{ sector: sector.id }} className={estilos.enlace}>Recibir avisos de {nombre}</Link>
      </section>

      <Historial sector={sector} ahora={ahora} />
    </article>
  )
}
