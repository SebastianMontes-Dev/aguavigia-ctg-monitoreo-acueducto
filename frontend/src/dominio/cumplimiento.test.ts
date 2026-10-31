import { describe, expect, it } from 'vitest'
import { cumplimientoDeEjemplo, cumplimientoDecimalDeEjemplo, serieDeEjemplo } from '../pruebas/datos/historia'
import {
  conclusionCumplimiento,
  diferenciaEnPalabras,
  diferenciaMensualPorCorte,
  duracionAcumulada,
  duracionCorta,
  faltanteEnPalabras,
  ordenarSerie,
  periodoEnPalabras,
  posicionEnLinea,
  respuestaEnPalabras,
  resumirCumplimiento,
  significadoIndice,
  solidezIndice,
  titularVeredicto,
  veredicto,
} from './cumplimiento'

describe('cumplimiento', () => {
  it('debeExpresarLaDiferenciaTotalCuandoNoHaySerie', () => {
    expect(conclusionCumplimiento(cumplimientoDeEjemplo)).toBe('En total, los cortes cerrados duraron 2 horas y 30 minutos más de lo anunciado.')
    expect(conclusionCumplimiento({ ...cumplimientoDeEjemplo, desviacionSegundos: 0 })).toBe('En total, los cortes cerrados duraron lo anunciado.')
    expect(conclusionCumplimiento(cumplimientoDecimalDeEjemplo)).not.toContain('66,7%')
    expect(duracionAcumulada(86_400 + 59 * 60)).toBe('1 día')
  })

  it('debeEscribirLaDuracionDeUnCorteEnFormaCorta', () => {
    expect(duracionCorta(87_660)).toBe('24 h 21 min')
    expect(duracionCorta(45 * 60)).toBe('45 min')
    expect(duracionCorta(3 * 3600)).toBe('3 h')
    expect(duracionCorta(74 * 3600)).toBe('3 días 2 h')
  })

  it('debePromediarPorCorteConElConteoDeLaSerie', () => {
    const resumen = resumirCumplimiento(
      { duracionPrometidaSegundos: 10_519_200, duracionRealSegundos: 10_464_094, desviacionSegundos: -55_106, porcentajeCumplimiento: 100 },
      [{ periodo: '2026-07', cantidadCortes: 37 }, { periodo: '2026-05', cantidadCortes: 39 }, { periodo: '2026-06', cantidadCortes: 44 }],
    )
    expect(resumen).toMatchObject({ cortes: 120, primerMes: '2026-05', ultimoMes: '2026-07' })
    expect(duracionCorta(resumen!.prometidoPorCorte)).toBe('24 h 21 min')
    expect(diferenciaEnPalabras(resumen!.diferenciaPorCorte)).toBe('8 min antes')
  })

  it('noDebeInventarElPromedioSinSerieNiConteo', () => {
    expect(resumirCumplimiento(cumplimientoDeEjemplo, undefined)).toBeNull()
    expect(resumirCumplimiento(cumplimientoDeEjemplo, [{ periodo: '2026-05' }])).toBeNull()
  })

  it('debeElegirElVeredictoConUnMargenDeCincoMinutosPorCorte', () => {
    expect(veredicto(-459)).toBe('antes')
    expect(veredicto(-120)).toBe('a-tiempo')
    expect(veredicto(300)).toBe('despues')
    expect(titularVeredicto(-459)).toBe('El agua vuelve antes de la hora anunciada')
    expect(titularVeredicto(1800, 'Manga')).toBe('En Manga, el agua vuelve más tarde de la hora anunciada')
    expect(titularVeredicto(120)).toBe('El agua vuelve a la hora anunciada')
  })

  it('debeExplicarElIndiceEnLaMismaLinea', () => {
    expect(significadoIndice(100)).toBe('duraron lo anunciado o menos')
    expect(significadoIndice(80)).toMatch(/^lo anunciado cubrió el 80\s?% de lo que duraron$/)
  })

  it('debeCalcularLaDiferenciaMensualPorCorteSinDividirEntreCero', () => {
    expect(diferenciaMensualPorCorte(serieDeEjemplo[0]!)).toBe(-1800)
    expect(diferenciaMensualPorCorte({ periodo: '2026-01', desviacionSegundos: 100, cantidadCortes: 0 })).toBeNull()
    expect(diferenciaEnPalabras(20)).toBe('A la hora')
    expect(diferenciaEnPalabras(1980)).toBe('33 min tarde')
  })

  it('debeNombrarElPeriodoSinRepetirElAnio', () => {
    expect(periodoEnPalabras('2026-05', '2026-07')).toBe('mayo a julio de 2026')
    expect(periodoEnPalabras('2025-12', '2026-02')).toBe('diciembre de 2025 a febrero de 2026')
    expect(periodoEnPalabras('2026-07', '2026-07')).toBe('julio de 2026')
  })

  it('debeOrdenarLaSerieSinInventarMesesVacios', () => {
    const serie = ordenarSerie([serieDeEjemplo[2]!, serieDeEjemplo[0]!])
    expect(serie.map((punto) => punto.periodo)).toEqual(['2026-04', '2026-06'])
  })

  it('debeDeclararJuntoAlIndiceSoloLoQueLoDebilitaYEsMayorQueCero', () => {
    expect(solidezIndice({ porcentajeProvisional: 0, cortesSinCierreConfirmado: 0, cortesAnulados: 0 })).toEqual([])
    expect(solidezIndice({})).toEqual([])
    expect(solidezIndice({ porcentajeProvisional: 25, cortesSinCierreConfirmado: 12, cortesAnulados: 1 })).toEqual([
      'El 25% de los cierres solo lo reportaron vecinos y aún puede corregirse.',
      'Quedan fuera 12 cortes vencidos sin cierre confirmado y 1 anulado.',
    ])
    expect(solidezIndice({ cortesSinCierreConfirmado: 1 })).toEqual(['Queda fuera 1 corte vencido sin cierre confirmado.'])
    expect(solidezIndice({ cortesAnulados: 3 })).toEqual(['Quedan fuera 3 cortes anulados.'])
  })

  it('debeDecirConCifrasQueFaltaCuandoNoHayUnSoloCierre', () => {
    expect(faltanteEnPalabras(undefined)).toBeNull()
    expect(faltanteEnPalabras({ cierresMedidos: 0, cierresProvisionales: 0, porcentajeProvisional: 0, cortesSinCierreConfirmado: 0, cortesAnulados: 0 })).toBeNull()
    expect(faltanteEnPalabras({ cierresMedidos: 0, cortesSinCierreConfirmado: 12, cortesAnulados: 2 }))
      .toBe('Hay 12 cortes vencidos sin cierre confirmado: nadie confirmó cuándo volvió el agua. 2 cortes se anularon por error.')
    expect(faltanteEnPalabras({ cortesSinCierreConfirmado: 1, cortesAnulados: 1 }))
      .toBe('Hay 1 corte vencido sin cierre confirmado: nadie confirmó cuándo volvió el agua. 1 corte se anuló por error.')
  })

  it('debeDecirCuandoVuelveElAguaFrenteALaHoraAnunciada', () => {
    expect(respuestaEnPalabras(-420)).toBe('El agua vuelve 7 minutos antes de la hora anunciada, en promedio.')
    expect(respuestaEnPalabras(60)).toBe('El agua vuelve 1 minuto más tarde de la hora anunciada, en promedio.')
    expect(respuestaEnPalabras(5400)).toBe('El agua vuelve 1 hora y 30 minutos más tarde de la hora anunciada, en promedio.')
    expect(respuestaEnPalabras(10)).toBe('En promedio, el agua vuelve a la hora anunciada.')
  })

  it('debeUbicarElPuntoEnLaLineaConUnaHoraACadaLadoYRecortarLoQueSePase', () => {
    expect(posicionEnLinea(0)).toBe(50)
    expect(posicionEnLinea(-1800)).toBe(25)
    expect(posicionEnLinea(1980)).toBeCloseTo(77.5)
    expect(posicionEnLinea(-9000)).toBe(0)
    expect(posicionEnLinea(9000)).toBe(100)
  })
})
