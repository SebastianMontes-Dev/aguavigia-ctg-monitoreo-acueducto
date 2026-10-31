import type { SaludDeColector } from '../dominio/ingesta'

/**
 * La salud de un colector no es un estado del servicio de agua: no usa sus colores (ADR-107, D1). Se distingue por la forma y la palabra
 * que va al lado; el glifo es decorativo para el lector de pantalla.
 */
export function GlifoSalud({ salud, tamano = 18 }: { salud: SaludDeColector; tamano?: 16 | 18 | 20 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {salud === 'activo' && (<><circle cx="10" cy="10" r="8" /><path d="m6.5 10.2 2.4 2.4 4.6-5" /></>)}
      {salud === 'con-fallos' && (<><path d="M10 2.5 18.2 16.8H1.8Z" /><path d="M10 8v4M10 14.4v.1" /></>)}
      {salud === 'caido' && (<><rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="currentColor" stroke="none" /><path d="m7 7 6 6M13 7l-6 6" stroke="var(--tarjeta)" /></>)}
      {salud === 'sin-ciclos' && (<><circle cx="10" cy="10" r="8" strokeDasharray="3 3" /><path d="M7 10h6" /></>)}
    </svg>
  )
}
