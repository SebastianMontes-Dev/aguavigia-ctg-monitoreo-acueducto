import { crearCliente } from './cliente'
import { sesion } from './sesion'
import { sesionVecino } from './sesion-vecino'
import { actualizarPerfil, cerrarSesionVecino, consultarPerfil, iniciarSesionVecino, interpretarPerfil, interpretarVerificacion, verificarBarrio } from './vecino'

const TIPO = 'https://aguavigia.example/errores/'

function respuesta(estado: number, cabeceras: Record<string, string> = {}) {
  return new Response(null, { status: estado, headers: cabeceras })
}

function json(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': estado >= 400 ? 'application/problem+json' : 'application/json', ...cabeceras },
  })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function enviada(pedir: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) {
  const peticion = pedir.mock.calls[n]?.[0]
  if (!(peticion instanceof Request)) throw new Error(`la petición ${n} no se envió`)
  const texto = await peticion.clone().text()
  return { ruta: new URL(peticion.url).pathname, metodo: peticion.method, cuerpo: texto ? JSON.parse(texto) as unknown : null, autorizacion: peticion.headers.get('Authorization') }
}

describe('iniciarSesionVecino', () => {
  it('debeGuardarElTokenEnLaSesionDelVecinoYNoEnLaDelPanel', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { token: 't-vecino', usuarioId: 'u1', nombre: 'Vera', permisos: ['GESTIONAR_PERFIL_PROPIO'] }))
    expect(await iniciarSesionVecino('v@example.com', 'una clave larga', clienteCon(pedir))).toEqual({ tipo: 'ingresado', alcance: 'COMPLETO' })
    expect(sesionVecino.token()).toBe('t-vecino')
    expect(sesion.token()).toBeNull()
    expect(window.sessionStorage.getItem('aguavigia.vecino.token')).toBe('t-vecino')
    expect(window.sessionStorage.getItem('aguavigia.panel.token')).toBeNull()
    expect((await enviada(pedir)).ruta).toBe('/api/vecino/sesion')
  })

  it('noDebeTocarLaSesionDelPanelAlIngresarNiAlFallar', async () => {
    sesion.guardar('del-panel')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(401, { type: `${TIPO}credencial-invalida`, status: 401 }))
    expect(await iniciarSesionVecino('v@example.com', 'mala', clienteCon(pedir))).toEqual({ tipo: 'credencial-invalida' })
    expect(sesion.token()).toBe('del-panel')
    expect(sesionVecino.token()).toBeNull()
  })

  it('debeDarLaMismaRespuestaParaUnaCuentaDelPanelQueParaUnaClaveMala', async () => {
    const mala = vi.fn<typeof fetch>().mockResolvedValue(json(401, { type: `${TIPO}credencial-invalida`, detail: 'Correo o clave incorrectos' }))
    const delPanel = vi.fn<typeof fetch>().mockResolvedValue(json(401, { type: `${TIPO}credencial-invalida`, detail: 'Correo o clave incorrectos' }))
    expect(await iniciarSesionVecino('a@example.com', 'x', clienteCon(mala))).toEqual(await iniciarSesionVecino('p@example.com', 'x', clienteCon(delPanel)))
  })

  it('debeDistinguirLaCuentaSuspendidaElBloqueoYElLimite', async () => {
    const suspendida = vi.fn<typeof fetch>().mockResolvedValue(json(403, { type: `${TIPO}cuenta-no-habilitada`, estado: 'SUSPENDIDA', detail: 'No' }))
    expect(await iniciarSesionVecino('v@example.com', 'x', clienteCon(suspendida))).toMatchObject({ tipo: 'no-habilitada', estado: 'SUSPENDIDA' })
    const bloqueada = vi.fn<typeof fetch>().mockResolvedValue(json(423, { type: `${TIPO}cuenta-bloqueada`, segundosRestantes: 840 }))
    expect(await iniciarSesionVecino('v@example.com', 'x', clienteCon(bloqueada))).toEqual({ tipo: 'bloqueada', segundos: 840 })
    const limite = vi.fn<typeof fetch>().mockResolvedValue(json(429, { type: `${TIPO}limite-de-peticiones-excedido` }, { 'Retry-After': '300' }))
    expect(await iniciarSesionVecino('v@example.com', 'x', clienteCon(limite))).toEqual({ tipo: 'esperar', segundos: 300 })
  })

  it('noDebeTratarUnSegundoFactorComoUnIngresoNiPedirUnCodigo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(401, { type: `${TIPO}segundo-factor-requerido` }))
    expect(await iniciarSesionVecino('v@example.com', 'x', clienteCon(pedir))).toEqual({ tipo: 'credencial-invalida' })
  })
})

describe('perfil del vecino', () => {
  it('debePedirElPerfilConElTokenDelVecino', async () => {
    sesionVecino.guardar('t-vecino')
    sesion.guardar('del-panel')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { id: 'u1', barrioId: 'manga', barrioVerificado: false }))
    expect(await consultarPerfil({}, clienteCon(pedir))).toMatchObject({ barrioId: 'manga' })
    expect((await enviada(pedir)).autorizacion).toBe('Bearer t-vecino')
  })

  it('debeLanzarElErrorNormalizadoSiElPerfilNoCarga', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(500, { type: `${TIPO}error-interno` }))
    await expect(consultarPerfil({}, clienteCon(pedir))).rejects.toMatchObject({ estado: 500 })
  })

  it('debeEnviarSoloLoQueCambio', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { id: 'u1', barrioId: 'crespo' }))
    expect(await actualizarPerfil({ barrioId: 'crespo' }, clienteCon(pedir))).toMatchObject({ tipo: 'guardado' })
    expect(await enviada(pedir)).toMatchObject({ ruta: '/api/vecino/perfil', metodo: 'PATCH', cuerpo: { barrioId: 'crespo' } })
  })

  it('debeInterpretarCadaRespuestaDelPerfilPorSuTipo', () => {
    expect(interpretarPerfil(null, null)).toEqual({ tipo: 'sin-red' })
    expect(interpretarPerfil(respuesta(401), null)).toEqual({ tipo: 'sesion-terminada' })
    expect(interpretarPerfil(respuesta(409), { type: `${TIPO}conflicto-de-estado` })).toEqual({ tipo: 'conflicto' })
    expect(interpretarPerfil(respuesta(400), { type: `${TIPO}peticion-invalida`, detail: 'El barrio no existe', errores: ['barrioId: No existe'] }))
      .toEqual({ tipo: 'rechazado', mensaje: 'El barrio no existe', campos: { barrioId: 'No existe' } })
    expect(interpretarPerfil(respuesta(503), { type: `${TIPO}base-de-datos-no-disponible` })).toEqual({ tipo: 'fallo' })
  })
})

describe('verificación del barrio', () => {
  it('debeEnviarLaUbicacionDelMomentoConSuPrecision', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { id: 'u1', barrioVerificado: true }))
    const resultado = await verificarBarrio({ coordenada: { latitud: 10.4, longitud: -75.5 }, precisionMetros: 25 }, clienteCon(pedir))
    expect(resultado).toMatchObject({ tipo: 'verificado', perfil: { barrioVerificado: true } })
    expect(await enviada(pedir)).toMatchObject({
      ruta: '/api/vecino/verificacion-barrio', metodo: 'POST',
      cuerpo: { coordenada: { latitud: 10.4, longitud: -75.5 }, precisionMetros: 25 },
    })
  })

  it('debeDistinguirCadaError422PorSuType', () => {
    expect(interpretarVerificacion(respuesta(422), { type: `${TIPO}ubicacion-fuera-del-barrio` })).toEqual({ tipo: 'fuera-del-barrio' })
    expect(interpretarVerificacion(respuesta(422), { type: `${TIPO}ubicacion-imprecisa` })).toEqual({ tipo: 'imprecisa' })
  })

  it('debeDecirCuantoFaltaCuandoSeAgotanLosTresIntentosDelDia', () => {
    expect(interpretarVerificacion(respuesta(429, { 'Retry-After': '43200' }), { type: `${TIPO}limite-de-peticiones-excedido` }))
      .toEqual({ tipo: 'agotado', segundos: 43_200 })
  })

  it('debeVolverAPedirElPerfilAnteUnConflictoYTerminarLaSesionAnteUn401', () => {
    expect(interpretarVerificacion(respuesta(409), { type: `${TIPO}conflicto-de-estado` })).toEqual({ tipo: 'conflicto' })
    expect(interpretarVerificacion(respuesta(401), null)).toEqual({ tipo: 'sesion-terminada' })
    expect(interpretarVerificacion(null, null)).toEqual({ tipo: 'sin-red' })
  })
})

describe('cerrarSesionVecino', () => {
  it('debeCerrarTodasLasSesionesYOlvidarElTokenAunqueFalleLaPeticion', async () => {
    sesionVecino.guardar('t-vecino')
    sesion.guardar('del-panel')
    const pedir = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('sin red'))
    await cerrarSesionVecino(clienteCon(pedir))
    expect(sesionVecino.token()).toBeNull()
    expect(sesion.token()).toBe('del-panel')
    expect(await enviada(pedir)).toMatchObject({ ruta: '/api/vecino/sesion/cierre', metodo: 'POST', autorizacion: 'Bearer t-vecino' })
  })
})
