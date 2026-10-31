import { confirmacionDe, fotoDe, nombreDeFoto, tipoEnPalabras, verificacionEnPalabras } from './moderacion'

describe('moderación', () => {
  it('debeDecirElTipoConLasPalabrasDelVecinoYNoInventarUnoDesconocido', () => {
    expect(tipoEnPalabras('SIN_AGUA')).toBe('No tiene agua')
    expect(tipoEnPalabras('PRESION_BAJA')).toBe('Llega poca agua')
    expect(tipoEnPalabras('SERVICIO_RESTABLECIDO')).toBe('Dice que ya volvió el agua')
    expect(tipoEnPalabras('NUEVO')).toBe('Reporte sin tipo conocido')
  })

  it('debeDecirCuantoRespaldaElServidorQueQuienReportoEstaEnElBarrio', () => {
    expect(verificacionEnPalabras('CUENTA_VERIFICADA')).toMatch(/Cuenta verificada/)
    expect(verificacionEnPalabras('UBICACION_VERIFICADA')).toMatch(/Ubicación verificada/)
    expect(verificacionEnPalabras('NINGUNA')).toMatch(/Sin verificar/)
    expect(verificacionEnPalabras(undefined)).toBe('Sin dato de verificación')
  })

  it('debeSacarElNombreDeLaFotoDeLaRutaDelPanel', () => {
    expect(nombreDeFoto('/api/veedor/fotos/abc-123.jpg')).toBe('abc-123.jpg')
    expect(nombreDeFoto('/api/veedor/fotos/abc.png?x=1')).toBe('abc.png')
    expect(nombreDeFoto(undefined)).toBeNull()
    expect(nombreDeFoto('')).toBeNull()
  })

  it('noDebeAceptarUnNombreConRutaOCaracteresRaros', () => {
    expect(nombreDeFoto('/api/veedor/fotos/%2E%2E%2Fsecreto')).toBeNull()
    expect(nombreDeFoto('/api/veedor/fotos/a%20b.jpg')).toBeNull()
    expect(nombreDeFoto('/api/veedor/fotos/%E0%A4%A')).toBeNull()
  })

  it('debeDistinguirLosCuatroEstadosDeLaFoto', () => {
    expect(fotoDe({ fotoEstado: 'SIN_FOTO' })).toEqual({ tipo: 'sin-foto' })
    expect(fotoDe({})).toEqual({ tipo: 'sin-foto' })
    expect(fotoDe({ fotoEstado: 'DESCARTADA', fotoUrl: '/api/veedor/fotos/a.jpg' })).toEqual({ tipo: 'descartada' })
    expect(fotoDe({ fotoEstado: 'EN_REVISION', fotoUrl: '/api/veedor/fotos/a.jpg' })).toEqual({ tipo: 'visible', nombre: 'a.jpg', publica: false })
    expect(fotoDe({ fotoEstado: 'PUBLICA', fotoUrl: '/api/veedor/fotos/a.jpg' })).toEqual({ tipo: 'visible', nombre: 'a.jpg', publica: true })
  })

  it('noDebePedirUnaFotoSinRutaNiDeUnEstadoQueNoConoce', () => {
    expect(fotoDe({ fotoEstado: 'EN_REVISION' })).toEqual({ tipo: 'no-disponible' })
    expect(fotoDe({ fotoEstado: 'OTRO', fotoUrl: '/api/veedor/fotos/a.jpg' })).toEqual({ tipo: 'no-disponible' })
  })

  it('debeAvisarQueAprobarHaceCuandoLaFotoPasaAPublica', () => {
    expect(confirmacionDe('aprobar', true).pregunta).toMatch(/foto pasa a ser pública/)
    expect(confirmacionDe('aprobar', false).pregunta).not.toMatch(/foto/)
  })

  it('debeAvisarQueUnReporteDescartadoSigueContandoParaElCupo', () => {
    expect(confirmacionDe('descartar', false).pregunta).toMatch(/cupo del dispositivo/)
    expect(confirmacionDe('foto', true).pregunta).toMatch(/solo la foto/)
  })
})
