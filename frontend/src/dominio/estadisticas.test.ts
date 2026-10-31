import { describe, expect, it } from 'vitest'
import { estadisticasDeEjemplo } from '../pruebas/datos/historia'
import {
  bajadaBarrios,
  diasExtremos,
  disponibilidadEstadisticas,
  empateDeBarrios,
  horasCortas,
  horasEnPalabras,
  listaDeDias,
  mesCorto,
  mesDestacado,
  mesesConCierres,
  novedadesPorTipo,
  ordenarBarrios,
  ordenarDias,
  reglasDeBarrios,
  reglasDeGrafica,
  reglasDelInforme,
  resumenDeSerie,
  titularEstadisticas,
  type DatosDeMedicion,
} from './estadisticas'

describe('estadísticas', () => {
  it('debeOrdenarLosSieteDiasYConservarLosCerosReales', () => {
    expect(ordenarDias(estadisticasDeEjemplo.cortesPorDiaDeSemana)).toEqual([
      { dia: 'Lunes', cortes: 2 }, { dia: 'Martes', cortes: 3 }, { dia: 'Miércoles', cortes: 7 },
      { dia: 'Jueves', cortes: 4 }, { dia: 'Viernes', cortes: 5 }, { dia: 'Sábado', cortes: 1 },
      { dia: 'Domingo', cortes: 0 },
    ])
  })

  it('debeDistinguirUnDiaAusenteDeUnCeroDevueltoPorLaAPI', () => {
    expect(ordenarDias({ Lunes: 0 })[1]?.cortes).toBeNull()
  })

  it('debeSumarLosCortesDeLosSieteDias', () => {
    expect(disponibilidadEstadisticas(estadisticasDeEjemplo).totalCortes).toBe(22)
  })

  it('debeTratarElCeroYLaAusenciaDeDuracionComoSinMedicion', () => {
    for (const duracionPromedioHoras of [0, null, undefined]) {
      expect(disponibilidadEstadisticas({ ...estadisticasDeEjemplo, duracionPromedioHoras }).duracionMedible).toBeNull()
    }
    expect(disponibilidadEstadisticas(estadisticasDeEjemplo).duracionMedible).toBe(5.4)
  })

  it('debeDeclararVacioGeneralSoloSinBarriosNiCortes', () => {
    const base = { sectoresMasAfectados: [], cortesPorDiaDeSemana: { Lunes: 0 }, duracionPromedioHoras: 0 }
    expect(disponibilidadEstadisticas(base).vacioGeneral).toBe(true)
    expect(disponibilidadEstadisticas({ ...base, sectoresMasAfectados: estadisticasDeEjemplo.sectoresMasAfectados }).vacioGeneral).toBe(false)
    expect(disponibilidadEstadisticas({ ...base, cortesPorDiaDeSemana: { Lunes: 1 } }).vacioGeneral).toBe(false)
  })
})

describe('respuesta de las estadísticas', () => {
  it('debeTitularConLaDuracionRedondeadaOConLaPreguntaSinMedicion', () => {
    expect(titularEstadisticas(25.5)).toBe('Un corte dura 25 horas y media en promedio')
    expect(titularEstadisticas(24.2)).toBe('Un corte dura 24 horas y 15 minutos en promedio')
    expect(titularEstadisticas(1)).toBe('Un corte dura 1 hora en promedio')
    expect(titularEstadisticas(0.5)).toBe('Un corte dura 30 minutos en promedio')
    expect(titularEstadisticas(null)).toBe('Cuándo hay cortes en Cartagena')
  })

  it('debeNombrarLosDiasExtremosConEmpates', () => {
    const dias = ordenarDias({ Lunes: 18, Martes: 20, Miércoles: 12, Jueves: 16, Viernes: 16, Sábado: 20, Domingo: 18 })
    expect(diasExtremos(dias, 'mas')).toEqual({ dias: ['Martes', 'Sábado'], cortes: 20 })
    expect(diasExtremos(dias, 'menos')).toEqual({ dias: ['Miércoles'], cortes: 12 })
    expect(listaDeDias(['Martes', 'Sábado'])).toBe('Martes y sábado')
  })

  it('noDebeNombrarExtremosSiTodosLosDiasEmpatan', () => {
    expect(diasExtremos(ordenarDias({ Lunes: 0, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Domingo: 0 }), 'mas')).toBeNull()
  })

  it('debeDetectarCuandoTodosLosBarriosEmpatan', () => {
    expect(empateDeBarrios([6, 6, 6, 6, 6])).toBe(6)
    expect(empateDeBarrios([7, 6, 6])).toBeNull()
    expect(empateDeBarrios([6])).toBeNull()
    expect(empateDeBarrios([6, null])).toBeNull()
  })
})

describe('meses de la serie', () => {
  const punto = (periodo: string, cantidadCortes: number, duracionRealSegundos: number) => ({ periodo, cantidadCortes, duracionRealSegundos })

  it('debeCalcularLaDuracionPorCierreYOrdenarLosMeses', () => {
    expect(mesesConCierres([punto('2026-06', 2, 7200), punto('2026-05', 4, 36_000)])).toEqual([
      { periodo: '2026-05', cierres: 4, segundosPorCierre: 9000 },
      { periodo: '2026-06', cierres: 2, segundosPorCierre: 3600 },
    ])
  })

  it('debeRellenarSinDatoLosMesesDelMedioParaNoDibujarlosComoSeguidos', () => {
    const meses = mesesConCierres([punto('2025-11', 1, 3600), punto('2026-01', 1, 3600)])
    expect(meses.map((mes) => mes.periodo)).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(meses[1]).toEqual({ periodo: '2025-12', cierres: null, segundosPorCierre: null })
  })

  it('debeQuedarseConLosSeisMesesMasRecientes', () => {
    const serie = ['01', '02', '03', '04', '05', '06', '07', '08'].map((mes) => punto(`2026-${mes}`, 1, 3600))
    expect(mesesConCierres(serie).map((mes) => mes.periodo)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'])
  })

  it('noDebeColgarseNiFallarConPeriodosInvalidosOSinPuntos', () => {
    expect(mesesConCierres([])).toEqual([])
    expect(mesesConCierres([{ periodo: 'sin-fecha', cantidadCortes: 1 }, {}])).toEqual([])
  })

  it('noDebeResaltarUnMesConMenosDeCincoCierres', () => {
    const meses = mesesConCierres([punto('2026-05', 91, 9_255_952), punto('2026-06', 3, 900_000)])
    expect(mesDestacado(meses, (mes) => mes.segundosPorCierre)?.periodo).toBe('2026-05')
    expect(mesDestacado(meses.slice(1), (mes) => mes.segundosPorCierre)).toBeNull()
  })

  it('debeAbreviarElMesYRedondearLasHoras', () => {
    expect(mesCorto('2026-05')).toBe('May')
    expect(mesCorto('2026-09')).toBe('Sep')
    expect(horasCortas(101_714)).toBe('28 h')
    expect(horasCortas(1500)).toBe('25 min')
    expect(horasEnPalabras(101_714)).toBe('28 horas')
    expect(horasEnPalabras(3600)).toBe('1 hora')
    expect(horasEnPalabras(1500)).toBe('25 minutos')
  })

  it('debeResumirLaSerieSinInventarUnPromedioSinCierres', () => {
    expect(resumenDeSerie([punto('2026-05', 1, 3600), punto('2026-06', 3, 3600)])).toEqual({ cierres: 4, segundosPorCierre: 1800 })
    expect(resumenDeSerie([])).toEqual({ cierres: 0, segundosPorCierre: null })
  })
})

describe('novedades y barrios', () => {
  it('debeOrdenarLasNovedadesYDejarAlFinalLoQueNoTieneDato', () => {
    const novedades = novedadesPorTipo({ CORTE_ANUNCIADO: 15, CORTE_RESTABLECIDO: null, CORTE_CONFIRMADO_POR_CIUDADANOS: 33, CORTE_DETECTADO_POR_INGESTA: 0 })
    expect(novedades.map((novedad) => [novedad.nombre, novedad.eventos])).toEqual([
      ['Confirmados por vecinos', 33], ['Anunciados', 15], ['En boletines', 0], ['Restablecidos', null],
    ])
  })

  it('debeOrdenarLosBarriosEmpatadosAlfabeticamenteParaQueLaListaNoSalte', () => {
    const barrios = [{ nombre: 'Villa Rosita', cortes: 20 }, { nombre: 'La Victoria', cortes: 23 }, { nombre: 'Ángeles', cortes: 20 }, { nombre: 'Boston', cortes: 20 }]
    expect(ordenarBarrios(barrios).map((barrio) => barrio.nombre)).toEqual(['La Victoria', 'Ángeles', 'Boston', 'Villa Rosita'])
  })

  it('debeNombrarAlPrimerBarrioSoloSiEstaSoloYHayMuestra', () => {
    const barrios = [{ nombre: 'La Victoria', cortes: 23 }, { nombre: 'Boston', cortes: 20 }]
    expect(bajadaBarrios(barrios, true)).toBe('Más en La Victoria: 23 cortes')
    expect(bajadaBarrios(barrios, false)).toBe('Aún sin conclusión')
    expect(bajadaBarrios([{ nombre: 'A', cortes: 8 }, { nombre: 'B', cortes: 8 }, { nombre: 'C', cortes: 5 }], true)).toBe('2 barrios con 8 cortes')
    expect(bajadaBarrios([{ nombre: 'A', cortes: 1 }, { nombre: 'B', cortes: 1 }], false)).toBe('2 barrios empatan con 1 corte cada uno')
  })
})

describe('cómo se mide', () => {
  const datos: DatosDeMedicion = {
    totalCortes: 121,
    suficiente: true,
    duracionHoras: 26.1,
    serie: { cierres: 402, segundosPorCierre: 91_493 },
    eventosFuera: 17,
  }

  it('debeExplicarPorQueLosMesesNoCoincidenConElTitular', () => {
    expect(reglasDeGrafica('duracion', datos)).toContain('Por eso los meses rondan 25 horas y el titular, por corte, 26 horas.')
    expect(reglasDeGrafica('duracion', { ...datos, serie: { cierres: 402, segundosPorCierre: 94_000 } })).toHaveLength(1)
    expect(reglasDeGrafica('duracion', { ...datos, suficiente: false })).toHaveLength(1)
  })

  it('debeAclararLaDiferenciaEntreCierresYCortes', () => {
    expect(reglasDeGrafica('cierres', datos)).toContain('Por eso los 402 cierres no contradicen los 121 cortes de la tarjeta.')
  })

  it('debeDecirCuantosEventosQuedanFueraSoloSiLosHay', () => {
    expect(reglasDeGrafica('novedades', datos)).toContain('Quedan fuera 17 eventos de otros tipos, como cortes vencidos sin confirmar.')
    expect(reglasDeGrafica('novedades', { ...datos, eventosFuera: 0 })).toHaveLength(1)
    expect(reglasDeGrafica('novedades', { ...datos, eventosFuera: null })).toHaveLength(1)
  })

  it('debeDecirQueLosBarriosCuentanAparicionesYAvisarDelEmpateAlFinalDeLaLista', () => {
    expect(reglasDeBarrios([23, 20, 20])).toHaveLength(2)
    expect(reglasDeBarrios([23, 20, 19])).toHaveLength(1)
    expect(reglasDeBarrios([23, 20, 19])[0]).toContain('aviso de corte aprobado')
  })

  it('noDebeRepetirAclaracionesEnElInforme', () => {
    const reglas = reglasDelInforme(datos, [23, 20, 20])
    expect(new Set(reglas).size).toBe(reglas.length)
    expect(reglas.filter((regla) => regla.startsWith('Un cierre es'))).toHaveLength(1)
    expect(reglas).toHaveLength(8)
  })
})
