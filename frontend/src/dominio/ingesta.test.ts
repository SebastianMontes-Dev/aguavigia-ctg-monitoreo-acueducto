import {
  accionesDe, citaDe, confianzaEnPalabras, consecuenciaDeAprobar, estadoPropuestoDe, estadoPropuestoEnPalabras, fallosEnPalabras, fuenteDe,
  ordenarPorSalud, saludDe, saludEnPalabras, tasaDeErrorEnPalabras, ultimaVezEnPalabras, ventanaEnPalabras, type PropuestaIngesta,
} from './ingesta'

const AHORA = new Date('2026-10-30T20:00:00Z')
const propuesta = (cambios: Partial<PropuestaIngesta> = {}): PropuestaIngesta => ({
  id: 'p1', sectorId: 'manga', estadoPropuesto: 'SIN_SERVICIO', fuente: 'acuacar', urlOriginal: 'https://www.acuacar.com/aviso',
  citaTextual: 'Se suspenderá el servicio en Manga.', confianza: 0.85, estadoRevision: 'PENDIENTE', ...cambios,
})

describe('evidencia de una propuesta', () => {
  it('debeDevolverLaCitaTalComoLlego', () => {
    expect(citaDe(propuesta())).toEqual({ tipo: 'con-cita', texto: 'Se suspenderá el servicio en Manga.' })
  })

  it.each([undefined, '', '   \n'])('noDebeInventarUnaCitaCuandoVieneVacia_%j', (valor) => {
    expect(citaDe(propuesta({ citaTextual: valor }))).toEqual({ tipo: 'sin-cita' })
  })

  it('debeAbrirSoloEnlacesWeb', () => {
    expect(fuenteDe(propuesta())).toEqual({ tipo: 'enlace', url: 'https://www.acuacar.com/aviso', sitio: 'acuacar.com' })
    expect(fuenteDe(propuesta({ urlOriginal: null }))).toEqual({ tipo: 'sin-enlace' })
    expect(fuenteDe(propuesta({ urlOriginal: '  ' }))).toEqual({ tipo: 'sin-enlace' })
    expect(fuenteDe(propuesta({ urlOriginal: 'javascript:alert(1)' }))).toEqual({ tipo: 'no-es-web', texto: 'javascript:alert(1)' })
    expect(fuenteDe(propuesta({ urlOriginal: 'no es una url' }))).toEqual({ tipo: 'no-es-web', texto: 'no es una url' })
  })
})

describe('acciones permitidas', () => {
  it('debePermitirAprobarYDescartarUnaPendienteConCita', () => {
    expect(accionesDe(propuesta())).toEqual({ aprobar: true, descartar: true, anular: false })
  })

  it('noDebePermitirAprobarSinLaFraseDelBoletinPeroSiDescartar', () => {
    expect(accionesDe(propuesta({ citaTextual: '' }))).toEqual({ aprobar: false, descartar: true, anular: false })
  })

  it('soloDebePermitirAnularUnaAprobada', () => {
    expect(accionesDe(propuesta({ estadoRevision: 'APROBADA' }))).toEqual({ aprobar: false, descartar: false, anular: true })
    expect(accionesDe(propuesta({ estadoRevision: 'DESCARTADA' }))).toEqual({ aprobar: false, descartar: false, anular: false })
    expect(accionesDe(propuesta({ estadoRevision: 'ANULADA' }))).toEqual({ aprobar: false, descartar: false, anular: false })
  })
})

describe('lo que dice la propuesta', () => {
  it('debeNombrarElEstadoPropuestoYNoInventarUnoDesconocido', () => {
    expect(estadoPropuestoDe(propuesta())).toBe('SIN_SERVICIO')
    expect(estadoPropuestoEnPalabras(propuesta({ estadoPropuesto: 'CORTE_PROGRAMADO' }))).toBe('Corte programado')
    expect(estadoPropuestoDe(propuesta({ estadoPropuesto: 'OTRO' }))).toBeNull()
    expect(estadoPropuestoEnPalabras(propuesta({ estadoPropuesto: 'OTRO' }))).toBe('OTRO')
  })

  it('debeDecirLaVentanaDeclaradaOQueNoLaDeclara', () => {
    expect(ventanaEnPalabras(propuesta(), AHORA)).toBe('No declara una ventana horaria.')
    expect(ventanaEnPalabras(propuesta({ inicioDeclarado: '2026-10-30T13:00:00Z', finPrometido: '2026-10-30T18:00:00Z' }), AHORA))
      .toBe('Declara que empieza a las 8:00 a. m. y termina a las 1:00 p. m.')
  })

  it('debeDecirLaConfianzaComoPorcentajeYCallarSiNoViene', () => {
    expect(confianzaEnPalabras(0.85)).toBe('Confianza 85%')
    expect(confianzaEnPalabras(undefined)).toBeNull()
  })
})

describe('aprobar no implica que el mapa cambie', () => {
  it('debeDecirQueCoincideSoloSiElBarrioYaMuestraElEstadoPropuesto', () => {
    expect(consecuenciaDeAprobar(propuesta(), 'SIN_SERVICIO')).toEqual({ coincide: true, estadoActual: 'SIN_SERVICIO' })
    expect(consecuenciaDeAprobar(propuesta(), 'CON_SERVICIO')).toEqual({ coincide: false, estadoActual: 'CON_SERVICIO' })
    expect(consecuenciaDeAprobar(propuesta(), null)).toEqual({ coincide: false, estadoActual: null })
  })
})

describe('salud de los colectores', () => {
  it('debeConsiderarCaidoUnColectorConTresFallosSeguidos', () => {
    expect(saludDe({ nombre: 'a', fallosConsecutivos: 3 })).toBe('caido')
    expect(saludDe({ nombre: 'a', fallosConsecutivos: 7 })).toBe('caido')
    expect(saludDe({ nombre: 'a', fallosConsecutivos: 2, ultimoFallo: '2026-10-30T19:00:00Z' })).toBe('con-fallos')
    expect(saludDe({ nombre: 'a', fallosConsecutivos: 0, ultimaEjecucionExitosa: '2026-10-30T19:00:00Z' })).toBe('activo')
    expect(saludDe({ nombre: 'a', fallosConsecutivos: 0 })).toBe('sin-ciclos')
    expect(saludEnPalabras('caido')).toBe('Caído')
  })

  it('debePonerPrimeroLoQuePideAtencion', () => {
    const orden = ordenarPorSalud([
      { nombre: 'b', fallosConsecutivos: 0, ultimaEjecucionExitosa: '2026-10-30T19:00:00Z' },
      { nombre: 'c', fallosConsecutivos: 4 },
      { nombre: 'a', fallosConsecutivos: 1 },
    ]).map((colector) => colector.nombre)
    expect(orden).toEqual(['c', 'a', 'b'])
  })

  it('debeDecirTasaYFallosSinInventarDatos', () => {
    expect(tasaDeErrorEnPalabras(0.25)).toBe('25%')
    expect(tasaDeErrorEnPalabras(undefined)).toBe('Sin dato')
    expect(fallosEnPalabras({ fallosConsecutivos: 0 })).toBe('Ninguno')
    expect(fallosEnPalabras({ fallosConsecutivos: 3 })).toBe('3')
    expect(ultimaVezEnPalabras(null, AHORA, 'Nunca')).toBe('Nunca')
    expect(ultimaVezEnPalabras('2026-10-30T19:10:00Z', AHORA, 'Nunca')).toBe('2:10 p. m.')
    expect(ultimaVezEnPalabras('2026-10-29T21:16:00Z', AHORA, 'Nunca')).toBe('ayer 4:16 p. m.')
  })
})
