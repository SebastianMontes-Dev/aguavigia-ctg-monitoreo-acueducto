import { Link, useParams } from '@tanstack/react-router'
import { lazy, Suspense, useMemo } from 'react'
import { useAhora } from '../../app/ahora'
import type { LecturaCanal } from '../../api/canal-en-vivo'
import { useCortes, useListado, useUltimoAviso } from '../../app/datos'
import { CorteAbierto } from '../../componentes/CorteAbierto'
import { CortesCerrados, CortesSinHoraReal } from '../../componentes/CortesCerrados'
import { EnVivo, EstadoListado } from '../../componentes/EstadoListado'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import { Icono } from '../../componentes/Icono'
import { estaAbierto, estaCerrado, sinHoraRealEnPalabras, type Corte } from '../../dominio/cortes'
import { presentarEstado } from '../../dominio/estados'
import { formatearNumero } from '../../dominio/formato'
import { sinVerificacionReciente } from '../../dominio/frescura'
import { nombreLegible, type Sector } from '../../dominio/sectores'
import { diaConFecha, formatearHora, haceCuanto, momento } from '../../dominio/tiempo'
import estilos from './Panel.module.css'

// El cajón del reporte solo se necesita al tocar el botón: no pesa en la primera respuesta.
const Reporte = lazy(() => import('./Reporte').then((modulo) => ({ default: modulo.Reporte })))

function Volver() {
  return <Link to="/" className={estilos.volver}><span aria-hidden="true">←</span> Cartagena ahora</Link>
}

function useCortesDelSector(sector: Sector) {
  const consulta = useCortes(sector.id ?? '')
  const cortes = useMemo(() => consulta.data?.pages.flatMap((pagina) => pagina.cortes) ?? [], [consulta.data])
  return { consulta, cortes }
}

/**
 * ADR-102: una sola línea de frescura. «Verificado hace…» solo importa cuando pasan 24 horas sin verificar y entonces lo dice
 * la advertencia de la tarjeta; «Listado generado…» es de toda la ciudad y solo se dice cuando la lectura es guardada.
 */
function Registro({ sector, lectura, ahora, reintentar }: { sector: Sector; lectura: LecturaCanal; ahora: Date; reintentar: () => void }) {
  if (lectura.error || lectura.estado === 'sin-red') return <EstadoListado lectura={lectura} ahora={ahora} reintentar={reintentar} />
  return (
    <p className={estilos.registro}>
      {sector.actualizadoEn
        ? <span>Actualizado <time dateTime={sector.actualizadoEn} title={momento(sector.actualizadoEn, ahora)}>{haceCuanto(sector.actualizadoEn, ahora)}</time></span>
        : <span>Sin fecha de registro.</span>}
      {lectura.estado === 'en-vivo' && <EnVivo />}
    </p>
  )
}

/**
 * Solo distingue un aviso oficial o una nota de prensa de un reporte de vecinos. Un estado del revisor o de un sensor no
 * se rotula: la persona necesita saber qué pasa con el agua, no cómo funciona AguaVigía por dentro.
 */
function procedenciaDelEstado(sector: Sector): string | null {
  switch (sector.origen) {
    case 'ACUACAR': return 'Aviso oficial de Acuacar'
    case 'PRENSA': return 'Según una nota de prensa'
    case 'VECINOS': {
      const vecinos = sector.respaldo?.vecinos
      return vecinos ? `Reportado por ${formatearNumero(vecinos)} ${vecinos === 1 ? 'vecino' : 'vecinos'}` : 'Reportado por vecinos'
    }
    default: return null
  }
}

/**
 * ADR-103: el estado en un recuadro teñido de su color, con glifo y palabra; sin dato verificado no lleva color. Lo que
 * matiza el estado (procedencia, promesa vencida, disputa, falta de verificación) va dentro, no en bloques aparte.
 */
function EstadoActual({ sector, lectura, ahora, reintentar }: { sector: Sector; lectura: LecturaCanal; ahora: Date; reintentar: () => void }) {
  const { consulta, cortes } = useCortesDelSector(sector)
  const estado = presentarEstado(sector.estado)
  const afectado = sector.estado && sector.estado !== 'CON_SERVICIO'
  const cortesLeidos = !consulta.isPending && !(consulta.isError && cortes.length === 0)
  const abiertos = cortes.filter((corte) => estaAbierto(corte, sector.id))
  const sinTarjeta = afectado && cortesLeidos && abiertos.length === 0
  // La promesa del barrio solo se dice aquí cuando no hay tarjeta de corte abierto que ya la muestre debajo.
  const finPrometido = sinTarjeta ? sector.ventanaPrometida?.fin : undefined
  const enContra = sector.enDisputa ? sector.reportesEnContra ?? 0 : 0
  // El corte abierto ya dice «Aviso oficial de Acuacar» justo debajo: repetirlo junto al estado no informa nada.
  const repetida = sector.origen === 'ACUACAR' && abiertos.some((corte) => corte.origen === 'OFICIAL_ACUACAR')
  const procedencia = repetida ? null : procedenciaDelEstado(sector)

  return (
    <section aria-label="Estado actual" className={estilos.tarjetaEstado} data-estado={estado.clave}>
      <span className={estilos.circuloGlifo}><GlifoEstado estado={sector.estado} tamano={24} /></span>
      <div className={estilos.cuerpoEstado}>
        <p className={estilos.filaTituloEstado}>
          <span className={estilos.tituloEstado}>{estado.texto}</span>
          {procedencia && <span className={estilos.procedencia}>{procedencia}</span>}
        </p>
        <Registro sector={sector} lectura={lectura} ahora={ahora} reintentar={reintentar} />
        {!sector.estado && <p className={estilos.lineaEstado}>Puedes reportar lo que pasa en tu casa.</p>}
        {sector.restablecimientoPorConfirmar && (
          <p className={estilos.lineaEstado}>Ya pasó la hora prometida y nadie ha confirmado que volvió el agua.</p>
        )}
        {finPrometido ? (
          <p className={estilos.lineaEstado}>
            Regreso prometido para las <time dateTime={finPrometido}>{formatearHora(finPrometido)}, {diaConFecha(finPrometido, ahora)}</time>
            {!sector.restablecimientoPorConfirmar && new Date(finPrometido).getTime() < ahora.getTime() && ' (hora ya pasada)'}.
          </p>
        ) : sinTarjeta && <p className={estilos.lineaEstado}>Hora de restablecimiento no informada.</p>}
        {enContra > 0 && (
          <p className={estilos.lineaEstado}>
            {formatearNumero(enContra)} {enContra === 1 ? 'vecino reporta' : 'vecinos reportan'} algo distinto. Pendiente de revisión.
          </p>
        )}
        {sinVerificacionReciente(sector.verificadoEn, ahora) && (
          <p className={estilos.advertencia}>
            Sin verificación reciente: nadie lo confirma desde hace más de 24 horas. El estado es el último registrado.
          </p>
        )}
      </div>
    </section>
  )
}

const TIPO_DE_AVISO: Record<string, string> = { ACUACAR: 'Aviso de Acuacar', PRENSA: 'Nota de prensa' }

/** Un corte que aún no empieza se dice programado; uno que ya empezó, en curso. No se infiere que causó el estado. */
function TarjetaCorte({ corte, ahora }: { corte: Corte; ahora: Date }) {
  const tipo = !corte.inicio ? 'registrado' : new Date(corte.inicio).getTime() > ahora.getTime() ? 'programado' : 'en-curso'
  return (
    <div className={estilos.tarjetaAviso} data-tipo={tipo}>
      <p className={estilos.tipoAviso}>
        <Icono nombre="calendario" tamano={16} />
        {tipo === 'programado' ? 'Corte programado' : tipo === 'en-curso' ? 'Corte en curso' : 'Corte registrado'}
      </p>
      <CorteAbierto corte={corte} ahora={ahora} />
    </div>
  )
}

/**
 * Los cortes abiertos del barrio y, en una fila, el último boletín o nota que lo nombra. Van separados porque el contrato
 * no dice qué aviso anunció cada corte (ADR-102); «Ver todos» lleva a la bitácora filtrada, donde se abre la fuente.
 */
function UltimoAviso({ sector, ahora }: { sector: Sector; ahora: Date }) {
  const { consulta, cortes } = useCortesDelSector(sector)
  const avisoConsulta = useUltimoAviso(sector.id ?? '')
  const aviso = avisoConsulta.data
  const abiertos = cortes.filter((corte) => estaAbierto(corte, sector.id))
  const fallo = (consulta.isError && cortes.length === 0) || avisoConsulta.isError
  const cargando = consulta.isPending || (abiertos.length === 0 && avisoConsulta.isPending)

  function reintentar() {
    if (consulta.isError) void consulta.refetch()
    if (avisoConsulta.isError) void avisoConsulta.refetch()
  }

  return (
    <section aria-labelledby="titulo-aviso" className={estilos.bloqueFicha} aria-busy={cargando}>
      <div className={estilos.cabeceraSeccion}>
        <h2 id="titulo-aviso" className={estilos.seccionFicha}>Último aviso</h2>
        {aviso && (
          <Link
            to="/bitacora"
            search={{ sector: sector.id, tipo: 'CORTE_DETECTADO_POR_INGESTA' }}
            aria-label={`Ver todos los avisos de ${nombreLegible(sector.nombre)} en la bitácora`}
            className={estilos.enlaceFlecha}
          >
            Ver todos <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {cargando ? (
        <div className={estilos.esqueleto} aria-hidden="true"><span /><span /></div>
      ) : (
        <>
          {fallo && (
            <div className={estilos.alerta} role="alert">
              <p>No pudimos consultar los avisos de este barrio.</p>
              <button type="button" className={estilos.botonSecundario} onClick={reintentar}>Reintentar</button>
            </div>
          )}
          {abiertos.map((corte) => <TarjetaCorte key={corte.id} corte={corte} ahora={ahora} />)}
          {aviso ? (
            <p className={estilos.filaAviso}>
              <Icono nombre="documento" tamano={16} />
              <span className={estilos.tipoFila}>{(aviso.fuente && TIPO_DE_AVISO[aviso.fuente]) || 'Aviso sobre este barrio'}</span>
              {aviso.timestamp && (
                <time dateTime={aviso.timestamp} className={estilos.fechaAviso}>
                  {diaConFecha(aviso.timestamp, ahora, { pasado: true })}, {formatearHora(aviso.timestamp)}
                </time>
              )}
            </p>
          ) : !fallo && abiertos.length === 0 && (
            <p className={estilos.nota}>No hay avisos registrados para este barrio.</p>
          )}
        </>
      )}
    </section>
  )
}

function Historial({ sector, ahora }: { sector: Sector; ahora: Date }) {
  const { consulta, cortes } = useCortesDelSector(sector)
  const cerrados = cortes.filter((corte) => estaCerrado(corte, sector.id))
  const sinHoraReal = cortes.filter((corte) => sinHoraRealEnPalabras(corte) !== null)
  return (
    <section aria-labelledby="titulo-cerrados" className={`${estilos.bloqueFicha} ${estilos.historial}`}>
      <h2 id="titulo-cerrados" className={estilos.seccionFicha}>Cortes cerrados en {nombreLegible(sector.nombre)}</h2>
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

  return (
    <article className={`${estilos.contenido} ${estilos.contenidoFicha}`} aria-labelledby="nombre-barrio">
      <Volver />
      <header className={estilos.ficha}>
        <h1 id="nombre-barrio" className={estilos.barrio}>{nombre}</h1>
        <div className={estilos.filaRotulo}>
          <p className={estilos.rotulo}>
            Barrio · {sector.poblacion == null ? 'sin dato censal' : `${formatearNumero(sector.poblacion)} habitantes`}
          </p>
          <Link to="/avisos" search={{ sector: sector.id }} aria-label={`Recibir avisos de ${nombre}`} className={estilos.avisosEsquina}>
            Recibir avisos
          </Link>
        </div>
      </header>

      <EstadoActual sector={sector} lectura={lectura} ahora={ahora} reintentar={reintentar} />

      <UltimoAviso sector={sector} ahora={ahora} />

      <section aria-label="Qué puedes hacer" className={estilos.acciones}>
        <Suspense fallback={<span className={estilos.reservaBoton} aria-hidden="true" />}>
          <Reporte sector={sector} />
        </Suspense>
      </section>

      <Historial sector={sector} ahora={ahora} />
    </article>
  )
}
