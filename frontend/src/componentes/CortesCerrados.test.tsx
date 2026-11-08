import { render, screen } from '@testing-library/react'
import type { Corte } from '../dominio/cortes'
import { CortesCerrados } from './CortesCerrados'

// 2026-10-25, 1:00 p. m. en Cartagena.
const AHORA = new Date('2026-10-25T18:00:00Z')

const corte = (inicio: string, finPrometido: string, hora: string): Corte => ({
  id: 'c1', sectoresAfectados: ['manga'], inicio, finPrometido, estado: 'RESTABLECIDO',
  cierres: [{ sectorId: 'manga', hora, fuente: 'VEEDOR', provisional: false }],
})

describe('CortesCerrados', () => {
  it('debePonerLasDosHorasPrimeroYLaDiferenciaEnPalabrasDespues', () => {
    // Prometido 4:00 p. m., volvió 11:10 a. m.; empezó a las 10:00 a. m. (hora de Cartagena).
    render(<CortesCerrados cortes={[corte('2026-10-24T15:00:00Z', '2026-10-24T21:00:00Z', '2026-10-24T16:10:00Z')]} sectorId="manga" ahora={AHORA} />)
    const horas = screen.getByRole('list').querySelector('dl')!
    const veredicto = screen.getByText('Volvió 4 horas y 45 minutos antes de lo prometido')
    expect(horas).toHaveTextContent('Prometieron4:00 p. m.')
    expect(horas).toHaveTextContent('Volvió11:10 a. m.')
    expect(horas.compareDocumentPosition(veredicto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(/corte por corte/)).not.toBeInTheDocument()
  })

  it('debeDecirLaFechaRealYNuncaMananaDeUnCorteQueYaCerro', () => {
    // El reloj de quien publica va un día adelantado (la simulación siempre simula «mañana»).
    render(<CortesCerrados cortes={[corte('2026-10-26T15:00:00Z', '2026-10-26T21:00:00Z', '2026-10-26T16:10:00Z')]} sectorId="manga" ahora={AHORA} />)
    expect(screen.queryByText(/mañana/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('lun 26 oct')).toHaveLength(2)
    expect(screen.getByText(/Empezó el lun 26 oct a las 10:00 a\. m\./)).toBeInTheDocument()
  })

  it('debeAcompanarHoyYAyerConLaFechaReal', () => {
    render(<CortesCerrados cortes={[corte('2026-10-24T15:00:00Z', '2026-10-24T21:00:00Z', '2026-10-25T16:10:00Z')]} sectorId="manga" ahora={AHORA} />)
    expect(screen.getByText('Ayer · sáb 24 oct')).toBeInTheDocument()
    expect(screen.getByText('Hoy · dom 25 oct')).toBeInTheDocument()
  })
})
