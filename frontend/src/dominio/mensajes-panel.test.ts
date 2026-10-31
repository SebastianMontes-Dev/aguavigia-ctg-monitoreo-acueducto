import { mensajeAccion, mensajeIngreso, mensajeSegundoFactor, minutos } from './mensajes-panel'

describe('mensajes del ingreso', () => {
  it('noDebeDecirCualCampoFalloConCorreoOClaveIncorrectos', () => {
    expect(mensajeIngreso({ tipo: 'credencial-invalida' }, false)).toBe('Correo o clave incorrectos.')
  })

  it('debeCulparAlCodigoCuandoLaClaveYaSeAcepto', () => {
    expect(mensajeIngreso({ tipo: 'credencial-invalida' }, true)).toMatch(/^El código no coincide/)
  })

  it('debeExplicarCadaEstadoDeCuentaYCaerAlDetalleSiEsDesconocido', () => {
    expect(mensajeIngreso({ tipo: 'no-habilitada', estado: 'PENDIENTE_APROBACION', mensaje: 'x' }, false)).toMatch(/administrador apruebe/)
    expect(mensajeIngreso({ tipo: 'no-habilitada', estado: 'SUSPENDIDA', mensaje: 'x' }, false)).toMatch(/suspendida/)
    expect(mensajeIngreso({ tipo: 'no-habilitada', estado: 'OTRO', mensaje: 'Detalle del servidor' }, false)).toBe('Detalle del servidor')
  })

  it('debeDecirLaEsperaRealEnMinutosRedondeadosHaciaArriba', () => {
    expect(mensajeIngreso({ tipo: 'bloqueada', segundos: 840 }, false)).toContain('14 minutos')
    expect(mensajeIngreso({ tipo: 'esperar', segundos: 30 }, false)).toContain('1 minuto')
    expect(mensajeIngreso({ tipo: 'esperar', segundos: null }, false)).toContain('unos minutos')
    expect(minutos(61)).toBe('2 minutos')
  })

  it('debeRemitirASeguridadSiLaCuentaYaTieneSegundoFactor', () => {
    expect(mensajeSegundoFactor({ tipo: 'ya-activo' })).toMatch(/Seguridad/)
  })
})

describe('mensajes de moderación y cortes', () => {
  it('debeExplicarCadaConflictoConLoQueYaEstabaHecho', () => {
    expect(mensajeAccion({ tipo: 'conflicto' }, 'cierre')).toMatch(/ya estaba cerrado/)
    expect(mensajeAccion({ tipo: 'conflicto' }, 'cierre-barrio')).toMatch(/barrio ya estaba cerrado/)
    expect(mensajeAccion({ tipo: 'conflicto' }, 'confirmacion')).toMatch(/ya estaba confirmado/)
    expect(mensajeAccion({ tipo: 'conflicto' }, 'anulacion')).toMatch(/ya estaba anulado/)
    expect(mensajeAccion({ tipo: 'conflicto' }, 'foto')).toMatch(/no tiene una foto/)
  })

  it('noDebeDecirNadaDeLoQueSeVeOLlevaAlIngreso', () => {
    expect(mensajeAccion({ tipo: 'hecho', dato: {} }, 'aprobar')).toBeNull()
    expect(mensajeAccion({ tipo: 'sesion-terminada' }, 'aprobar')).toBeNull()
  })

  it('debeDistinguirUnReporteQueYaNoEstaDeUnCorteQueYaNoExiste', () => {
    expect(mensajeAccion({ tipo: 'no-existe' }, 'descartar')).toMatch(/reporte ya no está/)
    expect(mensajeAccion({ tipo: 'no-existe' }, 'anulacion')).toMatch(/corte ya no existe/)
  })

  it('debeExplicarQueFaltaElPermisoSinDecirQueLaSesionTermino', () => {
    expect(mensajeAccion({ tipo: 'sin-permiso' }, 'alta')).toMatch(/ya no tiene permiso/)
  })

  it('debeUsarMensajesPropiosParaUnRechazoYNoElTextoDelServidor', () => {
    expect(mensajeAccion({ tipo: 'rechazado', mensaje: 'detalle crudo' }, 'alta')).toMatch(/fin prometido sea posterior/)
    expect(mensajeAccion({ tipo: 'rechazado', mensaje: 'detalle crudo' }, 'anulacion')).toBe('Falta el motivo de la anulación.')
  })

  it('debeDecirLaEsperaYLosFallosDeRed', () => {
    expect(mensajeAccion({ tipo: 'esperar', segundos: 120 }, 'cierre')).toContain('2 minutos')
    expect(mensajeAccion({ tipo: 'sin-red' }, 'cierre')).toMatch(/No pudimos conectar/)
    expect(mensajeAccion({ tipo: 'fallo' }, 'cierre')).toMatch(/Algo falló/)
  })
})
