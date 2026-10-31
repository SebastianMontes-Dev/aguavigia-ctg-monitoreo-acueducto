import { esperaLegible, mensajeIngresoVecino, mensajePerfil, mensajeSolicitud, mensajeVerificacion, NEUTRO } from './mensajes-cuenta'

describe('esperaLegible', () => {
  it('debeDecirMinutosParaUnTopePorIpYHorasParaLosIntentosDelDia', () => {
    expect(esperaLegible(30)).toBe('1 minuto')
    expect(esperaLegible(600)).toBe('10 minutos')
    expect(esperaLegible(3600)).toBe('1 hora')
    expect(esperaLegible(43_200)).toBe('12 horas')
    expect(esperaLegible(43_201)).toBe('13 horas')
  })
})

describe('mensajes neutros', () => {
  it('noDebeDecirSiLaCuentaExiste', () => {
    for (const frase of Object.values(NEUTRO)) expect(frase).toMatch(/^Si /)
  })
})

describe('mensajeSolicitud', () => {
  it('noDebeDecirNadaCuandoSeRecibio', () => {
    expect(mensajeSolicitud({ tipo: 'recibido' })).toBeNull()
  })

  it('debeResumirLosCamposMarcadosOMostrarElDetailSiNoHayCampos', () => {
    expect(mensajeSolicitud({ tipo: 'rechazado', mensaje: 'Datos inválidos', campos: { clave: 'x' } })).toBe('Revisa los campos marcados.')
    expect(mensajeSolicitud({ tipo: 'rechazado', mensaje: 'Datos inválidos', campos: {} })).toBe('Datos inválidos')
  })

  it('debeDecirQueNoSeSabeSiLlegoCuandoNoHayRespuesta', () => {
    expect(mensajeSolicitud({ tipo: 'sin-red' })).toMatch(/No pudimos comprobar si se recibió/)
  })

  it('debeUsarElRetryAfterSiLoHay', () => {
    expect(mensajeSolicitud({ tipo: 'esperar', segundos: 600 })).toContain('10 minutos')
    expect(mensajeSolicitud({ tipo: 'esperar', segundos: null })).toMatch(/Espera unos minutos/)
  })
})

describe('mensajeIngresoVecino', () => {
  it('noDebeDistinguirLaClaveMalaDeUnaCuentaSinClaveNiDeUnaDelPanel', () => {
    expect(mensajeIngresoVecino({ tipo: 'credencial-invalida' })).toMatch(/Correo o clave incorrectos/)
  })

  it('debeExplicarLaCuentaSuspendidaYElBloqueo', () => {
    expect(mensajeIngresoVecino({ tipo: 'no-habilitada', estado: 'SUSPENDIDA', mensaje: '' })).toMatch(/suspendida/)
    expect(mensajeIngresoVecino({ tipo: 'bloqueada', segundos: 900 })).toContain('15 minutos')
  })
})

describe('mensajePerfil', () => {
  it('debeDecirQueSeActualizoLaCuentaAnteUnConflicto', () => {
    expect(mensajePerfil({ tipo: 'conflicto' })).toMatch(/Actualizamos tus datos/)
    expect(mensajePerfil({ tipo: 'sesion-terminada' })).toBeNull()
  })
})

describe('mensajeVerificacion', () => {
  it('debeNombrarElBarrioCuandoLaUbicacionEstaFuera', () => {
    expect(mensajeVerificacion({ tipo: 'fuera-del-barrio' }, 'Manga')).toContain('dentro de Manga')
  })

  it('debeDecirQueUnaLecturaImprecisaNoGastaIntento', () => {
    expect(mensajeVerificacion({ tipo: 'imprecisa' }, 'Manga')).toMatch(/no cuenta como intento/)
  })

  it('debeDecirCuandoVolverAIntentarlo', () => {
    expect(mensajeVerificacion({ tipo: 'agotado', segundos: 7200 }, 'Manga')).toContain('2 horas')
    expect(mensajeVerificacion({ tipo: 'agotado', segundos: null }, 'Manga')).toMatch(/Inténtalo mañana/)
  })

  it('debeDecirCadaFalloDeLaUbicacionConPalabras', () => {
    expect(mensajeVerificacion({ tipo: 'denegada' }, 'Manga')).toMatch(/permiso/)
    expect(mensajeVerificacion({ tipo: 'agotada' }, 'Manga')).toMatch(/tardó/)
    expect(mensajeVerificacion({ tipo: 'no-disponible' }, 'Manga')).toMatch(/No pudimos saber dónde estás/)
  })
})
