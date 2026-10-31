import {
  accionesDeCuenta, ajusteDePermisos, confirmacionCuenta, estadoCuentaEnPalabras, FRASE_SINTETICAS, hayCambioDeAcceso, marcadosDelRol, marcadosIniciales,
  motivoSinAcciones, nombreDeCuenta, permisosDeCuenta, permisosEnPalabras, PERMISOS_DEL_ROL, resumenDelAjuste, separarSinteticas, type CuentaPanel,
} from './cuentas'
import type { Permiso } from './permisos'

const cuenta = (campos: Partial<CuentaPanel> = {}): CuentaPanel => ({
  id: 'u2', correo: 'luis@example.com', nombre: 'Luis Mora', estado: 'ACTIVA', rol: 'VEEDOR',
  permisosEfectivos: [...PERMISOS_DEL_ROL.VEEDOR], ...campos,
})

describe('qué se ofrece sobre una cuenta', () => {
  it('debeOfrecerCadaAccionSegunElEstadoDeLaCuenta', () => {
    expect(accionesDeCuenta(cuenta({ estado: 'INVITADA', rol: 'OBSERVADOR' }), 'u1').acciones).toEqual(['reenviar'])
    expect(accionesDeCuenta(cuenta({ estado: 'PENDIENTE_APROBACION' }), 'u1').acciones).toEqual(['aprobar', 'rechazar'])
    expect(accionesDeCuenta(cuenta({ estado: 'ACTIVA' }), 'u1').acciones).toEqual(['permisos', 'suspender'])
    expect(accionesDeCuenta(cuenta({ estado: 'SUSPENDIDA' }), 'u1').acciones).toEqual(['reactivar'])
  })

  it('debeNoOfrecerNadaSobreLaPropiaCuentaNiSobreLasQueNoTienenAcciones', () => {
    expect(accionesDeCuenta(cuenta({ id: 'u1', rol: 'ADMIN' }), 'u1')).toEqual({ propia: true, acciones: [] })
    expect(accionesDeCuenta(cuenta({ estado: 'RECHAZADA' }), 'u1').acciones).toEqual([])
    expect(accionesDeCuenta(cuenta({ estado: 'PENDIENTE_VERIFICACION' }), 'u1').acciones).toEqual([])
    expect(motivoSinAcciones(cuenta({ id: 'u1' }), true)).toContain('no puedes cambiar tu propio acceso')
  })

  it('debeDejarAUnVecinoSoloSuspenderYReactivarSinConvertirlo', () => {
    expect(accionesDeCuenta(cuenta({ rol: 'VECINO', estado: 'ACTIVA' }), 'u1').acciones).toEqual(['suspender'])
    expect(accionesDeCuenta(cuenta({ rol: 'VECINO', estado: 'PENDIENTE_APROBACION' }), 'u1').acciones).toEqual([])
  })

  it('debeNoOfrecerNadaSiNoSeSabeQuienMira', () => {
    expect(accionesDeCuenta(cuenta(), undefined).acciones).toEqual(['permisos', 'suspender'])
  })
})

describe('ajuste de permisos', () => {
  it('debeCalcularConcedidosYRevocadosRespectoAlRolSinRepetirUnPermisoEnLasDosListas', () => {
    const marcados = new Set<Permiso>(['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR', 'MODERAR_REPORTES', 'VER_AUDITORIA'])
    const ajuste = ajusteDePermisos('VEEDOR', marcados)
    expect(ajuste).toEqual({ rol: 'VEEDOR', concedidos: ['VER_AUDITORIA'], revocados: ['GESTIONAR_CORTES', 'REVISAR_INGESTA'] })
    expect(ajuste.concedidos.filter((permiso) => ajuste.revocados.includes(permiso))).toEqual([])
  })

  it('debeNoRevocarNuncaElSegundoFactorAunqueLaCasillaLleguedesmarcada', () => {
    const sinNada = ajusteDePermisos('OBSERVADOR', new Set())
    expect(sinNada.revocados).toEqual(['VER_PANEL'])
    expect(sinNada.revocados).not.toContain('CONFIGURAR_SEGUNDO_FACTOR')
  })

  it('debeDejarVaciosLosAjustesCuandoLasCasillasSonLasDelRol', () => {
    for (const rol of ['OBSERVADOR', 'VEEDOR', 'ADMIN'] as const) {
      expect(ajusteDePermisos(rol, marcadosDelRol(rol))).toEqual({ rol, concedidos: [], revocados: [] })
    }
  })

  it('debePartirDeLosPermisosEfectivosDeLaCuentaYIgnorarLosQueNoConoce', () => {
    const inicial = marcadosIniciales(cuenta({ permisosEfectivos: ['VER_PANEL', 'PERMISO_NUEVO', 'VER_AUDITORIA'] }), 'OBSERVADOR')
    expect(inicial.rol).toBe('VEEDOR')
    expect([...inicial.marcados]).toEqual(['VER_PANEL', 'VER_AUDITORIA'])
    expect(marcadosIniciales(cuenta({ rol: 'VECINO', permisosEfectivos: [] }), 'OBSERVADOR').rol).toBe('OBSERVADOR')
  })

  it('debeDetectarSiHuboCambioDeAcceso', () => {
    const veedor = cuenta()
    expect(hayCambioDeAcceso(veedor, 'VEEDOR', new Set(permisosDeCuenta(veedor)))).toBe(false)
    expect(hayCambioDeAcceso(veedor, 'ADMIN', new Set(permisosDeCuenta(veedor)))).toBe(true)
    expect(hayCambioDeAcceso(veedor, 'VEEDOR', new Set<Permiso>([...permisosDeCuenta(veedor), 'VER_AUDITORIA']))).toBe(true)
  })

  it('debeResumirEnPalabrasLoQueSeVaAMandar', () => {
    const ajuste = ajusteDePermisos('VEEDOR', new Set<Permiso>([...PERMISOS_DEL_ROL.VEEDOR, 'VER_AUDITORIA' as const].filter((permiso) => permiso !== 'REVISAR_INGESTA')))
    expect(resumenDelAjuste(cuenta({ rol: 'OBSERVADOR' }), ajuste)).toEqual([
      'Rol: Veedor (era Observador).',
      'Se le suman: Ver la auditoría.',
      'Se le quitan: Revisar la ingesta.',
    ])
  })
})

describe('confirmaciones', () => {
  it('debeNombrarLaCuentaAfectadaEnCadaAccion', () => {
    for (const accion of ['reenviar', 'aprobar', 'rechazar', 'suspender', 'reactivar', 'permisos'] as const) {
      const textos = confirmacionCuenta(accion, cuenta())
      expect(textos.pregunta).toContain('Luis Mora')
      expect(textos.pregunta).toContain('luis@example.com')
      expect(textos.boton).toContain('Luis Mora')
    }
  })

  it('debeAvisarQueSuspenderYCambiarElAccesoCierranLasSesiones', () => {
    expect(confirmacionCuenta('suspender', cuenta()).cierraSesiones).toBe(true)
    expect(confirmacionCuenta('permisos', cuenta()).cierraSesiones).toBe(true)
    expect(confirmacionCuenta('reactivar', cuenta()).cierraSesiones).toBe(false)
    expect(confirmacionCuenta('aprobar', cuenta()).cierraSesiones).toBe(false)
  })

  it('debeUsarElCorreoCuandoLaCuentaNoTieneNombre', () => {
    expect(nombreDeCuenta({ correo: 'a@b.co' })).toBe('a@b.co')
    expect(nombreDeCuenta({})).toBe('Cuenta sin nombre')
  })
})

describe('cuentas sintéticas', () => {
  const lista = [cuenta({ id: 'a' }), cuenta({ id: 'b', sintetica: true }), cuenta({ id: 'c', sintetica: true })]

  it('debeOcultarLasSinteticasPorDefectoYContarCuantasSeOcultaron', () => {
    const { visibles, ocultas } = separarSinteticas(lista, false)
    expect(visibles.map((fila) => fila.id)).toEqual(['a'])
    expect(ocultas).toBe(2)
  })

  it('debeMostrarTodasSiSePide', () => {
    expect(separarSinteticas(lista, true)).toMatchObject({ ocultas: 0, visibles: expect.arrayContaining([expect.objectContaining({ id: 'b' })]) as unknown })
  })

  it('debeUsarLaFraseFijaDeLaApi', () => {
    expect(FRASE_SINTETICAS).toBe('cuentas sintéticas generadas por el sistema con las reglas de alta de un vecino')
  })
})

describe('palabras', () => {
  it('debeDecirElEstadoYLosPermisosEnPalabras', () => {
    expect(estadoCuentaEnPalabras('PENDIENTE_APROBACION')).toBe('Espera aprobación')
    expect(estadoCuentaEnPalabras('INVITADA')).toBe('Invitación sin aceptar')
    expect(estadoCuentaEnPalabras('OTRO')).toBe('Estado desconocido')
    expect(permisosEnPalabras(cuenta({ permisosEfectivos: [] }))).toBe('Sin permisos de panel')
    expect(permisosEnPalabras(cuenta({ permisosEfectivos: ['VER_PANEL'] }))).toBe('1 permiso')
    expect(permisosEnPalabras(cuenta())).toBe('5 permisos')
  })
})
