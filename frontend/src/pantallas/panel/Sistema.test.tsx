import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { Sistema } from './Sistema'

const estado = vi.hoisted(() => ({
  metricas: {} as { isPending?: boolean; isError?: boolean; data?: object; error?: unknown },
  copias: {} as { isPending?: boolean; isError?: boolean; data?: object[]; error?: unknown },
}))

vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-10-31T20:00:00Z') }))
vi.mock('../../app/paleta', () => ({ usePaletaGrafito: () => undefined }))
vi.mock('../../app/datos-panel', () => ({
  useMetricas: () => ({ isPending: false, isError: false, isFetching: false, dataUpdatedAt: 0, refetch: vi.fn<() => void>(), ...estado.metricas }),
  useCopias: () => ({ isPending: false, isError: false, isFetching: false, dataUpdatedAt: 0, refetch: vi.fn<() => void>(), ...estado.copias }),
}))

const metricas = {
  desde: '2026-10-31T13:00:00Z',
  cambiosDeEstado: { 'SIN_SERVICIO/VECINOS': 4, 'SIN_DATOS/SIN_ORIGEN': 2 },
  disputasAbiertas: 3,
  quorumsRechazadosPorComposicion: { SIN_AGUA: 7 },
  reportesPorNivelDeVerificacion: { NINGUNA: 120, CUENTA_VERIFICADA: 30 },
  fallosDeColectores: { acuacar: 1 },
  tiempoHastaElCambioDeEstado: { cambios: 3, promedioSegundos: 600, maximoSegundos: 1800 },
}
const copia = { id: 9, iniciadaEn: '2026-10-31T19:55:00Z', terminadaEn: '2026-10-31T19:55:03Z', resultado: 'OK', enMongo: { sectores: 211, cortes: 10, pares: 20 }, enSql: { sectores: 211, cortes: 10, pares: 20 } }

const metricasDe = () => within(screen.getByRole('region', { name: 'Métricas de calibración' }))
const copiaDe = () => within(screen.getByRole('region', { name: 'Copia analítica (PostgreSQL)' }))

describe('Sistema', () => {
  beforeEach(() => {
    estado.metricas = { data: metricas }
    estado.copias = { data: [copia] }
  })

  it('debeDecirDesdeCuandoCuentanLosContadoresYQueUnReinicioLosPoneACero', () => {
    render(<Sistema />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Contadores de este proceso desde hoy a las 8:00 a. m.')
    expect(metricasDe().getByText(/Un reinicio del servidor los pone a cero/)).toBeInTheDocument()
  })

  it('debeTotalizarCadaContadorEnLaFilaDeCifras', () => {
    render(<Sistema />)
    const cifras = metricasDe()
    expect(cifras.getByText('Cambios de estado').nextElementSibling).toHaveTextContent('6')
    expect(cifras.getByText('Reportes recibidos').nextElementSibling).toHaveTextContent('150')
    expect(cifras.getByText('Barrios en disputa').nextElementSibling).toHaveTextContent('3')
    expect(cifras.getByText('Quórums sin composición').nextElementSibling).toHaveTextContent('7')
  })

  it('noDebeConcluirNadaDelTiempoConMenosDeCincoCambios', () => {
    render(<Sistema />)
    expect(metricasDe().getByText(/3 cambios medidos: con menos de 5 todavía no se puede sacar una conclusión/)).toBeInTheDocument()
    expect(metricasDe().queryByText('Tarda en promedio')).not.toBeInTheDocument()
  })

  it('debeDarElPromedioCuandoLaMuestraAlcanza', () => {
    estado.metricas = { data: { ...metricas, tiempoHastaElCambioDeEstado: { cambios: 8, promedioSegundos: 1800, maximoSegundos: 5400 } } }
    render(<Sistema />)
    expect(metricasDe().getByText('Tarda en promedio').nextElementSibling).toHaveTextContent('30 minutos')
    expect(metricasDe().getByText('Lo más que tardó').nextElementSibling).toHaveTextContent('1 hora y media')
  })

  it('debeAguantarMapasAusentesSinSuponerClaves', () => {
    estado.metricas = { data: { desde: metricas.desde } }
    render(<Sistema />)
    expect(metricasDe().getByText('Cambios de estado').nextElementSibling).toHaveTextContent('0')
    expect(metricasDe().getByText(/Todavía no hubo un cambio de estado sostenido por vecinos/)).toBeInTheDocument()
  })

  it('debeMostrarLaCopiaCorrectaConSusConteos', () => {
    render(<Sistema />)
    expect(copiaDe().getByText('Copia correcta')).toBeInTheDocument()
    expect(copiaDe().getByText(/Terminó hace 4 min y tardó 3 s/)).toBeInTheDocument()
    expect(copiaDe().getAllByText('Sí')).toHaveLength(3)
  })

  it('debeDecirQueConteoNoCuadraYMostrarElDetalleDeUnaCopiaConDiferencias', () => {
    estado.copias = { data: [{ ...copia, resultado: 'CON_DIFERENCIAS', enSql: { sectores: 211, cortes: 10, pares: 18 }, detalle: 'Faltan 2 pares corte-barrio' }] }
    render(<Sistema />)
    expect(copiaDe().getByText('Copiada con diferencias')).toBeInTheDocument()
    expect(copiaDe().getByText('No cuadra')).toBeInTheDocument()
    expect(copiaDe().getByText(/Qué no cuadró:/)).toBeInTheDocument()
    expect(copiaDe().getByText(/Faltan 2 pares corte-barrio/)).toBeInTheDocument()
  })

  it('debeDecirPorQueFalloUnaCopiaFallida', () => {
    estado.copias = { data: [{ id: 1, iniciadaEn: copia.iniciadaEn, resultado: 'FALLIDA', detalle: 'Conexión rechazada' }] }
    render(<Sistema />)
    expect(copiaDe().getByText('La copia falló')).toBeInTheDocument()
    expect(copiaDe().getByText(/Por qué falló:/)).toBeInTheDocument()
    expect(copiaDe().getByText(/todavía no terminó/)).toBeInTheDocument()
  })

  it('debeDecirQueElSistemaFuncionaIgualCuandoLaCopiaDa503SinPresentarloComoError', () => {
    estado.copias = { isError: true, data: undefined, error: { estado: 503, tipo: 'servicio-no-disponible' } }
    render(<Sistema />)
    expect(copiaDe().getByText('La copia analítica está apagada o PostgreSQL no responde; el sistema funciona igual')).toBeInTheDocument()
    expect(copiaDe().queryByRole('alert')).not.toBeInTheDocument()
    expect(metricasDe().getByText('Cambios de estado')).toBeInTheDocument()
  })

  it('debeTratarUnFalloDeLasMetricasSinTumbarLaCopia', () => {
    estado.metricas = { isError: true, data: undefined, error: { estado: 500 } }
    render(<Sistema />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('No pudimos consultar el sistema')
    expect(metricasDe().getByRole('alert')).toHaveTextContent('No pudimos consultar las métricas')
    expect(copiaDe().getByText('Copia correcta')).toBeInTheDocument()
  })

  it('debeDecirQueTodaviaNoHuboCopiasSiLaListaVieneVacia', () => {
    estado.copias = { data: [] }
    render(<Sistema />)
    expect(copiaDe().getByText('Todavía no hubo ninguna copia')).toBeInTheDocument()
  })
})
