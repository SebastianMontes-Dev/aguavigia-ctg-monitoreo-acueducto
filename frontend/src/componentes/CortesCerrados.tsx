import { compararCorte, sinHoraRealEnPalabras, type Corte } from '../dominio/cortes'
import { diaRelativo, momento } from '../dominio/tiempo'
import estilos from './CortesCerrados.module.css'

interface Props {
  cortes: readonly Corte[]
  /** El barrio de la ficha: cada corte se compara con el cierre de este barrio y no con el de todo el corte. */
  sectorId?: string
  ahora: Date
}

/**
 * Guía §5.2: cada corte cerrado se cuenta con fechas y horas, no con duraciones que haya que restar. Primero el
 * veredicto en palabras; debajo, lo que se prometió y cuándo volvió el agua de verdad. Sin color de juicio. La causa
 * no se muestra: el texto del boletín llega tal cual salió de la fuente y se lee mal.
 */
export function CortesCerrados({ cortes, sectorId, ahora }: Props) {
  const filas = cortes.flatMap((corte) => {
    const comparacion = compararCorte(corte, sectorId)
    return comparacion ? [{ corte, comparacion }] : []
  })

  return (
    <>
      <p className={estilos.explicacion}>Lo que Acuacar anunció frente a lo que pasó, corte por corte.</p>
      <ol className={estilos.lista}>
        {filas.map(({ corte, comparacion }) => {
          return (
            <li key={corte.id} className={estilos.fila}>
              <p className={estilos.inicio}>
                <time dateTime={corte.inicio}>Corte que empezó {momento(corte.inicio!, ahora)}</time>
              </p>
              <p className={estilos.veredicto}>{comparacion.veredicto}</p>
              <dl className={estilos.marcas}>
                <div>
                  <dt><span className={`${estilos.marca} ${estilos.prometido}`} aria-hidden="true" />Prometieron</dt>
                  {' '}
                  <dd>
                    que el agua volvía <time dateTime={comparacion.prometidoEn}>{momento(comparacion.prometidoEn, ahora)}</time>
                  </dd>
                </div>
                <div>
                  <dt><span className={`${estilos.marca} ${estilos.real}`} aria-hidden="true" />Volvió</dt>
                  {' '}
                  <dd><time dateTime={comparacion.realEn}>{momento(comparacion.realEn, ahora)}</time></dd>
                </div>
              </dl>
              {comparacion.provisional && (
                <p className={estilos.porConfirmar}>Por confirmar: la hora real todavía puede cambiar.</p>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

/** Cortes que nunca tuvieron hora real (expirados o anulados): se dicen aparte, sin comparación. */
export function CortesSinHoraReal({ cortes, ahora }: { cortes: readonly Corte[]; ahora: Date }) {
  return (
    <ol className={estilos.lista}>
      {cortes.map((corte) => (
        <li key={corte.id} className={estilos.fila}>
          <p className={estilos.inicio}>
            {corte.inicio && <time dateTime={corte.inicio}>Corte del {diaRelativo(corte.inicio, ahora)}</time>}
          </p>
          <p className={estilos.veredicto}>{corte.estado === 'ANULADO' ? 'Corte anulado' : 'Corte sin cierre confirmado'}</p>
          <p className={estilos.detalle}>{sinHoraRealEnPalabras(corte)}</p>
        </li>
      ))}
    </ol>
  )
}
