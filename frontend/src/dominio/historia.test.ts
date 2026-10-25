import { describe, expect, it } from 'vitest'
import { descripcionAporta, descripcionLegible, procedenciaEnPalabras, quePasoEnPalabras, enlaceExterno, esTipoBitacora, esTipoEvento, FILTRO_TIPO, imagenDeBitacora, limiteDiaCartagena, NOMBRE_TIPO, rangoDiasValido, TIPOS_BITACORA, TIPOS_EVENTO } from './historia'
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

describe('eventos en palabras del vecino', () => {
  it('debeDecirLoQuePasoSegunElTipoYElEstadoYNoSegunLaDescripcion', () => {
    expect(quePasoEnPalabras('CORTE_CONFIRMADO_POR_CIUDADANOS', 'SIN_SERVICIO')).toBe('Se quedó sin agua')
    expect(quePasoEnPalabras('CORTE_CONFIRMADO_POR_CIUDADANOS', 'PRESION_BAJA')).toBe('Llega poca agua')
    expect(quePasoEnPalabras('RESTABLECIMIENTO_POR_VECINOS', 'CON_SERVICIO')).toBe('Volvió el agua')
    expect(quePasoEnPalabras('CORTE_RESTABLECIDO', null)).toBe('Volvió el agua')
    expect(quePasoEnPalabras('CORTE_ANULADO', null)).toBe('Se retiró un corte publicado por error')
    expect(quePasoEnPalabras(null, null)).toBe('Evento registrado')
    for (const tipo of TIPOS_EVENTO) expect(quePasoEnPalabras(tipo, null)).not.toBe('Evento registrado')
  })

  it('debeContarElQuorumComoVecinosQueLoConfirmaronYCuantosHacianFalta', () => {
    expect(procedenciaEnPalabras('RESTABLECIMIENTO_POR_VECINOS', { vecinos: 8, umbral: 3 }, 'Reportes de vecinos')).toBe('Lo confirmaron 8 vecinos (hacían falta 3)')
    expect(procedenciaEnPalabras('CORTE_CONFIRMADO_POR_CIUDADANOS', { vecinos: 1, umbral: 3 }, null)).toBe('Lo confirmó 1 vecino (hacían falta 3)')
    expect(procedenciaEnPalabras('ESTADO_EN_DISPUTA', { vecinos: 11, umbral: 12 }, null)).toBe('11 de 12 vecinos')
    expect(procedenciaEnPalabras('CORTE_DETECTADO_POR_INGESTA', null, 'Aviso oficial de Acuacar')).toBe('Aviso oficial de Acuacar')
    expect(procedenciaEnPalabras('CORTE_ANUNCIADO', null, null)).toBeNull()
  })

  it('debeOcultarSoloLasDescripcionesQueRepitenElTipoYElRespaldo', () => {
    expect(descripcionAporta('CORTE_CONFIRMADO_POR_CIUDADANOS')).toBe(false)
    expect(descripcionAporta('RESTABLECIMIENTO_POR_VECINOS')).toBe(false)
    expect(descripcionAporta('CORTE_DETECTADO_POR_INGESTA')).toBe(true)
    expect(descripcionAporta(null)).toBe(true)
  })

  it('debeDecodificarLasEntidadesNumericasQueTraenLosBoletines', () => {
    expect(descripcionLegible('#2878 &#8211; AGUAS DE CARTAGENA', () => undefined)).toBe('#2878 – AGUAS DE CARTAGENA')
  })
})
