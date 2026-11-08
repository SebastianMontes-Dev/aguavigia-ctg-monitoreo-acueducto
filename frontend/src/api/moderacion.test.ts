import { interpretarAccion } from './acciones-panel'
import { blobADataUrl, leerPendientes, moderarReporte } from './moderacion'
import { crearCliente } from './cliente'
import { sesion } from './sesion'

const TIPO = 'https://aguavigia.example/errores/'

function json(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': estado >= 400 ? 'application/problem+json' : 'application/json', ...cabeceras },
  })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function peticion(pedir: ReturnType<typeof vi.fn<typeof fetch>>, n = 0): Promise<Request> {
  const enviada = pedir.mock.calls[n]?.[0]
  if (!(enviada instanceof Request)) throw new Error(`la petición ${n} no se envió`)
  return enviada.clone()
}

afterEach(() => sesion.limpiar())

describe('interpretarAccion', () => {
  it('debeLeerCadaCodigoDeLaApiPorSuEstado', () => {
    const r = (estado: number, cabeceras: Record<string, string> = {}) => new Response(null, { status: estado, headers: cabeceras })
    expect(interpretarAccion(r(200), { id: 'r1' })).toEqual({ tipo: 'hecho', dato: { id: 'r1' } })
    expect(interpretarAccion(r(404), { type: `${TIPO}recurso-no-encontrado` })).toEqual({ tipo: 'no-existe' })
    expect(interpretarAccion(r(409), { type: `${TIPO}conflicto-de-estado` })).toEqual({ tipo: 'conflicto' })
    expect(interpretarAccion(r(403), { type: `${TIPO}acceso-denegado` })).toEqual({ tipo: 'sin-permiso' })
    expect(interpretarAccion(r(401), { type: `${TIPO}sesion-sin-cuenta` })).toEqual({ tipo: 'sesion-terminada' })
    expect(interpretarAccion(r(429, { 'Retry-After': '90' }), { type: `${TIPO}limite-de-peticiones-excedido` })).toEqual({ tipo: 'esperar', segundos: 90 })
    expect(interpretarAccion(r(500), null)).toEqual({ tipo: 'fallo' })
    expect(interpretarAccion(null, null)).toEqual({ tipo: 'sin-red' })
  })

  it('debeDevolverElDetalleDeUnRechazo400SinReaccionarAlTexto', () => {
    const resultado = interpretarAccion(new Response(null, { status: 400 }), { type: `${TIPO}peticion-invalida`, detail: 'Falta el motivo' })
    expect(resultado).toEqual({ tipo: 'rechazado', mensaje: 'Falta el motivo' })
  })
})

describe('leerPendientes', () => {
  it('debePedirLaPaginaConElTokenYLeerLaPaginacionDeLasCabeceras', async () => {
    sesion.guardar('t-veedor')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [{ id: 'r1', senalRed: true }], { 'X-Total-Count': '45', 'X-Total-Pages': '3', 'X-Page': '1' }))
    const pagina = await leerPendientes(1, { cliente: clienteCon(pedir) })
    expect(pagina.reportes).toEqual([{ id: 'r1', senalRed: true }])
    expect(pagina.paginacion).toMatchObject({ total: 45, paginas: 3, pagina: 1, hayMas: true })
    const enviada = await peticion(pedir)
    expect(new URL(enviada.url).searchParams.get('pagina')).toBe('1')
    expect(enviada.headers.get('Authorization')).toBe('Bearer t-veedor')
  })

  it('debeFallarConElErrorNormalizadoSiLaColaNoResponde', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(503, { type: `${TIPO}servicio-no-disponible` }))
    await expect(leerPendientes(0, { cliente: clienteCon(pedir) })).rejects.toMatchObject({ estado: 503, reintentable: true })
  })
})

describe('moderarReporte', () => {
  it.each([
    ['aprobar', '/api/veedor/reportes/r1/aprobar'],
    ['descartar', '/api/veedor/reportes/r1/descartar'],
    ['foto', '/api/veedor/reportes/r1/foto/descartar'],
  ] as const)('debeMandarUnPatchAlaRutaDe_%s', async (accion, ruta) => {
    sesion.guardar('t-veedor')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { id: 'r1', estadoModeracion: 'APROBADO' }))
    expect(await moderarReporte('r1', accion, clienteCon(pedir))).toEqual({ tipo: 'hecho', dato: { id: 'r1', estadoModeracion: 'APROBADO' } })
    const enviada = await peticion(pedir)
    expect(enviada.method).toBe('PATCH')
    expect(new URL(enviada.url).pathname).toBe(ruta)
    expect(enviada.headers.get('Authorization')).toBe('Bearer t-veedor')
  })

  it('debeDecirQueElReporteNoTieneFotoCuandoElServidorResponde409', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(409, { type: `${TIPO}conflicto-de-estado` }))
    expect(await moderarReporte('r1', 'foto', clienteCon(pedir))).toEqual({ tipo: 'conflicto' })
  })

  it('noDebeReintentarSoloAnteUnFalloDeRed', async () => {
    const pedir = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await moderarReporte('r1', 'aprobar', clienteCon(pedir))).toEqual({ tipo: 'sin-red' })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('debeDejarLaSesionIntactaAnteUn403PorFaltaDePermiso', async () => {
    sesion.guardar('t-veedor')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(403, { type: `${TIPO}acceso-denegado` }))
    expect(await moderarReporte('r1', 'aprobar', clienteCon(pedir))).toEqual({ tipo: 'sin-permiso' })
    expect(sesion.token()).toBe('t-veedor')
  })
})

describe('blobADataUrl', () => {
  it('debeConvertirLaFotoEnUnaUrlDeDatosParaMostrarlaSinObjetosLocales', async () => {
    const url = await blobADataUrl(new Blob(['x'], { type: 'image/jpeg' }))
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})
