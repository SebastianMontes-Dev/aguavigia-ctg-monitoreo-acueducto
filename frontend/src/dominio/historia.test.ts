import { describe, expect, it } from 'vitest'
import { descripcionLegible, enlaceExterno, esTipoBitacora, esTipoEvento, FILTRO_TIPO, imagenDeBitacora, limiteDiaCartagena, NOMBRE_TIPO, rangoDiasValido, TIPOS_BITACORA, TIPOS_EVENTO } from './historia'
import { claveDiaCartagena, etiquetaDia } from './tiempo'

describe('enlaceExterno', () => {
  it('debeAceptarSoloEnlacesHttpYHttps', () => {
    expect(enlaceExterno('https://www.acuacar.com/boletin/1')).toBe('https://www.acuacar.com/boletin/1')
    expect(enlaceExterno('http://ejemplo.test/a')).toBe('http://ejemplo.test/a')
  })

  it('noDebeDejarAbrirOtrosEsquemasNiTextoQueNoSeaUnaUrl', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'acuacar.com/boletin', '', null, undefined]) {
      expect(enlaceExterno(url)).toBeNull()
    }
  })
})

describe('tipos de la bitácora', () => {
  const NUEVE = [
    'CORTE_ANUNCIADO', 'CORTE_RESTABLECIDO', 'CORTE_CONFIRMADO_POR_CIUDADANOS', 'CORTE_DETECTADO_POR_INGESTA',
    'CORTE_EXPIRADO', 'CORTE_ANULADO', 'RESTABLECIMIENTO_POR_VECINOS', 'ESTADO_EN_DISPUTA', 'CONSENSO_REVERTIDO',
  ]

  it('debeReconocerLosNueveTiposDelContratoConSuTexto', () => {
    expect([...TIPOS_EVENTO]).toEqual(NUEVE)
    for (const tipo of NUEVE) {
      expect(esTipoEvento(tipo)).toBe(true)
      expect(NOMBRE_TIPO[tipo as keyof typeof NOMBRE_TIPO]).toEqual(expect.any(String))
    }
  })

  it('soloDebeDejarFiltrarPorLosCuatroTiposQueLaApiAcepta', () => {
    expect([...TIPOS_BITACORA]).toEqual(NUEVE.slice(0, 4))
    expect(esTipoBitacora('CORTE_ANUNCIADO')).toBe(true)
    expect(esTipoBitacora('CORTE_EXPIRADO')).toBe(false)
    for (const tipo of TIPOS_BITACORA) expect(FILTRO_TIPO[tipo]).toEqual(expect.any(String))
  })

  it('noDebeReconocerUnTipoQueElContratoNoTiene', () => {
    expect(esTipoEvento('TIPO_FUTURO')).toBe(false)
    expect(esTipoEvento(undefined)).toBe(false)
  })
})

describe('días de la bitácora', () => {
  const ahora = new Date('2026-09-25T20:00:00Z')

  it('debeAgruparPorElDiaDeCartagenaYNoPorElDeUtc', () => {
    expect(claveDiaCartagena('2026-09-26T03:00:00Z')).toBe('2026-09-25')
  })

  it('debeNombrarHoyAyerYLosDemasDiasConSuDiaDeLaSemana', () => {
    expect(etiquetaDia('2026-09-25T12:00:00Z', ahora)).toBe('Hoy')
    expect(etiquetaDia('2026-09-24T14:00:00Z', ahora)).toBe('Ayer')
    expect(etiquetaDia('2026-09-21T14:00:00Z', ahora)).toMatch(/^Lunes,? 21 de septiembre$/)
  })
})

describe('historia pública', () => {
  it('convierte días de Cartagena a límites UTC inclusivo y exclusivo', () => {
    expect(limiteDiaCartagena('2026-09-01')).toBe('2026-09-01T05:00:00Z')
    expect(limiteDiaCartagena('2026-09-01', true)).toBe('2026-09-02T05:00:00Z')
    expect(limiteDiaCartagena('2026-12-31', true)).toBe('2027-01-01T05:00:00Z')
  })

  it('rechaza fechas imposibles e intervalos invertidos', () => {
    expect(limiteDiaCartagena('2026-02-30')).toBeNull()
    expect(rangoDiasValido('2026-09-02', '2026-09-01')).toBe(false)
    expect(rangoDiasValido('2026-09-01', '2026-09-01')).toBe(true)
  })

  it('pasa las portadas de Acuacar por el proxy local', () => {
    expect(imagenDeBitacora('https://www.acuacar.com/wp-content/uploads/2026/foto.jpg')).toBe('/acuacar-media/2026/foto.jpg')
    expect(imagenDeBitacora(null)).toBeNull()
  })
})

describe('descripciones de la bitácora', () => {
  const nombreDe = (id: string) => ({ 'arroyo-grande': 'Arroyo Grande' } as Record<string, string>)[id]

  it('debeEscribirElEstadoYElBarrioEnPalabras', () => {
    expect(descripcionLegible("3 reportes confirmaron SIN_SERVICIO en 'arroyo-grande'", nombreDe))
      .toBe('3 reportes confirmaron sin servicio en Arroyo Grande')
  })

  it('debeConservarUnIdQueNoCorrespondeANingunBarrio', () => {
    expect(descripcionLegible("en 'no-existe'", nombreDe)).toBe("en 'no-existe'")
  })

  it('debeCambiarSoloElNombreEnMayusculasDelBarrioDelEvento', () => {
    expect(descripcionLegible('Servicio normalizado en el sector SAN ANTONIO.', nombreDe, { original: 'SAN ANTONIO', legible: 'San Antonio' }))
      .toBe('Servicio normalizado en el sector San Antonio.')
    expect(descripcionLegible('Corte en EL BOSQUE', nombreDe, { original: 'Manga', legible: 'Manga' })).toBe('Corte en EL BOSQUE')
  })
})
