import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Auditoria } from './Auditoria'

const estado = vi.hoisted(() => ({
  permisos: new Set<string>(['VER_PANEL', 'VER_AUDITORIA']),
  consulta: {} as { isPending?: boolean; isError?: boolean; data?: object; error?: unknown },
  pagina: 0,
}))

vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-10-31T20:00:00Z') }))
vi.mock('../../app/paleta', () => ({ usePaletaGrafito: () => undefined }))
vi.mock('../../app/panel', () => ({ usePermisos: () => estado.permisos }))
vi.mock('@tanstack/react-query', async (importar) => ({ ...(await importar<typeof import('@tanstack/react-query')>()), useQueryClient: () => ({ invalidateQueries: vi.fn<() => void>() }) }))
vi.mock('../../app/datos-panel', () => ({
  useAuditoria: (pagina: number) => {
    estado.pagina = pagina
    return { isPending: false, isError: false, isFetching: false, refetch: vi.fn<() => void>(), ...estado.consulta }
  },
}))

const pagina = (eventos: object[], hayMas = false) => ({ eventos, paginacion: { total: eventos.length, paginas: hayMas ? 2 : 1, pagina: 0, hayMas } })
const evento = { id: 'e1', accion: 'CUENTA_SUSPENDIDA', autorCorreo: 'ana@example.com', sujetoCorreo: 'luis@example.com', detalle: 'Suspensión manual', ip: '10.0.0.7', ocurrioEn: '2026-10-31T19:30:00Z' }

describe('Auditoría', () => {
  beforeEach(() => {
    estado.permisos = new Set(['VER_PANEL', 'VER_AUDITORIA'])
    estado.consulta = { data: pagina([evento]) }
  })

  it('debeMostrarCadaColumnaDelAsientoYLaUltimaAccionEnElTitular', () => {
    render(<Auditoria />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Última acción: se suspendió una cuenta, hace 30 min')
    const fila = within(screen.getByRole('row', { name: /Se suspendió una cuenta/ }))
    expect(fila.getByText('ana@example.com')).toBeInTheDocument()
    expect(fila.getByText('luis@example.com')).toBeInTheDocument()
    expect(fila.getByText('Suspensión manual')).toBeInTheDocument()
    expect(fila.getByText('10.0.0.7')).toBeInTheDocument()
  })

  it('debeSerSoloLecturaSinBotonesQueEditenOBorren', () => {
    render(<Auditoria />)
    expect(screen.queryByRole('button', { name: /Editar|Borrar|Eliminar/ })).not.toBeInTheDocument()
    expect(screen.getByText(/el registro solo se anexa/)).toBeInTheDocument()
  })

  it('debeDecirQueActuoElSistemaCuandoNoHayAutor', () => {
    estado.consulta = { data: pagina([{ ...evento, autorCorreo: undefined }]) }
    render(<Auditoria />)
    expect(screen.getByText('El sistema o alguien sin sesión')).toBeInTheDocument()
  })

  it('debeMostrarElVacio', () => {
    estado.consulta = { data: pagina([]) }
    render(<Auditoria />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Todavía no hay acciones registradas')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('debeMostrarElErrorConReintento', () => {
    estado.consulta = { isError: true, data: undefined, error: { estado: 500 } }
    render(<Auditoria />)
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos consultar la auditoría')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('debeMostrarAccesoDenegadoSinElPermiso', () => {
    estado.permisos = new Set(['VER_PANEL'])
    render(<Auditoria />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu cuenta no puede ver la auditoría')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('debeMostrarAccesoDenegadoSiElServidorResponde403', () => {
    estado.consulta = { isError: true, data: undefined, error: { estado: 403, tipo: 'acceso-denegado' } }
    render(<Auditoria />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu cuenta no puede ver la auditoría')
  })

  it('debePasarDePaginaConSiguiente', async () => {
    const usuario = userEvent.setup()
    estado.consulta = { data: pagina([evento], true) }
    render(<Auditoria />)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(estado.pagina).toBe(1)
  })
})
