import { compararCorte, sinHoraRealEnPalabras, type Corte } from '../dominio/cortes'
import { diaRelativo, momento, partirHora } from '../dominio/tiempo'
import estilos from './CortesCerrados.module.css'

interface Props {
  cortes: readonly Corte[]
  /** El barrio de la ficha: cada corte se compara con el cierre de este barrio y no con el de todo el corte. */
  sectorId?: string
  ahora: Date
}

/** La hora grande y su día debajo, como en «Inicio anunciado / Fin prometido» del corte abierto (`ADR-101`). */
function Marca({ rotulo, valor, ahora, tipo }: { rotulo: string; valor: string; ahora: Date; tipo: 'prometido' | 'real' }) {
  const { cifra, periodo } = partirHora(valor)
  return (
    <div className={estilos.marca}>
      <dt className={estilos.rotulo}>
        <span className={`${estilos.punto} ${estilos[tipo]}`} aria-hidden="true" />
        {rotulo}
      </dt>
      <dd>
        <time dateTime={valor} className={estilos.cifra}>
          <span className="cifra">{cifra}</span> <span className={estilos.periodo}>{periodo}</span>
        </time>
        <span className={estilos.dia}>{diaRelativo(valor, ahora)}</span>
      </dd>
    </div>
  )
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
                <Marca rotulo="Prometieron" valor={comparacion.prometidoEn} ahora={ahora} tipo="prometido" />
                <Marca rotulo="Volvió" valor={comparacion.realEn} ahora={ahora} tipo="real" />
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
