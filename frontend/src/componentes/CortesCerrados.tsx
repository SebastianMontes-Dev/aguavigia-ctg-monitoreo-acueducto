import { cierreDe, compararCorte, fuenteEnPalabras, origenEnPalabras, sinHoraRealEnPalabras, type Comparacion, type Corte } from '../dominio/cortes'
import { diaRelativo } from '../dominio/tiempo'
import estilos from './CortesCerrados.module.css'

interface Props {
  cortes: readonly Corte[]
  /** El barrio de la ficha: cada corte se compara con el cierre de este barrio y no con el de todo el corte. */
  sectorId?: string
  ahora: Date
}

function Barras({ comparacion, escala }: { comparacion: Comparacion; escala: number }) {
  const prometido = comparacion.prometidoMs / escala
  const real = comparacion.realMs / escala
  const dentro = Math.min(prometido, real)
  return (
    <div className={estilos.barras} aria-hidden="true">
      <span className={estilos.prometido} style={{ width: `${prometido * 100}%` }} />
      <span className={estilos.real} style={{ width: `${dentro * 100}%` }} />
      {real > prometido && (
        <span className={estilos.exceso} style={{ left: `${prometido * 100}%`, width: `${(real - prometido) * 100}%` }} />
      )}
    </div>
  )
}

/**
 * Guía §5.2: comparación por corte con eje desde cero, prometido en contorno, real en relleno y el exceso con trama.
 * No se juzga con rojo ni verde: la diferencia va escrita.
 */
export function CortesCerrados({ cortes, sectorId, ahora }: Props) {
  const filas = cortes.flatMap((corte) => {
    const comparacion = compararCorte(corte, sectorId)
    return comparacion ? [{ corte, comparacion }] : []
  })
  const escala = Math.max(1, ...filas.map(({ comparacion }) => Math.max(comparacion.prometidoMs, comparacion.realMs)))

  return (
    <>
      <p className={estilos.claves} aria-hidden="true">
        <span><span className={`${estilos.muestra} ${estilos.muestraPrometido}`} /> Prometido</span>
        <span><span className={`${estilos.muestra} ${estilos.muestraReal}`} /> Real</span>
        <span><span className={`${estilos.muestra} ${estilos.muestraExceso}`} /> Tiempo de más</span>
      </p>
      <ol className={estilos.lista}>
        {filas.map(({ corte, comparacion }) => {
          const origen = origenEnPalabras(corte.origen)
          const fuente = sectorId ? fuenteEnPalabras(cierreDe(corte, sectorId)?.fuente) : null
          return (
            <li key={corte.id} className={estilos.fila}>
              <p className={estilos.cabeza}>
                <time dateTime={corte.inicio}>{diaRelativo(corte.inicio!, ahora)}</time>
                <strong>{comparacion.diferencia}{comparacion.provisional && ' · por confirmar'}</strong>
              </p>
              <Barras comparacion={comparacion} escala={escala} />
              <p className={estilos.detalle}>
                Prometieron {comparacion.prometido} · Fueron {comparacion.real}
                {origen && <><br />{origen}{corte.causa ? `: ${corte.causa}` : ''}</>}
                {fuente && <><br />Restablecimiento: {fuente.charAt(0).toLowerCase() + fuente.slice(1)}</>}
              </p>
            </li>
          )
        })}
      </ol>
    </>
  )
}

/** Cortes que nunca tuvieron hora real (expirados o anulados): se dicen aparte, sin barras ni comparación. */
export function CortesSinHoraReal({ cortes, ahora }: { cortes: readonly Corte[]; ahora: Date }) {
  return (
    <ol className={estilos.lista}>
      {cortes.map((corte) => (
        <li key={corte.id} className={estilos.fila}>
          <p className={estilos.cabeza}>
            {corte.inicio && <time dateTime={corte.inicio}>{diaRelativo(corte.inicio, ahora)}</time>}
            <strong>{corte.estado === 'ANULADO' ? 'Corte anulado' : 'Corte sin cierre confirmado'}</strong>
          </p>
          <p className={estilos.detalle}>{sinHoraRealEnPalabras(corte)}</p>
        </li>
      ))}
    </ol>
  )
}
