import { crearCliente } from './cliente'
import { anularPropuesta, aprobarPropuesta, descartarPropuesta, leerFallidos, leerPropuestas, leerSalud } from './ingesta'
import { sesion } from './sesion'

const TIPO = 'https://aguavigia.example/errores/'

function json(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': estado >= 400 ? 'application/problem+json' : 'application/json', ...cabeceras } })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function peticion(pedir: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) {
  const enviada = pedir.mock.calls[n]?.[0]
  if (!(enviada instanceof Request)) throw new Error(`la petición ${n} no se envió`)
  const copia = enviada.clone()
  return { ruta: new URL(copia.url).pathname, busqueda: new URL(copia.url).search, metodo: copia.method, cuerpo: copia.method === 'GET' || copia.method === 'PATCH' && !copia.headers.get('content-type') ? null : await copia.json() as unknown }
}

afterEach(() => sesion.limpiar())

describe('lecturas de la ingesta', () => {
  it('debePedirLasPropuestasPaginadasYLeerElTotalDeLasCabeceras', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [{ id: 'p1' }], { 'X-Total-Count': '41', 'X-Total-Pages': '3', 'X-Page': '1', Link: '</api/x?pagina=2>; rel="next"' }))
    const pagina = await leerPropuestas(1, { cliente: clienteCon(pedir) })
    expect(pagina.propuestas).toEqual([{ id: 'p1' }])
    expect(pagina.paginacion).toMatchObject({ total: 41, pagina: 1, hayMas: true })
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/ingesta/propuestas', busqueda: '?pagina=1&tamano=20', metodo: 'GET' })
  })

  it('debeLeerFallidosYSaludSinConfundirUnaListaVaciaConUnFallo', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, []))
      .mockResolvedValueOnce(json(200, [{ nombre: 'acuacar', fallosConsecutivos: 3 }]))
      .mockResolvedValueOnce(json(503, { type: `${TIPO}servicio-no-disponible` }))
    expect(await leerFallidos({ cliente: clienteCon(pedir) })).toEqual([])
    expect(await leerSalud({ cliente: clienteCon(pedir) })).toEqual([{ nombre: 'acuacar', fallosConsecutivos: 3 }])
    await expect(leerFallidos({ cliente: clienteCon(pedir) })).rejects.toMatchObject({ estado: 503 })
    expect((await peticion(pedir, 0)).ruta).toBe('/api/veedor/ingesta/fallidos')
    expect((await peticion(pedir, 1)).ruta).toBe('/api/veedor/ingesta/salud')
  })
})

describe('decisiones sobre propuestas', () => {
  const propuesta = { id: 'p1', estadoRevision: 'APROBADA' }

  it('debeAprobarYDescartarPorSuRuta', async () => {
    const pedir = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json(200, propuesta)))
    expect(await aprobarPropuesta('p1', clienteCon(pedir))).toEqual({ tipo: 'hecho', dato: propuesta })
    await descartarPropuesta('p1', clienteCon(pedir))
    expect(await peticion(pedir, 0)).toMatchObject({ ruta: '/api/veedor/ingesta/propuestas/p1/aprobar', metodo: 'PATCH' })
    expect(await peticion(pedir, 1)).toMatchObject({ ruta: '/api/veedor/ingesta/propuestas/p1/descartar', metodo: 'PATCH' })
  })

  it('debeAnularConElMotivo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { ...propuesta, estadoRevision: 'ANULADA' }))
    await anularPropuesta('p1', 'El boletín hablaba de otro barrio', clienteCon(pedir))
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/ingesta/propuestas/p1/anulacion', metodo: 'PATCH', cuerpo: { motivo: 'El boletín hablaba de otro barrio' } })
  })

  it.each([
    [409, { tipo: 'conflicto' }],
    [404, { tipo: 'no-existe' }],
    [403, { tipo: 'sin-permiso' }],
    [401, { tipo: 'sesion-terminada' }],
  ])('debeInterpretarElCodigo_%i', async (estado, esperado) => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(estado, { type: `${TIPO}x` }))
    expect(await aprobarPropuesta('p1', clienteCon(pedir))).toEqual(esperado)
  })

  it('debeExplicarUn400SinMotivoComoRechazo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(400, { type: `${TIPO}peticion-invalida`, detail: 'Falta el motivo' }))
    expect(await anularPropuesta('p1', '', clienteCon(pedir))).toEqual({ tipo: 'rechazado', mensaje: 'Falta el motivo' })
  })
})
