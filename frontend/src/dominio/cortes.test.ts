import {
  compararCorte, cierreProvisional, estaAbierto, estaCerrado, fuenteEnPalabras, horaReal, origenEnPalabras, promesaVencida,
  sinHoraRealEnPalabras, type Corte,
} from './cortes'

const AHORA = new Date('2026-09-26T15:00:00Z')

const abierto: Corte = {
  id: 'c1',
  sectoresAfectados: ['armenia', 'manga'],
  inicio: '2026-09-26T11:00:00Z',
  finPrometido: '2026-09-26T14:00:00Z',
  estado: 'CONFIRMADO',
  cierres: [],
}

const conCierres = (cierres: NonNullable<Corte['cierres']>, estado = 'CONFIRMADO'): Corte => ({ ...abierto, estado, cierres })

describe('estaAbierto', () => {
  it('debeReconocerUnCorteAbiertoYSuPromesaVencida', () => {
    expect(estaAbierto(abierto)).toBe(true)
    expect(promesaVencida(abierto, AHORA)).toBe(true)
    expect(promesaVencida({ ...abierto, finPrometido: '2026-09-26T18:00:00Z' }, AHORA)).toBe(false)
  })

  it('noDebeTratarComoAbiertosLosCortesRestablecidosExpiradosNiAnulados', () => {
    for (const estado of ['RESTABLECIDO', 'EXPIRADO', 'ANULADO']) {
      expect(estaAbierto({ ...abierto, estado })).toBe(false)
      expect(promesaVencida({ ...abierto, estado }, AHORA)).toBe(false)
    }
  })

  it('debeSeguirAbiertoParaLosBarriosQueNoHanCerradoAunqueOtroYaLoHizo', () => {
    const parcial = conCierres([{ sectorId: 'armenia', hora: '2026-09-26T13:00:00Z', fuente: 'VEEDOR', provisional: false }])
    expect(estaAbierto(parcial)).toBe(true)
    expect(estaAbierto(parcial, 'manga')).toBe(true)
    expect(estaAbierto(parcial, 'armenia')).toBe(false)
  })
})

describe('horaReal', () => {
  const cierres = [
    { sectorId: 'armenia', hora: '2026-09-26T13:00:00Z', fuente: 'VEEDOR', provisional: false },
    { sectorId: 'manga', hora: '2026-09-26T16:30:00Z', fuente: 'VECINOS', provisional: true },
  ]

  it('debeDarLaHoraDeCadaBarrioYElUltimoCierreParaElCorteEntero', () => {
    const restablecido = conCierres(cierres, 'RESTABLECIDO')
    expect(horaReal(restablecido, 'armenia')).toBe('2026-09-26T13:00:00Z')
    expect(horaReal(restablecido, 'manga')).toBe('2026-09-26T16:30:00Z')
    expect(horaReal(restablecido)).toBe('2026-09-26T16:30:00Z')
  })

  it('noDebeInventarUnaHoraDelCorteEnteroMientrasFalteUnBarrio', () => {
    const parcial = conCierres([cierres[0]!])
    expect(horaReal(parcial)).toBeNull()
    expect(horaReal(parcial, 'armenia')).toBe('2026-09-26T13:00:00Z')
    expect(horaReal(parcial, 'manga')).toBeNull()
  })

  it('noDebeTenerHoraRealUnCorteExpiradoOAnuladoAunqueTengaCierres', () => {
    expect(horaReal(conCierres(cierres, 'EXPIRADO'), 'armenia')).toBeNull()
    expect(horaReal(conCierres(cierres, 'ANULADO'))).toBeNull()
    expect(estaCerrado(conCierres(cierres, 'EXPIRADO'), 'armenia')).toBe(false)
  })

  it('debeDistinguirElCierreProvisionalDelConfirmado', () => {
    const restablecido = conCierres(cierres, 'RESTABLECIDO')
    expect(cierreProvisional(restablecido, 'armenia')).toBe(false)
    expect(cierreProvisional(restablecido, 'manga')).toBe(true)
  })
})

describe('compararCorte', () => {
  const cierre = (hora: string) => [{ sectorId: 'armenia', hora, fuente: 'VEEDOR', provisional: false }]

  it('debeDecirElVeredictoEnPalabrasYDarLasDosMarcasComoFechas', () => {
    const pasado = compararCorte({ ...abierto, finPrometido: '2026-09-26T13:00:00Z', estado: 'RESTABLECIDO', cierres: cierre('2026-09-26T19:00:00Z') })
    expect(pasado).toEqual({
      provisional: false,
      veredicto: 'El agua tardó 6 horas más de lo prometido',
      prometidoEn: '2026-09-26T13:00:00Z',
      realEn: '2026-09-26T19:00:00Z',
    })
  })

  it('debeDecirCuantoAntesVolvioElAgua', () => {
    const antes = compararCorte({ ...abierto, finPrometido: '2026-09-26T15:00:00Z', estado: 'RESTABLECIDO', cierres: cierre('2026-09-26T14:30:00Z') })
    expect(antes?.veredicto).toBe('El agua volvió 30 minutos antes de lo prometido')
  })

  it('debeDarPorCumplidoLoQueDifiereMenosDe15Minutos', () => {
    const justo = compararCorte({ ...abierto, finPrometido: '2026-09-26T15:00:00Z', estado: 'RESTABLECIDO', cierres: cierre('2026-09-26T15:10:00Z') })
    expect(justo?.veredicto).toBe('El agua volvió a la hora prometida')
  })

  it('noDebeCompararUnCorteQueSigueAbierto', () => {
    expect(compararCorte(abierto)).toBeNull()
  })

  it('debeCompararCadaBarrioConSuPropioCierreYMarcarElProvisional', () => {
    const corte = conCierres([
      { sectorId: 'armenia', hora: '2026-09-26T13:00:00Z', fuente: 'VEEDOR', provisional: false },
      { sectorId: 'manga', hora: '2026-09-26T19:00:00Z', fuente: 'VECINOS', provisional: true },
    ])
    expect(compararCorte(corte, 'armenia')).toMatchObject({ veredicto: 'El agua volvió 1 hora antes de lo prometido', provisional: false })
    expect(compararCorte(corte, 'manga')).toMatchObject({ veredicto: 'El agua tardó 5 horas más de lo prometido', provisional: true })
    expect(compararCorte(corte)).toBeNull()
  })
})

describe('textos', () => {
  it('noDebeUsarLaPalabraVeedorEnNingunTextoQueVeElPublico', () => {
    const textos = [
      origenEnPalabras('VEEDOR'), origenEnPalabras('INGESTA_IA'), fuenteEnPalabras('VEEDOR'), fuenteEnPalabras('PRENSA'),
    ]
    for (const texto of textos) expect(texto).not.toMatch(/veedor/i)
  })

  it('debeAtribuirSoloLosOrigenesConocidos', () => {
    expect(origenEnPalabras('OFICIAL_ACUACAR')).toBe('Aviso oficial de Acuacar')
    expect(origenEnPalabras('OTRO')).toBeNull()
    expect(origenEnPalabras(undefined)).toBeNull()
  })

  it('debeDecirLosCincoValoresDeLaFuenteYNoAtribuirUnoDesconocido', () => {
    for (const fuente of ['ACUACAR', 'PRENSA', 'VEEDOR', 'VECINOS', 'SENSOR']) expect(fuenteEnPalabras(fuente)).toEqual(expect.any(String))
    expect(fuenteEnPalabras('OTRA')).toBeNull()
    expect(fuenteEnPalabras(null)).toBeNull()
  })

  it('debeExplicarQueUnCorteExpiradoONuloNoTieneHoraReal', () => {
    expect(sinHoraRealEnPalabras({ ...abierto, estado: 'EXPIRADO' })).toBe('Nadie confirmó el restablecimiento; no cuenta en el Índice.')
    expect(sinHoraRealEnPalabras({ ...abierto, estado: 'ANULADO', motivoAnulacion: 'Aviso duplicado' })).toBe('Publicado por error: Aviso duplicado')
    expect(sinHoraRealEnPalabras({ ...abierto, estado: 'ANULADO' })).toBe('Publicado por error.')
    expect(sinHoraRealEnPalabras(abierto)).toBeNull()
  })
})
