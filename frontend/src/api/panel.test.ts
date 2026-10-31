import { cambiarClave, cerrarSesion, confirmarSegundoFactor, desactivarSegundoFactor, iniciarAltaSegundoFactor, iniciarSesion, interpretarAlta, interpretarConfirmacionFactor, interpretarIngreso } from './panel'
import { crearCliente } from './cliente'
import { sesion } from './sesion'

const TIPO = 'https://aguavigia.example/errores/'

function respuesta(estado: number, cabeceras: Record<string, string> = {}) {
  return new Response(null, { status: estado, headers: cabeceras })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function lecturaDe(pedir: ReturnType<typeof vi.fn<typeof fetch>>, n: number): Promise<Request> {
  const enviada = pedir.mock.calls[n]?.[0]
  if (!(enviada instanceof Request)) throw new Error(`la petición ${n} no se envió`)
  return enviada.clone()
}

function json(estado: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': estado >= 400 ? 'application/problem+json' : 'application/json' },
  })
}

describe('interpretarIngreso', () => {
  it('debePedirElCodigoAnteSegundoFactorRequeridoSinTratarloComoClaveMala', () => {
    expect(interpretarIngreso(respuesta(401), { type: `${TIPO}segundo-factor-requerido` })).toEqual({ tipo: 'pide-codigo' })
    expect(interpretarIngreso(respuesta(401), { type: `${TIPO}credencial-invalida` })).toEqual({ tipo: 'credencial-invalida' })
  })

  it('debeLeerElEstadoDeLaCuentaNoHabilitada', () => {
    expect(interpretarIngreso(respuesta(403), { type: `${TIPO}cuenta-no-habilitada`, detail: 'No habilitada', estado: 'PENDIENTE_APROBACION' }))
      .toEqual({ tipo: 'no-habilitada', estado: 'PENDIENTE_APROBACION', mensaje: 'No habilitada' })
  })

  it('debeLeerLosSegundosDelBloqueoYElRetryAfterDelLimite', () => {
    expect(interpretarIngreso(respuesta(423), { type: `${TIPO}cuenta-bloqueada`, segundosRestantes: 840 }))
      .toEqual({ tipo: 'bloqueada', segundos: 840 })
    expect(interpretarIngreso(respuesta(429, { 'Retry-After': '120' }), { type: `${TIPO}limite-de-peticiones-excedido` }))
      .toEqual({ tipo: 'esperar', segundos: 120 })
  })

  it('debeTratarLaFaltaDeRespuestaComoSinRed', () => {
    expect(interpretarIngreso(null, null)).toEqual({ tipo: 'sin-red' })
  })
})

describe('iniciarSesion', () => {

  it('debeGuardarElTokenYElAlcanceRestringidoDeUnAdminSinTotp', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { token: 't-restringido', alcance: 'ALTA_SEGUNDO_FACTOR', permisos: ['CONFIGURAR_SEGUNDO_FACTOR'] }))
    expect(await iniciarSesion('ana@example.com', 'una clave larga', undefined, clienteCon(pedir))).toEqual({ tipo: 'ingresado', alcance: 'ALTA_SEGUNDO_FACTOR' })
    expect(sesion.token()).toBe('t-restringido')
    expect(sesion.alcance()).toBe('ALTA_SEGUNDO_FACTOR')
  })

  it('debeOmitirElCodigoEnElPrimerIntentoYEnviarloEnElSegundo', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(401, { type: `${TIPO}segundo-factor-requerido` }))
      .mockResolvedValueOnce(json(200, { token: 't', alcance: 'COMPLETO' }))
    expect(await iniciarSesion('ana@example.com', 'clave', undefined, clienteCon(pedir))).toEqual({ tipo: 'pide-codigo' })
    expect(await iniciarSesion('ana@example.com', 'clave', '123456', clienteCon(pedir))).toEqual({ tipo: 'ingresado', alcance: 'COMPLETO' })
    const cuerpos = await Promise.all(pedir.mock.calls.map(([peticion]) => (peticion as Request).clone().json() as Promise<Record<string, unknown>>))
    expect(cuerpos[0]).not.toHaveProperty('codigoTotp')
    expect(cuerpos[1]).toMatchObject({ codigoTotp: '123456' })
  })

  it('noDebeReintentarSoloAnteUnFalloDeRed', async () => {
    const pedir = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await iniciarSesion('ana@example.com', 'clave', undefined, clienteCon(pedir))).toEqual({ tipo: 'sin-red' })
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(sesion.token()).toBeNull()
  })
})

describe('segundo factor', () => {

  it('debeDistinguirElCodigoIncorrectoDeLaSesionTerminada', () => {
    expect(interpretarAlta(respuesta(401), { type: `${TIPO}credencial-invalida` })).toEqual({ tipo: 'codigo-incorrecto' })
    expect(interpretarAlta(respuesta(401), { type: `${TIPO}sesion-sin-cuenta` })).toEqual({ tipo: 'sesion-terminada' })
    expect(interpretarAlta(respuesta(409), { type: `${TIPO}conflicto-de-estado` })).toEqual({ tipo: 'ya-activo' })
    expect(interpretarConfirmacionFactor(respuesta(409), { type: `${TIPO}conflicto-de-estado` })).toEqual({ tipo: 'sin-alta' })
  })

  it('noDebeDarPorBuenaUnaAltaSinSecreto', () => {
    expect(interpretarAlta(respuesta(200), { uri: 'otpauth://totp/x' })).toEqual({ tipo: 'fallo' })
  })

  it('debeReemplazarLaSesionRestringidaPorLaCompletaAlConfirmar', async () => {
    sesion.guardar('t-restringido', 'ALTA_SEGUNDO_FACTOR')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, { token: 't-completo', alcance: 'COMPLETO' }))
    expect(await confirmarSegundoFactor('123456', clienteCon(pedir))).toEqual({ tipo: 'activado' })
    expect(sesion.token()).toBe('t-completo')
    expect(sesion.alcance()).toBe('COMPLETO')
  })

  it('debeConservarLaSesionAnteUnCodigoIncorrecto', async () => {
    sesion.guardar('t-restringido', 'ALTA_SEGUNDO_FACTOR')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(401, { type: `${TIPO}credencial-invalida`, detail: 'El código no coincide.' }))
    expect(await confirmarSegundoFactor('000000', clienteCon(pedir))).toEqual({ tipo: 'codigo-incorrecto' })
    expect(sesion.token()).toBe('t-restringido')
  })
})

describe('cerrarSesion', () => {

  it('debeOlvidarElTokenAunqueFalleLaRed', async () => {
    sesion.guardar('vigente')
    await cerrarSesion(clienteCon(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))))
    expect(sesion.token()).toBeNull()
    expect(sesion.alcance()).toBeNull()
  })
})

describe('cambiarClave', () => {
  it('debeOlvidarLaSesionAlCambiarLaClaveYMandarAmbasClaves', async () => {
    sesion.guardar('vigente')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    expect(await cambiarClave('la clave de hoy', 'una clave nueva larga', clienteCon(pedir))).toEqual({ tipo: 'hecho' })
    expect(sesion.token()).toBeNull()
    const cuerpo = await (await lecturaDe(pedir, 0)).json()
    expect(cuerpo).toEqual({ claveActual: 'la clave de hoy', claveNueva: 'una clave nueva larga' })
  })

  it('debeConservarLaSesionYMostrarElDetalleDelServidorAnteUn400', async () => {
    sesion.guardar('vigente')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(400, { type: `${TIPO}peticion-invalida`, detail: 'La clave actual no es correcta.' }))
    expect(await cambiarClave('mala', 'una clave nueva larga', clienteCon(pedir))).toEqual({ tipo: 'rechazado', mensaje: 'La clave actual no es correcta.' })
    expect(sesion.token()).toBe('vigente')
  })

  it('debeLeerElBloqueoYElLimiteDeIntentos', async () => {
    sesion.guardar('vigente')
    const bloqueada = vi.fn<typeof fetch>().mockResolvedValue(json(423, { type: `${TIPO}cuenta-bloqueada`, segundosRestantes: 600 }))
    expect(await cambiarClave('a', 'b', clienteCon(bloqueada))).toEqual({ tipo: 'bloqueada', segundos: 600 })
    const limite = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: `${TIPO}limite-de-peticiones-excedido` }), { status: 429, headers: { 'Retry-After': '90', 'Content-Type': 'application/problem+json' } }))
    expect(await cambiarClave('a', 'b', clienteCon(limite))).toEqual({ tipo: 'esperar', segundos: 90 })
    expect(sesion.token()).toBe('vigente')
  })
})

describe('desactivarSegundoFactor', () => {
  it('debeOlvidarLaSesionAlDesactivarlo', async () => {
    sesion.guardar('vigente')
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    expect(await desactivarSegundoFactor('123456', clienteCon(pedir))).toEqual({ tipo: 'hecho' })
    expect(sesion.token()).toBeNull()
  })

  it('debeDistinguirElCodigoIncorrectoDelRolQueLoExige', async () => {
    sesion.guardar('vigente')
    const incorrecto = vi.fn<typeof fetch>().mockResolvedValue(json(401, { type: `${TIPO}credencial-invalida` }))
    expect(await desactivarSegundoFactor('000000', clienteCon(incorrecto))).toEqual({ tipo: 'codigo-incorrecto' })
    const admin = vi.fn<typeof fetch>().mockResolvedValue(json(409, { type: `${TIPO}conflicto-de-estado` }))
    expect(await desactivarSegundoFactor('123456', clienteCon(admin))).toEqual({ tipo: 'obligatorio' })
    expect(sesion.token()).toBe('vigente')
  })
})

describe('iniciarAltaSegundoFactor', () => {
  it('debeMandarElCodigoActualSoloAlRehacerElAlta', async () => {
    const pedir = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json(200, { uri: 'otpauth://totp/x', secreto: 'ABC' })))
    await iniciarAltaSegundoFactor(undefined, clienteCon(pedir))
    await iniciarAltaSegundoFactor('654321', clienteCon(pedir))
    const primero = await (await lecturaDe(pedir, 0)).text()
    const segundo = await (await lecturaDe(pedir, 1)).json()
    expect(primero).toBe('')
    expect(segundo).toEqual({ codigo: '654321' })
  })
})
