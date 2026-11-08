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
          <svg className={estilos.muestraMarca} width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
            <rect x="1" y="1" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          En disputa o por confirmar
        </li>
      )}
    </ul>
  )
}
