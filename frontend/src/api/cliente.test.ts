import { crearCliente, normalizarError, tipoDeProblema } from './cliente'
import { sesion } from './sesion'
import { sesionVecino } from './sesion-vecino'

const PREFIJO = 'https://aguavigia.example/errores/'

function problema(slug: string, estado: number, extra: Record<string, unknown> = {}) {
  return { type: PREFIJO + slug, title: 'Título', status: estado, detail: `Detalle de ${slug}`, ...extra }
}

function respuestaProblema(cuerpo: object, estado: number, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/problem+json', ...cabeceras },
  })
}

describe('tipoDeProblema', () => {
  it('debeExtraerElSlugDelType', () => {
    expect(tipoDeProblema(problema('limite-reportes-excedido', 429))).toBe('limite-reportes-excedido')
  })

  it('debeDevolverNuloSiElCuerpoNoEsRfc7807', () => {
    expect(tipoDeProblema({ mensaje: 'hola' })).toBeNull()
    expect(tipoDeProblema(null)).toBeNull()
    expect(tipoDeProblema({ type: 'about:blank' })).toBeNull()
  })
})

describe('normalizarError', () => {
  it('debeTratarLaFaltaDeRespuestaComoFalloDeRedReintentable', () => {
    const error = normalizarError(null, null)
    expect(error.estado).toBeNull()
    expect(error.reintentable).toBe(true)
    expect(error.mensaje).toMatch(/conexión/)
  })

  it('debeMostrarElDetailDeUnErrorQueNoEs500', () => {
    const cuerpo = problema('peticion-invalida', 400)
    const error = normalizarError(new Response(null, { status: 400 }), cuerpo)
    expect(error.tipo).toBe('peticion-invalida')
    expect(error.mensaje).toBe('Detalle de peticion-invalida')
    expect(error.reintentable).toBe(false)
  })

  it('noDebeMostrarElDetailDeUn500', () => {
    const error = normalizarError(new Response(null, { status: 500 }), problema('error-interno', 500))
    expect(error.mensaje).not.toContain('Detalle')
    expect(error.reintentable).toBe(true)
  })

  it('debeLeerRetryAfterEnUn429', () => {
    const respuesta = new Response(null, { status: 429, headers: { 'Retry-After': '42' } })
    const error = normalizarError(respuesta, problema('limite-de-peticiones-excedido', 429))
    expect(error.segundosParaReintentar).toBe(42)
  })

  it('debeConservarLasPropiedadesExtraDelProblema', () => {
    const cuerpo = problema('cuenta-bloqueada', 423, { segundosRestantes: 90 })
    const error = normalizarError(new Response(null, { status: 423 }), cuerpo)
    expect(error.problema?.segundosRestantes).toBe(90)
  })
})

describe('middleware de sesión', () => {
  function clienteQueResponde(respuesta: () => Response) {
    const peticiones: Request[] = []
    const cliente = crearCliente({
      baseUrl: 'http://localhost',
      fetch: async (entrada) => {
        peticiones.push(entrada as Request)
        return respuesta()
      },
    })
    return { cliente, peticiones }
  }

  it('debeMandarElTokenComoBearer', async () => {
    sesion.guardar('token-de-prueba')
    const { cliente, peticiones } = clienteQueResponde(() => new Response('{}', { status: 200 }))
    await cliente.GET('/api/veedor/yo')
    expect(peticiones[0]?.headers.get('Authorization')).toBe('Bearer token-de-prueba')
  })

  it('noDebeMandarAcceptJsonParaNoRomperLaGeometria', async () => {
    const { cliente, peticiones } = clienteQueResponde(() => new Response('{}', { status: 200 }))
    await cliente.GET('/api/sectores/geometria')
    expect(peticiones[0]?.headers.get('Accept')).not.toBe('application/json')
  })

  it('debeCerrarLaSesionAnteUn401SinTypePropio', async () => {
    sesion.guardar('vencido')
    const { cliente } = clienteQueResponde(() => new Response(null, { status: 401 }))
    await cliente.GET('/api/veedor/yo')
    expect(sesion.token()).toBeNull()
  })

  it('debeCerrarLaSesionAnteSesionSinCuenta', async () => {
    sesion.guardar('huerfano')
    const { cliente } = clienteQueResponde(() => respuestaProblema(problema('sesion-sin-cuenta', 401), 401))
    await cliente.GET('/api/veedor/yo')
    expect(sesion.token()).toBeNull()
  })

  it('noDebeCerrarLaSesionCuandoFaltaElSegundoFactor', async () => {
    sesion.guardar('a-medias')
    const { cliente } = clienteQueResponde(() =>
      respuestaProblema(problema('segundo-factor-requerido', 401), 401),
    )
    await cliente.GET('/api/veedor/yo')
    expect(sesion.token()).toBe('a-medias')
  })

  it('noDebeTocarLaSesionDelPanelAnteUn401DeUnReporte', async () => {
    sesion.guardar('vigente')
    const { cliente } = clienteQueResponde(() => new Response(null, { status: 401 }))
    await cliente.POST('/api/reportes', { body: { tipo: 'SIN_AGUA', sectorId: 'manga' } })
    expect(sesion.token()).toBe('vigente')
  })

  it('noDebeCerrarLaSesionAnteUn403', async () => {
    sesion.guardar('vigente')
    const { cliente } = clienteQueResponde(() => respuestaProblema(problema('acceso-denegado', 403), 403))
    await cliente.GET('/api/veedor/yo')
    expect(sesion.token()).toBe('vigente')
  })

  it('noDebeMandarElTokenDelPanelFueraDeLasRutasDelPanel', async () => {
    sesion.guardar('del-panel')
    const { cliente, peticiones } = clienteQueResponde(() => new Response('{}', { status: 200 }))
    await cliente.GET('/api/vecino/yo')
    await cliente.POST('/api/reportes', { body: { tipo: 'SIN_AGUA', sectorId: 'manga' } })
    await cliente.GET('/api/sectores')
    expect(peticiones.map((peticion) => peticion.headers.get('Authorization'))).toEqual([null, null, null])
  })

  it('debeMandarElTokenDelVecinoSoloAlPerfilYALosReportes', async () => {
    sesionVecino.guardar('del-vecino')
    const { cliente, peticiones } = clienteQueResponde(() => new Response('{}', { status: 200 }))
    await cliente.GET('/api/vecino/yo')
    await cliente.POST('/api/reportes', { body: { tipo: 'SIN_AGUA', sectorId: 'manga' } })
    await cliente.POST('/api/reportes/{id}/confirmar', { params: { path: { id: 'r1' } } })
    await cliente.GET('/api/veedor/yo')
    await cliente.GET('/api/sectores')
    expect(peticiones.map((peticion) => peticion.headers.get('Authorization'))).toEqual([
      'Bearer del-vecino', 'Bearer del-vecino', 'Bearer del-vecino', null, null,
    ])
  })

  it('noDebeLlevarUnTokenAnteriorAlIniciarSesionComoVecino', async () => {
    sesionVecino.guardar('anterior')
    const { cliente, peticiones } = clienteQueResponde(() => new Response('{}', { status: 200 }))
    await cliente.POST('/api/vecino/sesion', { body: { correo: 'a@example.com', clave: 'una clave larga' } })
    expect(peticiones[0]?.headers.get('Authorization')).toBeNull()
  })

  it('debeBorrarSoloLaSesionDeLaQueEraElTokenAnteUn401', async () => {
    sesion.guardar('del-panel')
    sesionVecino.guardar('del-vecino')
    const { cliente } = clienteQueResponde(() => new Response(null, { status: 401 }))
    await cliente.GET('/api/vecino/yo')
    expect(sesionVecino.token()).toBeNull()
    expect(sesion.token()).toBe('del-panel')
    sesionVecino.guardar('otra-vez')
    await cliente.GET('/api/veedor/yo')
    expect(sesion.token()).toBeNull()
    expect(sesionVecino.token()).toBe('otra-vez')
  })

  it('noDebeCerrarLaSesionDelVecinoCuandoElDispositivoDelReporteNoEsValido', async () => {
    sesionVecino.guardar('vigente')
    const { cliente } = clienteQueResponde(() => respuestaProblema(problema('dispositivo-invalido', 401), 401))
    await cliente.POST('/api/reportes', { body: { tipo: 'SIN_AGUA', sectorId: 'manga' } })
    expect(sesionVecino.token()).toBe('vigente')
  })

  it('debeCerrarLaSesionDelVecinoSiSuTokenMurioAlReportar', async () => {
    sesionVecino.guardar('vencido')
    const { cliente } = clienteQueResponde(() => new Response(null, { status: 401 }))
    await cliente.POST('/api/reportes', { body: { tipo: 'SIN_AGUA', sectorId: 'manga' } })
    expect(sesionVecino.token()).toBeNull()
  })
})
