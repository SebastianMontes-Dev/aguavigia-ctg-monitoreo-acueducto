import { GlifoEstado } from '../componentes/GlifoEstado'
import { ORDEN_ESTADOS, presentarEstado } from '../dominio/estados'
import estilos from './Mapa.module.css'

/** La marca de disputa o por confirmar solo entra a la leyenda si algún barrio la lleva (`identidad.md` §4.1: sin ruido). */
export function Leyenda({ conMarca = false }: { conMarca?: boolean }) {
  return (
    <ul className={estilos.leyenda} aria-label="Leyenda del mapa">
      {[...ORDEN_ESTADOS, null].map((estado) => (
        <li key={estado ?? 'SIN_DATOS'}>
          <GlifoEstado estado={estado} tamano={16} />
          {presentarEstado(estado).texto}
        </li>
      ))}
      {conMarca && (
        <li>
          <span className={estilos.muestraMarca} aria-hidden="true" />
          En disputa o por confirmar
        </li>
      )}
    </ul>
  )
}
