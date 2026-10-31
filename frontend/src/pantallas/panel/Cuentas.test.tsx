import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PERMISOS_DEL_ROL } from '../../dominio/cuentas'
import { Cuentas } from './Cuentas'

type Respuesta = Promise<unknown>

const estado = vi.hoisted(() => ({
  permisos: new Set<string>(['VER_PANEL', 'GESTIONAR_USUARIOS']),
  cuentas: [] as object[],
  cola: [[], [], []] as object[][],
  suspender: undefined as undefined | ((id: string) => Respuesta),
  cambiar: undefined as undefined | ((id: string, ajuste: unknown) => Respuesta),
  invitar: undefined as undefined | ((datos: unknown) => Respuesta),
  ultimaConsulta: { ocultarSinteticas: true },
}))

vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-10-31T20:00:00Z') }))
vi.mock('../../app/paleta', () => ({ usePaletaGrafito: () => undefined }))
vi.mock('../../app/panel', () => ({
  usePermisos: () => estado.permisos,
  useCuentaActual: () => ({ data: { id: 'u1', nombre: 'Ana Pérez', rol: 'ADMIN' } }),
}))
vi.mock('../../api/administracion', async (importar) => ({
  ...(await importar<typeof import('../../api/administracion')>()),
  suspenderCuenta: (id: string) => estado.suspender?.(id),
  cambiarAccesoDeCuenta: (id: string, ajuste: unknown) => estado.cambiar?.(id, ajuste),
  invitarCuenta: (datos: unknown) => estado.invitar?.(datos),
}))
vi.mock('../../app/datos-panel', async (importar) => ({
  ...(await importar<typeof import('../../app/datos-panel')>()),
  useCuentas: (_filtro: unknown, _inicio: number, ocultarSinteticas: boolean) => {
    estado.ultimaConsulta = { ocultarSinteticas }
    return {
      isPending: false, isError: false, isFetching: false, isPlaceholderData: false, refetch: vi.fn<() => void>(),
      data: { cuentas: estado.cuentas, paginacion: { total: estado.cuentas.length, paginas: 1, pagina: 0, hayMas: false }, saltadas: 0, agotado: false },
    }
  },
  useColaDeCuentas: () => estado.cola.map((cuentas) => ({ isPending: false, isError: false, data: { cuentas, paginacion: { hayMas: false } } })),
  useBarriosPanel: () => ({ data: [{ id: 'manga', nombre: 'MANGA' }] }),
}))

const yo = { id: 'u1', nombre: 'Ana Pérez', correo: 'ana@example.com', estado: 'ACTIVA', rol: 'ADMIN', permisosEfectivos: [...PERMISOS_DEL_ROL.ADMIN], creadoEn: '2026-10-01T15:00:00Z' }
const luis = { id: 'u2', nombre: 'Luis Mora', correo: 'luis@example.com', estado: 'ACTIVA', rol: 'VEEDOR', permisosEfectivos: [...PERMISOS_DEL_ROL.VEEDOR], creadoEn: '2026-10-10T15:00:00Z' }
const sintetica = { id: 's1', nombre: 'Vecino 1', correo: 'v1@sintetico.invalid', estado: 'ACTIVA', rol: 'VECINO', permisosEfectivos: [], sintetica: true, creadoEn: '2026-10-20T15:00:00Z' }

function pintar() {
  return render(<QueryClientProvider client={new QueryClient()}><Cuentas /></QueryClientProvider>)
}

const abrir = async (usuario: ReturnType<typeof userEvent.setup>, nombre: string) => usuario.click(screen.getByRole('button', { name: `Abrir el detalle de ${nombre}` }))

describe('Cuentas', () => {
  beforeEach(() => {
    estado.permisos = new Set(['VER_PANEL', 'GESTIONAR_USUARIOS'])
    estado.cuentas = [yo, luis, sintetica]
    estado.cola = [[], [], []]
    estado.suspender = () => Promise.resolve({ tipo: 'hecho', dato: { ...luis, estado: 'SUSPENDIDA' } })
    estado.cambiar = () => Promise.resolve({ tipo: 'hecho', dato: luis })
    estado.invitar = () => Promise.resolve({ tipo: 'hecho', dato: luis })
  })

  it('debeOcultarLasCuentasSinteticasPorDefectoYDecirCuantasOcultoSinContarlasComoPersonas', async () => {
    const usuario = userEvent.setup()
    pintar()
    expect(screen.getByText('Luis Mora')).toBeInTheDocument()
    expect(screen.queryByText('Vecino 1')).not.toBeInTheDocument()
    expect(screen.getByText(/1 cuenta sintética oculta/)).toBeInTheDocument()
    expect(screen.getByText(/no son personas y no se cuentan como adopción/)).toBeInTheDocument()
    expect(estado.ultimaConsulta.ocultarSinteticas).toBe(true)

    await usuario.click(screen.getByRole('checkbox', { name: /Mostrar cuentas sintéticas/ }))
    expect(screen.getByText('Vecino 1')).toBeInTheDocument()
    expect(estado.ultimaConsulta.ocultarSinteticas).toBe(false)
  })

  it('debeDecirLoQueEsperaUnaDecisionEnElTitular', () => {
    estado.cola = [[{ ...luis, id: 'p1', estado: 'PENDIENTE_APROBACION' }, { ...luis, id: 'p2', estado: 'PENDIENTE_APROBACION' }, { ...sintetica, estado: 'PENDIENTE_APROBACION' }], [], [{ ...luis, estado: 'SUSPENDIDA' }]]
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 cuentas esperan tu aprobación')
  })

  it('debeDecirQueNingunaCuentaEsperaCuandoLaColaVieneVacia', () => {
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ninguna cuenta espera tu aprobación')
  })

  it('noDebeOfrecerAccionesSobreLaPropiaCuenta', async () => {
    const usuario = userEvent.setup()
    pintar()
    expect(screen.getByText(/tu cuenta/)).toBeInTheDocument()
    await abrir(usuario, 'Ana Pérez')
    expect(screen.getByText(/no puedes cambiar tu propio acceso/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Suspender|Cambiar rol/ })).not.toBeInTheDocument()
  })

  it('debePedirConfirmacionConElNombreYAvisarQueSuspenderCierraSesionesAntesDeEnviar', async () => {
    const usuario = userEvent.setup()
    const suspender = vi.fn<(id: string) => Respuesta>().mockResolvedValue({ tipo: 'hecho', dato: luis })
    estado.suspender = suspender
    pintar()
    await abrir(usuario, 'Luis Mora')
    await usuario.click(screen.getByRole('button', { name: 'Suspender: Luis Mora' }))
    expect(suspender).not.toHaveBeenCalled()
    expect(screen.getByText(/¿Suspender la cuenta de Luis Mora \(luis@example.com\)\?/)).toBeInTheDocument()
    expect(screen.getByText(/Se cerrarán todas las sesiones abiertas de esa persona/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Sí, suspender a Luis Mora' }))
    expect(suspender).toHaveBeenCalledWith('u2')
    expect(await screen.findByText(/Suspendimos la cuenta de Luis Mora\. Se cerraron sus sesiones/)).toBeInTheDocument()
  })

  it('debeCancelarSinEnviarNada', async () => {
    const usuario = userEvent.setup()
    const suspender = vi.fn<(id: string) => Respuesta>()
    estado.suspender = suspender
    pintar()
    await abrir(usuario, 'Luis Mora')
    await usuario.click(screen.getByRole('button', { name: 'Suspender: Luis Mora' }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(suspender).not.toHaveBeenCalled()
    expect(screen.queryByText(/¿Suspender la cuenta/)).not.toBeInTheDocument()
  })

  it('debeExplicarElConflictoDeUnaSuspensionYNoDarlaPorHecha', async () => {
    const usuario = userEvent.setup()
    estado.suspender = () => Promise.resolve({ tipo: 'conflicto' })
    pintar()
    await abrir(usuario, 'Luis Mora')
    await usuario.click(screen.getByRole('button', { name: 'Suspender: Luis Mora' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, suspender a Luis Mora' }))
    expect(await screen.findByText(/No se pudo suspender: la cuenta ya no está activa/)).toBeInTheDocument()
  })

  it('debeDejarElSegundoFactorMarcadoYBloqueadoYMandarSoloLoQueCambio', async () => {
    const usuario = userEvent.setup()
    const cambiar = vi.fn<(id: string, ajuste: unknown) => Respuesta>().mockResolvedValue({ tipo: 'hecho', dato: luis })
    estado.cambiar = cambiar
    pintar()
    await abrir(usuario, 'Luis Mora')
    await usuario.click(screen.getByRole('button', { name: 'Cambiar rol y permisos: Luis Mora' }))
    const segundoFactor = screen.getByRole('checkbox', { name: /Configurar el segundo factor/ })
    expect(segundoFactor).toBeChecked()
    expect(segundoFactor).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revisar el cambio' })).toBeDisabled()

    await usuario.click(screen.getByRole('checkbox', { name: /Ver la auditoría/ }))
    await usuario.click(screen.getByRole('checkbox', { name: /Revisar la ingesta/ }))
    await usuario.click(screen.getByRole('button', { name: 'Revisar el cambio' }))
    expect(screen.getByText('Se le suman: Ver la auditoría.')).toBeInTheDocument()
    expect(screen.getByText('Se le quitan: Revisar la ingesta.')).toBeInTheDocument()
    expect(screen.getByText(/Se cerrarán todas las sesiones/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Sí, cambiar el acceso de Luis Mora' }))
    expect(cambiar).toHaveBeenCalledWith('u2', { rol: 'VEEDOR', concedidos: ['VER_AUDITORIA'], revocados: ['REVISAR_INGESTA'] })
  })

  it('debeVolverALosPermisosDelRolAlElegirOtroRol', async () => {
    const usuario = userEvent.setup()
    pintar()
    await abrir(usuario, 'Luis Mora')
    await usuario.click(screen.getByRole('button', { name: 'Cambiar rol y permisos: Luis Mora' }))
    await usuario.selectOptions(screen.getByLabelText('Rol de Luis Mora'), 'ADMIN')
    expect(screen.getByRole('checkbox', { name: /Gestionar cuentas/ })).toBeChecked()
    await usuario.selectOptions(screen.getByLabelText('Rol de Luis Mora'), 'OBSERVADOR')
    expect(screen.getByRole('checkbox', { name: /Gestionar cortes/ })).not.toBeChecked()
  })

  it('debeOfrecerAprobarYRechazarSobreUnaSolicitud', async () => {
    const usuario = userEvent.setup()
    estado.cuentas = [{ ...luis, estado: 'PENDIENTE_APROBACION', rol: 'OBSERVADOR', permisosEfectivos: [] }]
    pintar()
    await abrir(usuario, 'Luis Mora')
    expect(screen.getByRole('button', { name: 'Aprobar con este acceso: Luis Mora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar: Luis Mora' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Suspender/ })).not.toBeInTheDocument()
  })

  it('noDebeMostrarAccionesSiFaltaGestionarUsuarios', () => {
    estado.permisos = new Set(['VER_PANEL'])
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu cuenta no puede gestionar cuentas')
    expect(screen.queryByRole('button', { name: /Invitar/ })).not.toBeInTheDocument()
  })

  it('debeMostrarElErrorDeUnCorreoYaRegistradoJuntoAlCampo', async () => {
    const usuario = userEvent.setup()
    estado.invitar = () => Promise.resolve({ tipo: 'conflicto' })
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Invitar a una persona' }))
    const formulario = within(screen.getByRole('form', { name: 'Invitar a una persona al panel' }))
    await usuario.type(formulario.getByLabelText('Nombre'), 'Luis')
    await usuario.type(formulario.getByLabelText('Correo'), 'luis@example.com')
    await usuario.click(formulario.getByRole('button', { name: 'Enviar la invitación' }))
    const campo = formulario.getByLabelText('Correo')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(formulario.getByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese correo')
  })

  it('debeValidarElFormularioDeInvitacionSinEnviar', async () => {
    const usuario = userEvent.setup()
    const invitar = vi.fn<(datos: unknown) => Respuesta>()
    estado.invitar = invitar
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Invitar a una persona' }))
    await usuario.click(screen.getByRole('button', { name: 'Enviar la invitación' }))
    expect(invitar).not.toHaveBeenCalled()
    expect(screen.getByText('Escribe el nombre de la persona.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('debeEnviarLaInvitacionConElRolElegidoYConfirmarla', async () => {
    const usuario = userEvent.setup()
    const invitar = vi.fn<(datos: unknown) => Respuesta>().mockResolvedValue({ tipo: 'hecho', dato: luis })
    estado.invitar = invitar
    pintar()
    await usuario.click(screen.getByRole('button', { name: 'Invitar a una persona' }))
    await usuario.type(screen.getByLabelText('Nombre'), 'Luis Mora')
    await usuario.type(screen.getByLabelText('Correo'), 'luis@example.com')
    await usuario.selectOptions(screen.getByLabelText('Rol'), 'VEEDOR')
    await usuario.click(screen.getByRole('button', { name: 'Enviar la invitación' }))
    expect(invitar).toHaveBeenCalledWith({ correo: 'luis@example.com', nombre: 'Luis Mora', rol: 'VEEDOR' })
    expect(await screen.findByText(/Invitamos a Luis Mora \(luis@example\.com\) como veedor/)).toBeInTheDocument()
  })
})
