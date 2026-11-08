import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { bitacoraDeEjemplo } from '../../pruebas/datos/historia'
import { sectoresDeEjemplo } from '../../pruebas/datos/sectores'
import { Bitacora } from './Bitacora'

const estado = vi.hoisted(() => ({ error: false, fallo: false, vacio: false, sustentoAbierto: false, extras: [] as object[], sector: undefined as string | undefined }))

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => (estado.sector ? { sector: estado.sector } : {}),
  useNavigate: () => vi.fn<() => void>(),
  Link: ({ children, className, to }: { children: unknown; className?: string; to?: string }) => <a href={to} className={className}>{children as never}</a>,
}))
// 15:00 en Cartagena: los eventos del 25 son «Hoy» y el del 24, «Ayer».
vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-09-25T20:00:00Z') }))
vi.mock('../../app/datos', () => ({
  useListado: () => ({ sectores: sectoresDeEjemplo.sectores, lectura: { error: false }, reintentar: vi.fn<() => void>() }),
  useBitacora: () => estado.error
    ? { isPending: false, isError: true, error: { estado: 400 }, data: undefined }
    : estado.fallo
      ? { isPending: false, isError: true, error: { estado: 503 }, data: undefined, refetch: vi.fn<() => void>() }
      : { isPending: false, isError: false, error: null, hasNextPage: false, data: { pages: [{ eventos: estado.vacio ? [] : [...bitacoraDeEjemplo, ...estado.extras], paginacion: { total: estado.vacio ? 0 : 6 } }] } },
  useConteosBitacora: () => ({ CORTE_ANUNCIADO: 2, CORTE_RESTABLECIDO: 2, CORTE_CONFIRMADO_POR_CIUDADANOS: 1, CORTE_DETECTADO_POR_INGESTA: 1 }),
  useTotalBitacora: () => ({ data: 6 }),
  useUltimoBoletin: () => ({ data: null }),
  useSustento: (_id: string, abierto: boolean) => {
    estado.sustentoAbierto = abierto
    return { isPending: !abierto, isError: false, data: abierto ? { pages: [{ ids: ['reporte-1'] }] } : undefined, hasNextPage: false }
  },
}))

describe('Bitácora', () => {
  afterEach(() => { estado.error = false; estado.fallo = false; estado.vacio = false; estado.sustentoAbierto = false; estado.extras = []; estado.sector = undefined })

  it('debeTitularConElUltimoCambioYAgruparPorDia', () => {
    render(<Bitacora />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('El último cambio fue hace 30 min')
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ayer' })).toBeInTheDocument()
    expect(screen.getByText(/6 eventos/)).toBeInTheDocument()
  })

  it('debeMostrarLosTiposComoPestanasConSuCantidad', () => {
    render(<Bitacora />)
    expect(screen.getByRole('button', { name: 'Todos 6' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Anunciados 2' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'En boletines 1' })).toBeInTheDocument()
  })

  it('soloDebeOfrecerPestanasParaLosCuatroTiposQueLaApiDejaFiltrar', () => {
    render(<Bitacora />)
    // Con otro valor de `tipo` el servidor responde 400: los cinco tipos nuevos se ven en la lista, no en los filtros.
    expect(screen.getAllByRole('button', { name: /^(Todos|Anunciados|Restablecidos|Confirmados por vecinos|En boletines) \d+$/ })).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /Anulados|En disputa|Consensos revertidos/ })).not.toBeInTheDocument()
  })

  it('debeNombrarCadaUnoDeLosCincoTiposNuevosEnLaLista', () => {
    estado.extras = ['CORTE_EXPIRADO', 'CORTE_ANULADO', 'RESTABLECIMIENTO_POR_VECINOS', 'ESTADO_EN_DISPUTA', 'CONSENSO_REVERTIDO']
      .map((tipo, i) => ({ id: `evt-n${i}`, tipo, timestamp: '2026-09-25T19:40:00Z', descripcion: `Evento ${tipo}` }))
    render(<Bitacora />)
    // ADR-104: lo que pasó en palabras del vecino, según el tipo.
    for (const nombre of ['Nadie confirmó si volvió el agua', 'Se retiró un corte publicado por error', 'Volvió el agua', 'Los vecinos reportan algo distinto', 'Se retiró lo que confirmaron los vecinos']) {
      expect(screen.getAllByText(nombre).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('Evento registrado')).not.toBeInTheDocument()
  })

  it('debeMostrarUnTipoDesconocidoConTextoNeutroEnVezDeDescartarlo', () => {
    estado.extras = [{ id: 'evt-x', tipo: 'TIPO_FUTURO', timestamp: '2026-09-25T19:45:00Z', descripcion: 'Algo que el backend añadió después' }]
    render(<Bitacora />)
    expect(screen.getByText('Evento registrado')).toBeInTheDocument()
    expect(screen.getByText('Algo que el backend añadió después')).toBeInTheDocument()
  })

  it('debeMostrarLaFuenteYElRespaldoDeUnEventoDeQuorum', () => {
    estado.extras = [{
      id: 'evt-q', tipo: 'RESTABLECIMIENTO_POR_VECINOS', timestamp: '2026-09-25T19:50:00Z', sectorId: 'torices',
      descripcion: 'Vecinos confirman', estado: 'CON_SERVICIO', fuente: 'VECINOS', respaldo: { vecinos: 11, umbral: 12 },
    }]
    render(<Bitacora />)
    const evento = screen.getByText('Lo confirmaron 11 vecinos (hacían falta 12)').closest('li')!
    expect(evento).toHaveTextContent('Torices · Volvió el agua')
    expect(evento).toHaveTextContent('Lo confirmaron 11 vecinos (hacían falta 12)')
    // La descripción del backend solo repetiría lo mismo: no se muestra.
    expect(evento).not.toHaveTextContent('Vecinos confirman')
  })

  it('noDebeRepetirEnCadaFilaElBarrioFiltrado', () => {
    estado.sector = 'torices'
    estado.extras = [{
      id: 'evt-q', tipo: 'RESTABLECIMIENTO_POR_VECINOS', timestamp: '2026-09-25T19:50:00Z', sectorId: 'torices',
      estado: 'CON_SERVICIO', fuente: 'VECINOS', respaldo: { vecinos: 11, umbral: 12 },
    }]
    render(<Bitacora />)
    expect(screen.getByText(/^Bitácora · Torices/)).toBeInTheDocument()
    const evento = screen.getByText('Lo confirmaron 11 vecinos (hacían falta 12)').closest('li')!
    expect(evento).toHaveTextContent('Volvió el agua')
    expect(evento).not.toHaveTextContent('Torices ·')
  })

  it('soloDebeEnlazarLaFuenteOriginalSiEsHttpOHttps', () => {
    estado.extras = [
      { id: 'evt-j', tipo: 'CORTE_DETECTADO_POR_INGESTA', timestamp: '2026-09-25T19:00:00Z', descripcion: 'Malo', urlOriginal: 'javascript:alert(1)' },
      { id: 'evt-h', tipo: 'CORTE_DETECTADO_POR_INGESTA', timestamp: '2026-09-25T18:50:00Z', descripcion: 'Bueno', urlOriginal: 'https://www.acuacar.com/boletin/2' },
    ]
    render(<Bitacora />)
    const enlaces = screen.getAllByRole('link', { name: 'Boletín de Acuacar' })
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toContain('https://www.acuacar.com/boletin/2')
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).not.toContain('javascript:alert(1)')
  })

  it('noDebeAtribuirUnaFuenteDesconocida', () => {
    estado.extras = [{ id: 'evt-f', tipo: 'CORTE_ANULADO', timestamp: '2026-09-25T19:55:00Z', descripcion: 'Retirado', fuente: 'OTRA' }]
    render(<Bitacora />)
    expect(screen.queryByText('OTRA')).not.toBeInTheDocument()
  })

  it('noDebeNombrarLoQueNoExiste', () => {
    render(<Bitacora />)
    expect(screen.queryByText('Sin enlace a la fuente')).not.toBeInTheDocument()
    expect(screen.queryByText('Informativo')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Boletín de Acuacar' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Ver sustento/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Ver sustento: 5 reportes' })).toBeInTheDocument()
  })

  it('debeAbrirElSustentoSoloTrasLaAccion', async () => {
    render(<Bitacora />)
    expect(estado.sustentoAbierto).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Ver sustento: 5 reportes' }))
    expect(estado.sustentoAbierto).toBe(true)
    expect(screen.getByText('reporte-1')).toBeInTheDocument()
  })

  it('debeSituarElErrorDeFiltroJuntoALosFiltros', () => {
    estado.error = true
    render(<Bitacora />)
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa las fechas')
    expect(screen.queryByText('No pudimos consultar la bitácora')).not.toBeInTheDocument()
  })

  it('debeExplicarLaAusenciaDeEventosFiltrados', () => {
    estado.vacio = true
    render(<Bitacora />)
    expect(screen.getByText('No hay eventos con esos filtros')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cada cambio del agua, con su fuente')
  })

  it('debeOfrecerReintentarAnteUnErrorReal', () => {
    estado.fallo = true
    render(<Bitacora />)
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos consultar la bitácora')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
