import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { Corte } from '../dominio/cortes'
import { IndiceCorte } from './IndiceCorte'

const prueba = vi.hoisted(() => ({
  respuesta: {} as object,
  pedidos: [] as { id: string; habilitado: boolean }[],
}))

vi.mock('../app/datos', () => ({
  useIndiceCorte: (id: string, habilitado: boolean) => {
    prueba.pedidos.push({ id, habilitado })
    return { refetch: vi.fn<() => void>(), ...prueba.respuesta }
  },
}))

const CORTE: Corte = { id: 'c9', sectoresAfectados: ['manga', 'pie-de-la-popa', 'el-cabrero'], estado: 'RESTABLECIDO', cierres: [] }
const INDICE = { duracionPrometidaSegundos: 14_400, duracionRealSegundos: 18_000, desviacionSegundos: 3600, porcentajeCumplimiento: 80, porcentajeProvisional: 50 }

function abrir() {
  const resumen = screen.getByText('Todo el corte (3 barrios)')
  const detalles = resumen.closest('details')!
  detalles.open = true
  fireEvent(detalles, new Event('toggle'))
}

afterEach(() => { prueba.respuesta = {}; prueba.pedidos = [] })

describe('IndiceCorte', () => {
  it('noDebeOfrecerseEnUnCorteDeUnSoloBarrio', () => {
    const { container } = render(<IndiceCorte corte={{ ...CORTE, sectoresAfectados: ['manga'] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('debePedirElIndiceSoloAlAbrirYDecirloConSuSignificadoYSuSolidez', () => {
    prueba.respuesta = { isPending: false, isError: false, data: INDICE }
    render(<IndiceCorte corte={CORTE} />)
    expect(prueba.pedidos).toHaveLength(0)
    abrir()
    expect(prueba.pedidos.at(-1)).toEqual({ id: 'c9', habilitado: true })
    expect(screen.getByText(/Índice 80/)).toBeInTheDocument()
    expect(screen.getByText(/lo anunciado cubrió el 80/)).toBeInTheDocument()
    expect(screen.getByText('El 50% de los cierres solo lo reportaron vecinos y aún puede corregirse.')).toBeInTheDocument()
  })

  it('debeExplicarUn409ComoUnCorteQueTodaviaNoSePuedeMedir', () => {
    prueba.respuesta = { isPending: false, isError: true, error: { estado: 409 }, data: undefined }
    render(<IndiceCorte corte={CORTE} />)
    abrir()
    expect(screen.getByText('Todavía no se puede medir: falta el cierre de algún barrio.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('debeOfrecerReintentarAnteUnErrorReal', () => {
    prueba.respuesta = { isPending: false, isError: true, error: { estado: 503 }, data: undefined }
    render(<IndiceCorte corte={CORTE} />)
    abrir()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos consultar el índice de este corte.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
