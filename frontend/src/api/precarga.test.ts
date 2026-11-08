import { leerPrecargado, tomarPrecargado } from './precarga'

// RNF001: index.html pide lecturas mientras baja el JavaScript; la pantalla las toma una sola vez.
describe('precarga', () => {
  afterEach(() => { window.precargas = undefined })

  it('debeEntregarLaPeticionAdelantadaUnaSolaVez', () => {
    const adelantada = Promise.resolve(new Response('{}'))
    window.precargas = { '/api/cumplimiento': adelantada }
    expect(tomarPrecargado('/api/cumplimiento')).toBe(adelantada)
    expect(tomarPrecargado('/api/cumplimiento')).toBeUndefined()
  })

  it('debeDecirQueNoHayNadaSiIndexHtmlNoLaPidio', () => {
    expect(tomarPrecargado('/api/cumplimiento')).toBeUndefined()
    window.precargas = { '/api/cumplimiento/serie': Promise.resolve(null) }
    expect(tomarPrecargado('/api/cumplimiento')).toBeUndefined()
  })

  it('debeLeerElCuerpoYDevolverLaRespuestaParaDecidirPorSuEstado', async () => {
    window.precargas = { '/api/cumplimiento': Promise.resolve(new Response('{"a":1}', { status: 400 })) }
    const leido = await leerPrecargado<{ a: number }>('/api/cumplimiento')
    expect(leido?.respuesta.status).toBe(400)
    expect(leido?.cuerpo).toEqual({ a: 1 })
  })

  it('debePedirDeNuevoSiLaPeticiónAdelantadaFallo', async () => {
    window.precargas = { '/api/cumplimiento': Promise.resolve(null) }
    expect(await leerPrecargado('/api/cumplimiento')).toBeNull()
  })
})
