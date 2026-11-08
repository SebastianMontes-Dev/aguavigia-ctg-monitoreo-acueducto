import { anularCorte, cerrarBarrio, cerrarCorte, confirmarCierre, leerCortesDelBarrio, leerDisputas, leerVencidos, registrarCorte } from './cortes-veedor'
import { crearCliente } from './cliente'
import { sesion } from './sesion'

const TIPO = 'https://aguavigia.example/errores/'

function json(estado: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': estado >= 400 ? 'application/problem+json' : 'application/json' } })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function peticion(pedir: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) {
  const enviada = pedir.mock.calls[n]?.[0]
  if (!(enviada instanceof Request)) throw new Error(`la petición ${n} no se envió`)
  const copia = enviada.clone()
  return { ruta: new URL(copia.url).pathname, busqueda: new URL(copia.url).search, metodo: copia.method, cuerpo: copia.method === 'GET' ? null : await copia.json() as unknown }
}

afterEach(() => sesion.limpiar())

describe('lecturas del panel de cortes', () => {
  it('debePedirLosCortesDeUnBarrioConSuSectorId', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [{ id: 'c1' }]))
    expect(await leerCortesDelBarrio('manga', { cliente: clienteCon(pedir) })).toEqual([{ id: 'c1' }])
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/cortes', busqueda: '?sectorId=manga', metodo: 'GET' })
  })

  it('debeLeerVencidosYDisputas', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, [{ id: 'c1' }]))
      .mockResolvedValueOnce(json(200, [{ id: 'manga', enDisputa: true }]))
    expect(await leerVencidos({ cliente: clienteCon(pedir) })).toEqual([{ id: 'c1' }])
    expect(await leerDisputas({ cliente: clienteCon(pedir) })).toEqual([{ id: 'manga', enDisputa: true }])
    expect((await peticion(pedir, 0)).ruta).toBe('/api/veedor/cortes/vencidos')
    expect((await peticion(pedir, 1)).ruta).toBe('/api/veedor/disputas')
  })

  it('debeFallarSinDevolverUnaListaVaciaSiElServidorResponde503', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(503, { type: `${TIPO}servicio-no-disponible` }))
    await expect(leerVencidos({ cliente: clienteCon(pedir) })).rejects.toMatchObject({ estado: 503 })
  })
})

describe('acciones sobre cortes', () => {
  const corte = { id: 'c1', estado: 'ANUNCIADO' }

  it('debeRegistrarUnCorteConLasFechasEnUtc', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(201, corte))
    const solicitud = { sectoresAfectados: ['manga'], inicio: '2026-10-30T13:00:00.000Z', finPrometido: '2026-10-30T18:00:00.000Z', causa: 'Mantenimiento' }
    expect(await registrarCorte(solicitud, clienteCon(pedir))).toEqual({ tipo: 'hecho', dato: corte })
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/cortes', metodo: 'POST', cuerpo: solicitud })
  })

  it('debeCerrarTodosUnBarrioYConfirmarCadaUnoPorSuRuta', async () => {
    const pedir = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json(200, corte)))
    const hora = '2026-10-30T19:00:00.000Z'
    await cerrarCorte('c1', hora, clienteCon(pedir))
    await cerrarBarrio('c1', 'manga', hora, clienteCon(pedir))
    await confirmarCierre('c1', 'manga', hora, clienteCon(pedir))
    expect(await peticion(pedir, 0)).toMatchObject({ ruta: '/api/veedor/cortes/c1/cierre', metodo: 'PATCH', cuerpo: { horaReal: hora } })
    expect(await peticion(pedir, 1)).toMatchObject({ ruta: '/api/veedor/cortes/c1/sectores/manga/cierre', metodo: 'PATCH', cuerpo: { horaReal: hora } })
    expect(await peticion(pedir, 2)).toMatchObject({ ruta: '/api/veedor/cortes/c1/sectores/manga/confirmacion', metodo: 'PATCH', cuerpo: { horaReal: hora } })
  })

  it('debeAnularConElMotivo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { ...corte, estado: 'ANULADO' }))
    await anularCorte('c1', 'Era de otro barrio', clienteCon(pedir))
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/cortes/c1/anulacion', metodo: 'PATCH', cuerpo: { motivo: 'Era de otro barrio' } })
  })

  it.each([
    ['cerrar un corte ya cerrado', () => cerrarCorte('c1', 'h')],
    ['anular un corte ya anulado', () => anularCorte('c1', 'm')],
  ])('debeDecirConflictoAlIntentar_%s', async (_nombre, accion) => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(409, { type: `${TIPO}conflicto-de-estado` }))
    const original = globalThis.fetch
    globalThis.fetch = pedir as typeof fetch
    try {
      expect(await accion()).toEqual({ tipo: 'conflicto' })
    } finally {
      globalThis.fetch = original
    }
  })

  it('debeExplicarUn400SinMotivoComoRechazo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(400, { type: `${TIPO}peticion-invalida`, detail: 'Falta el motivo' }))
    expect(await anularCorte('c1', '', clienteCon(pedir))).toEqual({ tipo: 'rechazado', mensaje: 'Falta el motivo' })
  })
})
