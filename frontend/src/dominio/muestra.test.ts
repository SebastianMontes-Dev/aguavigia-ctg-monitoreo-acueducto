import { conclusionPendiente, MUESTRA_SUFICIENTE, muestraSuficiente } from './muestra'

describe('muestra', () => {
  it('debeExigirCincoCortesParaSacarUnaConclusion', () => {
    expect(MUESTRA_SUFICIENTE).toBe(5)
    expect(muestraSuficiente(4)).toBe(false)
    expect(muestraSuficiente(5)).toBe(true)
  })

  it('debeDecirCuantosCortesHayYCuantosFaltan', () => {
    expect(conclusionPendiente(1, 'cerrado')).toBe('Con 1 corte cerrado todavía no se puede sacar una conclusión: hacen falta al menos 5.')
    expect(conclusionPendiente(3, 'registrado')).toBe('Con 3 cortes registrados todavía no se puede sacar una conclusión: hacen falta al menos 5.')
  })
})
