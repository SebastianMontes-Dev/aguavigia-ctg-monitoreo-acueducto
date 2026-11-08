import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Moderacion } from './Moderacion'

const estado = vi.hoisted(() => ({
  permisos: new Set<string>(['VER_PANEL', 'MODERAR_REPORTES']),
  reportes: [] as object[],
  moderar: undefined as undefined | ((id: string, accion: string) => Promise<unknown>),
  cargando: false,
}))

vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-10-30T20:00:00Z') }))
vi.mock('../../app/panel', () => ({ usePermisos: () => estado.permisos }))
vi.mock('../../app/paleta', () => ({ usePaletaGrafito: () => undefined }))
vi.mock('../../api/moderacion', () => ({ moderarReporte: (id: string, accion: string) => estado.moderar?.(id, accion) }))
vi.mock('../../app/datos-panel', async (importar) => ({
  ...(await importar<typeof import('../../app/datos-panel')>()),
  usePendientes: () => ({
    isPending: estado.cargando,
    isError: false,
    hasNextPage: false,
    data: estado.cargando ? undefined : { pages: [{ reportes: estado.reportes, paginacion: { total: estado.reportes.length } }] },
    refetch: vi.fn<() => void>(),
  }),
  useBarriosPanel: () => ({ data: [{ id: 'manga', nombre: 'MANGA' }, { id: 'crespo', nombre: 'CRESPO' }] }),
  useFotoPanel: () => ({ data: 'data:image/jpeg;base64,AAAA', isError: false }),
}))

const reportes = [
  { id: 'r1', sectorId: 'manga', tipo: 'SIN_AGUA', timestamp: '2026-10-30T17:00:00Z', estadoModeracion: 'PENDIENTE', verificacion: 'UBICACION_VERIFICADA', fotoEstado: 'EN_REVISION', fotoUrl: '/api/veedor/fotos/a.jpg', senalRed: true },
  { id: 'r2', sectorId: 'crespo', tipo: 'PRESION_BAJA', timestamp: '2026-10-30T18:00:00Z', estadoModeracion: 'PENDIENTE', verificacion: 'NINGUNA', fotoEstado: 'SIN_FOTO', senalRed: false },
]

function pintar() {
  return render(<QueryClientProvider client={new QueryClient()}><Moderacion /></QueryClientProvider>)
}

describe('Moderación', () => {
  beforeEach(() => {
    estado.permisos = new Set(['VER_PANEL', 'MODERAR_REPORTES'])
    estado.reportes = reportes
    estado.cargando = false
    estado.moderar = () => Promise.resolve({ tipo: 'hecho', dato: {} })
  })

  it('debeTitularConLaCantidadYMostrarBarrioTipoVerificacionYSenalDeRed', () => {
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 reportes por revisar')
    expect(screen.getByText('Manga')).toBeInTheDocument()
    expect(screen.getByText(/No tiene agua/)).toBeInTheDocument()
    expect(screen.getByText('Ubicación verificada dentro del barrio')).toBeInTheDocument()
    // Es una señal para mirar primero, no una acusación.
    expect(screen.getAllByText(/ráfaga de reportes a este barrio\. Míralo primero\./)).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Foto del reporte en Manga' })).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA')
    expect(screen.getByText(/Foto en revisión/)).toBeInTheDocument()
  })

  it('debeDecirQueNoHayReportesConLaColaVacia', () => {
    estado.reportes = []
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('No hay reportes por revisar')
    expect(screen.getByText('No hay reportes pendientes')).toBeInTheDocument()
  })

  it('noDebeMostrarBotonesDeAccionAUnObservador', () => {
    estado.permisos = new Set(['VER_PANEL'])
    pintar()
    expect(screen.queryByRole('button', { name: /Aprobar|Descartar/ })).not.toBeInTheDocument()
    expect(screen.getByText(/no decidir sobre los reportes/)).toBeInTheDocument()
    expect(screen.getByText('Manga')).toBeInTheDocument()
  })

  it('soloDebeOfrecerDescartarLaFotoDeUnReporteConFoto', () => {
    pintar()
    expect(screen.getAllByRole('button', { name: 'Descartar solo la foto' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(2)
  })

  it('debePedirConfirmacionAntesDeAprobarYNoEnviarSiSeCancela', async () => {
    const usuario = userEvent.setup()
    const moderar = vi.fn<(id: string, accion: string) => Promise<unknown>>().mockResolvedValue({ tipo: 'hecho', dato: {} })
    estado.moderar = moderar
    pintar()
    await usuario.click(screen.getAllByRole('button', { name: 'Aprobar' })[0]!)
    expect(screen.getByText(/su foto pasa a ser pública/)).toBeInTheDocument()
    expect(moderar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/su foto pasa a ser pública/)).not.toBeInTheDocument()
    expect(moderar).not.toHaveBeenCalled()
  })

  it('debeEnviarUnaSolaVezAunqueSePulseDosVecesLaConfirmacion', async () => {
    const usuario = userEvent.setup()
    let terminar: (valor: unknown) => void = () => undefined
    const moderar = vi.fn<(id: string, accion: string) => Promise<unknown>>().mockImplementation(() => new Promise((resolver) => { terminar = resolver }))
    estado.moderar = moderar
    pintar()
    await usuario.click(screen.getAllByRole('button', { name: 'Aprobar' })[0]!)
    const confirmar = screen.getByRole('button', { name: 'Sí, aprobar' })
    await usuario.dblClick(confirmar)
    expect(moderar).toHaveBeenCalledTimes(1)
    expect(moderar).toHaveBeenCalledWith('r1', 'aprobar')
    expect(screen.getByRole('button', { name: 'Aprobando…' })).toBeDisabled()
    terminar({ tipo: 'hecho', dato: {} })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobando…' })).not.toBeInTheDocument())
  })

  it('debeExplicarEnLaPaginaQueOtraPersonaYaDecidioElReporte', async () => {
    const usuario = userEvent.setup()
    estado.moderar = () => Promise.resolve({ tipo: 'conflicto' })
    pintar()
    const fila = screen.getAllByRole('listitem')[1]!
    await usuario.click(within(fila).getByRole('button', { name: 'Descartar' }))
    await usuario.click(within(fila).getByRole('button', { name: 'Sí, descartar' }))
    // El reporte ya no es de la cola: su fila se va y el aviso queda arriba, en la página.
    expect(await screen.findByRole('alert')).toHaveTextContent('Este reporte ya fue decidido por otra persona')
  })

  it('debeDejarElBotonDeNuevoLibreTrasUnFalloDeRedParaReintentarAMano', async () => {
    const usuario = userEvent.setup()
    estado.moderar = () => Promise.resolve({ tipo: 'sin-red' })
    pintar()
    const fila = screen.getAllByRole('listitem')[1]!
    await usuario.click(within(fila).getByRole('button', { name: 'Aprobar' }))
    await usuario.click(within(fila).getByRole('button', { name: 'Sí, aprobar' }))
    expect(await within(fila).findByRole('alert')).toHaveTextContent('No pudimos conectar')
    expect(within(fila).getByRole('button', { name: 'Aprobar' })).toBeEnabled()
  })
})
