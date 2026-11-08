import { olvidarDispositivo } from './dispositivo'
import { sesion } from './sesion'
import { sesionVecino } from './sesion-vecino'
import { confirmarReporte, enviarFoto, enviarReporte, interpretarConfirmacion, interpretarEnvio, interpretarFoto } from './reportes'

const TIPO = 'https://aguavigia.example/errores/'

function respuesta(estado: number, cabeceras: Record<string, string> = {}) {
  return new Response(null, { status: estado, headers: cabeceras })
}

function json(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', ...cabeceras } })
}

const DISPOSITIVO_INVALIDO = { type: `${TIPO}dispositivo-invalido`, status: 401 }

/** Responde en orden a cada petición y deja ver qué se pidió (ruta, cabecera X-Dispositivo y cuerpo). */
function servidorQueResponde(...respuestas: Response[]) {
  const pendientes = [...respuestas]
  const pedido = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => pendientes.shift() ?? json(500, {}))
  const llamadas = () => pedido.mock.calls.map(([entrada]) => {
    const peticion = entrada as Request
    return { ruta: new URL(peticion.url).pathname, dispositivo: peticion.headers.get('X-Dispositivo'), autorizacion: peticion.headers.get('Authorization'), peticion }
  })
  return { pedido, llamadas }
}

describe('interpretarEnvio', () => {
  it('debeReconocerElReporteRecibido', () => {
    expect(interpretarEnvio(respuesta(201), { id: 'r1', sectorId: 'manga' })).toEqual({ tipo: 'recibido', reporte: { id: 'r1', sectorId: 'manga' } })
  })

  it('noDebeDarPorRecibidoUnEnvioSinRespuesta', () => {
    expect(interpretarEnvio(null, null)).toEqual({ tipo: 'incierto' })
  })

  it('debeDistinguirElCupoDelSectorDelLimitePorIp', () => {
    expect(interpretarEnvio(respuesta(429), { type: `${TIPO}limite-reportes-excedido` })).toEqual({ tipo: 'cupo-agotado' })
    expect(interpretarEnvio(respuesta(429, { 'Retry-After': '20' }), { type: `${TIPO}limite-de-peticiones-excedido` }))
      .toEqual({ tipo: 'esperar', segundos: 20 })
  })

  it('debeMostrarElDetalleDeUnRechazoYOcultarElDeUnFalloInterno', () => {
    expect(interpretarEnvio(respuesta(400), { type: `${TIPO}peticion-invalida`, detail: 'No existe el sector' }))
      .toEqual({ tipo: 'rechazado', mensaje: 'No existe el sector' })
    expect(interpretarEnvio(respuesta(500), { type: `${TIPO}error-interno`, detail: 'NullPointer' })).toEqual({ tipo: 'fallo' })
  })
})

describe('enviarReporte', () => {
  beforeEach(() => olvidarDispositivo())
  afterEach(() => {
    olvidarDispositivo()
    vi.restoreAllMocks()
  })

  it('noDebeIntentarElEnvioSinConexion', async () => {
    const pedir = vi.spyOn(globalThis, 'fetch')
    expect(await enviarReporte('manga', 'SIN_AGUA', null, () => false)).toEqual({ tipo: 'sin-red' })
    expect(pedir).not.toHaveBeenCalled()
  })

  it('debePedirElDispositivoUnaVezYEnviarloEnCadaReporte', async () => {
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), json(201, { id: 'r1' }), json(201, { id: 'r2' }))
    expect(await enviarReporte('manga', 'SIN_AGUA')).toMatchObject({ tipo: 'recibido' })
    expect(await enviarReporte('manga', 'PRESION_BAJA')).toMatchObject({ tipo: 'recibido' })
    expect(llamadas().map(({ ruta, dispositivo }) => [ruta, dispositivo])).toEqual([
      ['/api/dispositivos', null],
      ['/api/reportes', 'tok-1'],
      ['/api/reportes', 'tok-1'],
    ])
  })

  it('debeEnviarLaCoordenadaConSuPrecisionYNingunaHuella', async () => {
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), json(201, { id: 'r1' }))
    await enviarReporte('manga', 'SIN_AGUA', { coordenada: { latitud: 10.4, longitud: -75.5 }, precisionMetros: 25 })
    const cuerpo = await llamadas()[1]!.peticion.json()
    expect(cuerpo).toEqual({ tipo: 'SIN_AGUA', sectorId: 'manga', coordenada: { latitud: 10.4, longitud: -75.5 }, precisionMetros: 25 })
  })

  it('debePedirOtroDispositivoYReintentarUnaSolaVezAnteUn401DispositivoInvalido', async () => {
    const { llamadas } = servidorQueResponde(
      json(201, { token: 'viejo' }),
      json(401, DISPOSITIVO_INVALIDO),
      json(201, { token: 'nuevo' }),
      json(201, { id: 'r1' }),
    )
    expect(await enviarReporte('manga', 'SIN_AGUA')).toMatchObject({ tipo: 'recibido' })
    expect(llamadas().map(({ ruta, dispositivo }) => [ruta, dispositivo])).toEqual([
      ['/api/dispositivos', null],
      ['/api/reportes', 'viejo'],
      ['/api/dispositivos', null],
      ['/api/reportes', 'nuevo'],
    ])
  })

  it('noDebeReintentarMasDeUnaVezSiElSegundoDispositivoTambienFalla', async () => {
    const { llamadas } = servidorQueResponde(
      json(201, { token: 'a' }),
      json(401, DISPOSITIVO_INVALIDO),
      json(201, { token: 'b' }),
      json(401, DISPOSITIVO_INVALIDO),
    )
    expect(await enviarReporte('manga', 'SIN_AGUA')).toEqual({ tipo: 'fallo' })
    expect(llamadas()).toHaveLength(4)
  })

  it('debeDecirCuantoEsperarSiElServidorNoEmiteMasDispositivos', async () => {
    servidorQueResponde(json(429, { type: `${TIPO}limite-de-peticiones-excedido`, status: 429 }, { 'Retry-After': '120' }))
    expect(await enviarReporte('manga', 'SIN_AGUA')).toEqual({ tipo: 'esperar', segundos: 120 })
  })
})

describe('enviarReporte con sesión de vecino', () => {
  beforeEach(() => olvidarDispositivo())
  afterEach(() => {
    olvidarDispositivo()
    vi.restoreAllMocks()
  })

  it('debeMandarElTokenDelVecinoJuntoConElDispositivoYPedirElDispositivoUnaVez', async () => {
    sesionVecino.guardar('t-vecino')
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), json(201, { id: 'r1' }), json(201, { id: 'r2' }))
    await enviarReporte('manga', 'SIN_AGUA')
    await enviarReporte('manga', 'PRESION_BAJA')
    expect(llamadas().map(({ ruta, dispositivo, autorizacion }) => [ruta, dispositivo, autorizacion])).toEqual([
      ['/api/dispositivos', null, null],
      ['/api/reportes', 'tok-1', 'Bearer t-vecino'],
      ['/api/reportes', 'tok-1', 'Bearer t-vecino'],
    ])
  })

  it('debeConfirmarConLaCuentaDelVecino', async () => {
    sesionVecino.guardar('t-vecino')
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), json(200, { id: 'r9', confirmaciones: 1 }))
    expect(await confirmarReporte('r9')).toMatchObject({ tipo: 'confirmado' })
    expect(llamadas()[1]).toMatchObject({ ruta: '/api/reportes/r9/confirmar', dispositivo: 'tok-1', autorizacion: 'Bearer t-vecino' })
  })

  it('noDebeMandarNuncaElTokenDelPanelEnUnReporte', async () => {
    sesion.guardar('del-panel')
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), json(201, { id: 'r1' }))
    await enviarReporte('manga', 'SIN_AGUA')
    expect(llamadas().map(({ autorizacion }) => autorizacion)).toEqual([null, null])
  })

  it('debeReintentarUnaVezSoloConElDispositivoSiElTokenDelVecinoMurio', async () => {
    sesionVecino.guardar('vencido')
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), respuesta(401), json(201, { id: 'r1' }))
    expect(await enviarReporte('manga', 'SIN_AGUA')).toMatchObject({ tipo: 'recibido' })
    expect(sesionVecino.token()).toBeNull()
    expect(llamadas().map(({ ruta, dispositivo, autorizacion }) => [ruta, dispositivo, autorizacion])).toEqual([
      ['/api/dispositivos', null, null],
      ['/api/reportes', 'tok-1', 'Bearer vencido'],
      ['/api/reportes', 'tok-1', null],
    ])
  })

  it('noDebeCerrarLaSesionDelVecinoPorUnDispositivoInvalido', async () => {
    sesionVecino.guardar('vigente')
    servidorQueResponde(json(201, { token: 'a' }), json(401, DISPOSITIVO_INVALIDO), json(201, { token: 'b' }), json(201, { id: 'r1' }))
    expect(await enviarReporte('manga', 'SIN_AGUA')).toMatchObject({ tipo: 'recibido' })
    expect(sesionVecino.token()).toBe('vigente')
  })
})

describe('interpretarConfirmacion', () => {
  it('debeDevolverElReporteConSusConfirmaciones', () => {
    expect(interpretarConfirmacion(respuesta(200), { id: 'r1', sectorId: 'manga', confirmaciones: 3 }))
      .toEqual({ tipo: 'confirmado', reporte: { id: 'r1', sectorId: 'manga', confirmaciones: 3 } })
  })

  it('debeTratarElReporteInexistenteYElDescartadoComoNoDisponible', () => {
    expect(interpretarConfirmacion(respuesta(404), { type: `${TIPO}recurso-no-encontrado`, detail: "No existe el reporte 'x'" }))
      .toEqual({ tipo: 'no-disponible' })
  })

  it('noDebeDarPorConfirmadoUnEnvioSinRespuesta', () => {
    expect(interpretarConfirmacion(null, null)).toEqual({ tipo: 'incierto' })
  })

  it('debeEsperarElRetryAfterDelLimitePorIp', () => {
    expect(interpretarConfirmacion(respuesta(429, { 'Retry-After': '12' }), { type: `${TIPO}limite-de-peticiones-excedido` }))
      .toEqual({ tipo: 'esperar', segundos: 12 })
    expect(interpretarConfirmacion(respuesta(503), { type: `${TIPO}servicio-no-disponible` })).toEqual({ tipo: 'fallo' })
  })
})

describe('confirmarReporte', () => {
  beforeEach(() => olvidarDispositivo())
  afterEach(() => {
    olvidarDispositivo()
    vi.restoreAllMocks()
  })

  it('noDebeIntentarLaConfirmacionSinConexion', async () => {
    const pedir = vi.spyOn(globalThis, 'fetch')
    expect(await confirmarReporte('r1', () => false)).toEqual({ tipo: 'sin-red' })
    expect(pedir).not.toHaveBeenCalled()
  })

  it('debeConfirmarSinCuerpoYConElDispositivoEnLaCabecera', async () => {
    const { llamadas } = servidorQueResponde(json(201, { token: 'tok-1' }), json(200, { id: 'r1', confirmaciones: 2 }))
    expect(await confirmarReporte('r1')).toMatchObject({ tipo: 'confirmado' })
    const confirmacion = llamadas()[1]!
    expect(confirmacion.ruta).toBe('/api/reportes/r1/confirmar')
    expect(confirmacion.dispositivo).toBe('tok-1')
    expect(await confirmacion.peticion.text()).toBe('')
  })
})

describe('interpretarFoto', () => {
  it('debeMostrarElEstadoDeLaFotoQueDevuelveElServidor', () => {
    expect(interpretarFoto(respuesta(200), { id: 'r1', fotoEstado: 'EN_REVISION' })).toEqual({ tipo: 'recibida', estado: 'EN_REVISION' })
    expect(interpretarFoto(respuesta(200), { id: 'r1', fotoEstado: 'PUBLICA' })).toEqual({ tipo: 'recibida', estado: 'PUBLICA' })
    expect(interpretarFoto(respuesta(200), {})).toEqual({ tipo: 'recibida', estado: null })
  })

  it('debeDistinguirLosRechazosPorTypeYNoPorTexto', () => {
    expect(interpretarFoto(respuesta(415), { type: `${TIPO}formato-no-permitido`, detail: 'WebP' })).toEqual({ tipo: 'formato-no-permitido' })
    expect(interpretarFoto(respuesta(403), { type: `${TIPO}subida-no-autorizada` })).toEqual({ tipo: 'sin-permiso' })
    expect(interpretarFoto(respuesta(409), { type: `${TIPO}conflicto-de-estado` })).toEqual({ tipo: 'ya-tiene-foto' })
  })

  it('debeExplicarCadaRechazoDeLaFoto', () => {
    expect(interpretarFoto(respuesta(413), {})).toEqual({ tipo: 'muy-grande' })
    expect(interpretarFoto(respuesta(400), { type: `${TIPO}peticion-invalida`, detail: 'Firma inválida' }))
      .toEqual({ tipo: 'no-valida', mensaje: 'Firma inválida' })
    expect(interpretarFoto(null, null)).toEqual({ tipo: 'fallo' })
  })
})

describe('enviarFoto', () => {
  afterEach(() => vi.restoreAllMocks())

  it('debeEnviarElTokenDeSubidaEnLaCabeceraXSubida', async () => {
    const pedido = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { id: 'r1', fotoEstado: 'EN_REVISION' }))
    const foto = new File(['x'], 'foto.png', { type: 'image/png' })
    expect(await enviarFoto('r1', foto, 'subida-1')).toEqual({ tipo: 'recibida', estado: 'EN_REVISION' })
    const [ruta, opciones] = pedido.mock.calls[0]!
    expect(ruta).toBe('/api/reportes/r1/foto')
    expect(new Headers(opciones?.headers).get('X-Subida')).toBe('subida-1')
  })

  it('noDebeEnviarUnaFotoDeMasDe10Mb', async () => {
    const pedido = vi.spyOn(globalThis, 'fetch')
    const grande = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })
    expect(await enviarFoto('r1', grande, 'subida-1')).toEqual({ tipo: 'muy-grande' })
    expect(pedido).not.toHaveBeenCalled()
  })
})
