import { campoDesdeInstante, instanteDesdeCartagena } from './hora-cartagena'

describe('hora de Cartagena', () => {
  it('debeConvertirLaHoraEscritaAUtcSumandoCincoHoras', () => {
    expect(instanteDesdeCartagena('2026-10-30T14:30')).toBe('2026-10-30T19:30:00.000Z')
  })

  it('debeCruzarElDiaCuandoLaHoraDeCartagenaPasaLasSieteDeLaTarde', () => {
    expect(instanteDesdeCartagena('2026-10-30T20:15')).toBe('2026-10-31T01:15:00.000Z')
  })

  it('noDebeDependerDeLaZonaDelNavegador', () => {
    const zona = process.env.TZ
    try {
      process.env.TZ = 'Asia/Tokyo'
      expect(instanteDesdeCartagena('2026-01-01T00:00')).toBe('2026-01-01T05:00:00.000Z')
      process.env.TZ = 'America/Los_Angeles'
      expect(instanteDesdeCartagena('2026-01-01T00:00')).toBe('2026-01-01T05:00:00.000Z')
    } finally {
      if (zona === undefined) delete process.env.TZ
      else process.env.TZ = zona
    }
  })

  it('debeAceptarSegundosOpcionales', () => {
    expect(instanteDesdeCartagena('2026-10-30T14:30:15')).toBe('2026-10-30T19:30:15.000Z')
  })

  it('debeRechazarLoQueNoEsUnaFechaReal', () => {
    expect(instanteDesdeCartagena('')).toBeNull()
    expect(instanteDesdeCartagena('mañana')).toBeNull()
    expect(instanteDesdeCartagena('2026-02-30T10:00')).toBeNull()
    expect(instanteDesdeCartagena('2026-13-01T10:00')).toBeNull()
    expect(instanteDesdeCartagena('2026-10-30T25:00')).toBeNull()
  })

  it('debeVolverAlCampoConLaHoraDeCartagena', () => {
    expect(campoDesdeInstante('2026-10-30T19:30:00Z')).toBe('2026-10-30T14:30')
    expect(campoDesdeInstante('2026-10-31T01:15:00Z')).toBe('2026-10-30T20:15')
    expect(campoDesdeInstante(new Date('2026-10-30T19:30:00Z'))).toBe('2026-10-30T14:30')
  })

  it('debeIrYVolverSinCambiarLaHora', () => {
    const campo = '2026-03-08T02:30'
    expect(campoDesdeInstante(instanteDesdeCartagena(campo) ?? '')).toBe(campo)
  })
})
