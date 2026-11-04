import { useModoSistema } from '../app/datos'
import estilos from './FranjaSimulacion.module.css'

/** Una simulación nunca se presenta como real (F4): `GET /api/sistema/modo` dice `SIMULACION` y la franja se queda en todas las pantallas. */
export function useEnSimulacion(): boolean {
  return useModoSistema().data?.modo === 'SIMULACION'
}

/** La franja fija de la simulación. `className` deja que el marco público la pegue a su cabecera; sin él, va como bloque al tope de la pantalla. */
export function FranjaSimulacion({ className }: { className?: string }) {
  const simulacion = useEnSimulacion()
  if (!simulacion) return null
  return (
    <output className={className ?? estilos.franja}>
      <strong>Simulación.</strong> Datos de una simulación; no son reales.
    </output>
  )
}
