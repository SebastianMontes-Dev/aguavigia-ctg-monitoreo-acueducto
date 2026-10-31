import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Ingesta } from './Ingesta'

type Respuesta = Promise<unknown>

const estado = vi.hoisted(() => ({
  permisos: new Set<string>(['VER_PANEL', 'REVISAR_INGESTA']),
  propuestas: [] as object[],
  salud: { data: [] as object[] | undefined, isError: false },
  fallidos: { data: [] as object[] | undefined, isError: false },
  aprobar: undefined as undefined | ((id: string) => Respuesta),
  descartar: undefined as undefined | ((id: string) => Respuesta),
  anular: undefined as undefined | ((id: string, motivo: string) => Respuesta),
}))

vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-10-30T20:00:00Z') }))
vi.mock('../../app/panel', () => ({ usePermisos: () => estado.permisos }))
vi.mock('../../app/paleta', () => ({ usePaletaGrafito: () => undefined }))
vi.mock('../../api/ingesta', () => ({
  aprobarPropuesta: (id: string) => estado.aprobar?.(id),
  descartarPropuesta: (id: string) => estado.descartar?.(id),
  anularPropuesta: (id: string, motivo: string) => estado.anular?.(id, motivo),
}))
vi.mock('../../app/datos-panel', async (importar) => ({
  ...(await importar<typeof import('../../app/datos-panel')>()),
  usePropuestas: () => ({
    isPending: false,
    isError: false,
    hasNextPage: false,
    data: { pages: [{ propuestas: estado.propuestas, paginacion: { total: estado.propuestas.length } }] },
    refetch: vi.fn<() => void>(),
  }),
  useBarriosPanel: () => ({ data: [{ id: 'manga', nombre: 'MANGA', estado: 'CON_SERVICIO' }, { id: 'crespo', nombre: 'CRESPO', estado: 'SIN_SERVICIO' }], isFetching: false }),
  useSaludColectores: () => ({ isPending: false, isError: estado.salud.isError, data: estado.salud.data, dataUpdatedAt: 0, refetch: vi.fn<() => void>() }),
  useFallidos: () => ({ isPending: false, isError: estado.fallidos.isError, data: estado.fallidos.data, dataUpdatedAt: 0, refetch: vi.fn<() => void>() }),
}))

const conCita = {
  id: 'p1', sectorId: 'manga', estadoPropuesto: 'SIN_SERVICIO', fuente: 'acuacar', urlOriginal: 'https://www.acuacar.com/aviso-1',
  citaTextual: 'El servicio se suspenderá en Manga de 8:00 a. m. a 4:00 p. m.', confianza: 0.45, detectadaEn: '2026-10-30T18:00:00Z', estadoRevision: 'PENDIENTE',
  inicioDeclarado: '2026-10-30T13:00:00Z', finPrometido: '2026-10-30T21:00:00Z', motivoDeRevision: 'Confianza baja',
}
const sinEvidencia = {
  id: 'p2', sectorId: 'crespo', estadoPropuesto: 'PRESION_BAJA', fuente: 'zona-cero', urlOriginal: null, citaTextual: '', confianza: 0.3,
  detectadaEn: '2026-10-30T19:00:00Z', estadoRevision: 'PENDIENTE', inicioDeclarado: null, finPrometido: null, motivoDeRevision: null,
}

function pintar() {
  return render(<QueryClientProvider client={new QueryClient()}><Ingesta /></QueryClientProvider>)
}
const filaDe = (barrio: string) => screen.getByText(barrio, { selector: 'strong' }).closest('li') as HTMLElement

describe('Ingesta', () => {
  beforeEach(() => {
    estado.permisos = new Set(['VER_PANEL', 'REVISAR_INGESTA'])
    estado.propuestas = [conCita, sinEvidencia]
    estado.salud = { data: [], isError: false }
    estado.fallidos = { data: [], isError: false }
    estado.aprobar = () => Promise.resolve({ tipo: 'hecho', dato: { ...conCita, estadoRevision: 'APROBADA' } })
    estado.descartar = () => Promise.resolve({ tipo: 'hecho', dato: { ...conCita, estadoRevision: 'DESCARTADA' } })
    estado.anular = () => Promise.resolve({ tipo: 'hecho', dato: { ...conCita, estadoRevision: 'ANULADA' } })
  })

  it('debeMostrarLaCitaTalComoLlegoElEnlaceYElMotivoJuntoALosBotones', () => {
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 propuestas esperan tu decisión')
    const fila = within(filaDe('Manga'))
    expect(fila.getByText('El servicio se suspenderá en Manga de 8:00 a. m. a 4:00 p. m.')).toBeInTheDocument()
    expect(fila.getByRole('link', { name: /Abrir el original en acuacar\.com/ })).toHaveAttribute('href', 'https://www.acuacar.com/aviso-1')
    expect(fila.getByText('Confianza baja')).toBeInTheDocument()
    expect(fila.getByText('acuacar')).toBeInTheDocument()
    expect(fila.getByRole('button', { name: 'Aprobar la propuesta de Manga' })).toBeEnabled()
    expect(fila.getByRole('button', { name: 'Descartar la propuesta de Manga' })).toBeEnabled()
  })

  it('debeDecirQueFaltanLaCitaYLaFuenteSinInventarlasYNoOfrecerAprobar', () => {
    pintar()
    const fila = within(filaDe('Crespo'))
    expect(fila.getByText(/no trae la frase del boletín/)).toBeInTheDocument()
    expect(fila.getByText('Sin enlace al original')).toBeInTheDocument()
    expect(fila.getByText(/el servidor no indicó el motivo/)).toBeInTheDocument()
    expect(fila.getByText('No declara una ventana horaria.')).toBeInTheDocument()
    expect(fila.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument()
    expect(fila.getByRole('button', { name: /Descartar/ })).toBeEnabled()
    expect(fila.queryByRole('link')).not.toBeInTheDocument()
  })

  it('noDebeMostrarBotonesDeAccionAUnObservador', () => {
    estado.permisos = new Set(['VER_PANEL'])
    pintar()
    expect(screen.queryByRole('button', { name: /Aprobar|Descartar|Anular/ })).not.toBeInTheDocument()
    expect(screen.getAllByText(/faltan permisos de revisión/).length).toBeGreaterThan(0)
    expect(screen.getByText(/El servicio se suspenderá en Manga/)).toBeInTheDocument()
  })

  it('debePedirConfirmacionAntesDeAprobarYNoEnviarSiSeCancela', async () => {
    const usuario = userEvent.setup()
    const aprobar = vi.fn<(id: string) => Respuesta>().mockResolvedValue({ tipo: 'hecho', dato: conCita })
    estado.aprobar = aprobar
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar la propuesta de Manga' }))
    expect(screen.getByText(/«Sin servicio» se aplica a Manga/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aprobar).not.toHaveBeenCalled()
    expect(screen.queryByText(/se aplica a Manga/)).not.toBeInTheDocument()
  })

  it('debeAvisarEnLaConfirmacionQueUnaPropuestaSinVentanaPuedeNoCambiarElMapa', async () => {
    estado.propuestas = [{ ...conCita, inicioDeclarado: null, finPrometido: null }]
    const usuario = userEvent.setup()
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar la propuesta de Manga' }))
    expect(screen.getByText(/no declara ventana horaria: el estado del barrio puede quedar como está/)).toBeInTheDocument()
  })

  it('debePasarLaAprobadaAResueltasConAnularYDecirQueElMapaNoCambio', async () => {
    const usuario = userEvent.setup()
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar la propuesta de Manga' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, aprobar' }))
    const resueltas = await screen.findByRole('heading', { name: 'Resueltas en esta visita' })
    const fila = within(resueltas.parentElement as HTMLElement)
    expect(fila.getByText('Aprobada')).toBeInTheDocument()
    // Manga sigue «Con servicio» en el mapa: aprobar respondió 200 sin cambiarlo y la pantalla lo dice.
    expect(fila.getByText(/Aprobar no siempre cambia el mapa: ahora Manga muestra «Con servicio»/)).toBeInTheDocument()
    expect(fila.getByRole('button', { name: 'Anular la aprobación' })).toBeEnabled()
    expect(fila.queryByRole('button', { name: /^(Aprobar|Descartar)/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('1 propuesta espera tu decisión')
  })

  it('debeEnviarUnaSolaVezAunqueSePulseDosVecesLaConfirmacion', async () => {
    const usuario = userEvent.setup()
    let terminar: (valor: unknown) => void = () => undefined
    const aprobar = vi.fn<(id: string) => Respuesta>().mockImplementation(() => new Promise((resolver) => { terminar = resolver }))
    estado.aprobar = aprobar
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar la propuesta de Manga' }))
    await usuario.dblClick(screen.getByRole('button', { name: 'Sí, aprobar' }))
    expect(aprobar).toHaveBeenCalledTimes(1)
    expect(aprobar).toHaveBeenCalledWith('p1')
    expect(screen.getByRole('button', { name: 'Aprobando…' })).toBeDisabled()
    terminar({ tipo: 'hecho', dato: { ...conCita, estadoRevision: 'APROBADA' } })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobando…' })).not.toBeInTheDocument())
  })

  it('debeDescartarYDecirQueNoTocoElBarrio', async () => {
    const usuario = userEvent.setup()
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Descartar la propuesta de Manga' }))
    expect(screen.getByText(/No toca Manga/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Sí, descartar' }))
    expect(await screen.findByText('Descartada')).toBeInTheDocument()
    expect(screen.getByText(/No tocó Manga: queda archivada/)).toBeInTheDocument()
  })

  it('debeExplicarElConflictoEnLaPaginaSiLaPropuestaYaFueDecididaPorOtraPersona', async () => {
    const usuario = userEvent.setup()
    estado.aprobar = () => Promise.resolve({ tipo: 'conflicto' })
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar la propuesta de Manga' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, aprobar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('la propuesta ya fue descartada')
  })

  it('debeExigirElMotivoParaAnularYEnviarloRecortado', async () => {
    const usuario = userEvent.setup()
    const anular = vi.fn<(id: string, motivo: string) => Respuesta>().mockResolvedValue({ tipo: 'hecho', dato: { ...conCita, estadoRevision: 'ANULADA' } })
    estado.anular = anular
    estado.propuestas = [{ ...conCita, estadoRevision: 'PENDIENTE' }]
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar la propuesta de Manga' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, aprobar' }))
    await usuario.click(await screen.findByRole('button', { name: 'Anular la aprobación' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, anular la aprobación' }))
    expect(await screen.findByText('Escribe por qué se anula la aprobación.')).toBeInTheDocument()
    expect(anular).not.toHaveBeenCalled()
    await usuario.type(screen.getByLabelText('Motivo de la anulación'), '  Era de otro barrio ')
    await usuario.click(screen.getByRole('button', { name: 'Sí, anular la aprobación' }))
    await waitFor(() => expect(anular).toHaveBeenCalledWith('p1', 'Era de otro barrio'))
    expect(await screen.findByText('Anulada')).toBeInTheDocument()
  })

  it('debeDecirQueNoHayPropuestasConLaColaVacia', () => {
    estado.propuestas = []
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('No hay propuestas por revisar')
    expect(screen.getByText('No hay propuestas pendientes')).toBeInTheDocument()
  })
})

describe('Ingesta: salud y documentos fallidos', () => {
  beforeEach(() => {
    estado.permisos = new Set(['VER_PANEL'])
    estado.propuestas = []
  })

  it('debeDecirConPalabrasQueUnColectorEstaCaidoYMostrarSusCifras', () => {
    estado.salud = {
      isError: false,
      data: [
        { nombre: 'zona-cero', fallosConsecutivos: 0, ultimaEjecucionExitosa: '2026-10-30T19:50:00Z', tasaDeError: 0.1, itemsProcesados: 40 },
        { nombre: 'acuacar', fallosConsecutivos: 3, ultimaEjecucionExitosa: '2026-10-30T15:00:00Z', ultimoFallo: '2026-10-30T19:00:00Z', motivoDelUltimoFallo: 'Tiempo de espera agotado', tasaDeError: 0.5 },
      ],
    }
    pintar()
    const salud = within(screen.getByRole('region', { name: 'Salud de los colectores' }))
    const filas = salud.getAllByRole('listitem')
    // Los caídos van primero.
    expect(within(filas[0]!).getByText('acuacar')).toBeInTheDocument()
    expect(within(filas[0]!).getByText('Caído')).toBeInTheDocument()
    expect(within(filas[0]!).getByText('3', { selector: 'dd' })).toBeInTheDocument()
    expect(within(filas[0]!).getByText('50%')).toBeInTheDocument()
    expect(within(filas[0]!).getByText('Tiempo de espera agotado')).toBeInTheDocument()
    expect(within(filas[1]!).getByText('Activo')).toBeInTheDocument()
    expect(within(filas[1]!).getByText('Nunca', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('1 colector caído · ningún documento fallando')).toBeInTheDocument()
  })

  it('debeDistinguirUnaListaVaciaDeUnFalloDeLaConsulta', () => {
    estado.fallidos = { data: [], isError: false }
    estado.salud = { data: undefined, isError: true }
    pintar()
    expect(screen.getByText(/Ningún documento está fallando ahora/)).toBeInTheDocument()
    expect(screen.getByText(/No pudimos consultar la salud de los colectores/)).toBeInTheDocument()
    expect(screen.queryByText(/todavía no corrió ningún ciclo/)).not.toBeInTheDocument()
  })

  it('debeDecirQueNoSabeSiHayFallidosCuandoLaConsultaFalla', () => {
    estado.fallidos = { data: undefined, isError: true }
    pintar()
    expect(screen.getByText(/no sabemos si hay alguno/)).toBeInTheDocument()
    expect(screen.queryByText(/Ningún documento está fallando/)).not.toBeInTheDocument()
  })

  it('debeMostrarSoloLosMetadatosQueTraeLaRespuestaYPlegarLaLista', async () => {
    const usuario = userEvent.setup()
    const documento = (n: number) => ({
      fuente: 'acuacar', urlOriginal: `https://www.acuacar.com/doc-${n}`, titulo: n === 1 ? null : `Boletín ${n}`, motivo: 'JSON ilegible',
      primerIntento: '2026-10-29T15:00:00Z', ultimoIntento: '2026-10-30T19:00:00Z', reintentos: n,
    })
    estado.fallidos = { isError: false, data: [1, 2, 3, 4, 5].map(documento) }
    pintar()
    const bloque = within(screen.getByRole('region', { name: /Documentos fallidos/ }))
    expect(bloque.getAllByRole('listitem')).toHaveLength(3)
    expect(bloque.getByText('Documento sin título')).toBeInTheDocument()
    expect(bloque.getByText('Boletín 2')).toBeInTheDocument()
    expect(bloque.getAllByText('JSON ilegible')[0]).toBeInTheDocument()
    expect(bloque.getByText(/1 reintento$/)).toBeInTheDocument()
    await usuario.click(bloque.getByRole('button', { name: 'Ver los 5 documentos' }))
    expect(bloque.getAllByRole('listitem')).toHaveLength(5)
  })
})
