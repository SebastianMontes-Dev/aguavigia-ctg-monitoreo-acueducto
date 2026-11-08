import { crearCliente } from './cliente'
import { camposRechazados, interpretarSolicitud, pedirRestablecimiento, registrarVecino, reenviarVerificacion, solicitarAcceso } from './cuentas'

const TIPO = 'https://aguavigia.example/errores/'

function respuesta(estado: number, cabeceras: Record<string, string> = {}) {
  return new Response(null, { status: estado, headers: cabeceras })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function enviada(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  const peticion = pedir.mock.calls[0]?.[0]
  if (!(peticion instanceof Request)) throw new Error('no se envió ninguna petición')
  return { ruta: new URL(peticion.url).pathname, metodo: peticion.method, cuerpo: await peticion.clone().json() as unknown, autorizacion: peticion.headers.get('Authorization') }
}

describe('interpretarSolicitud', () => {
  it('debeDarPorRecibidoUnAcceptedYNadaMas', () => {
    expect(interpretarSolicitud(respuesta(202), null)).toEqual({ tipo: 'recibido' })
    expect(interpretarSolicitud(respuesta(500), { type: `${TIPO}error-interno` })).toEqual({ tipo: 'fallo' })
  })

  it('noDebeDarPorRecibidaUnaSolicitudSinRespuesta', () => {
    expect(interpretarSolicitud(null, null)).toEqual({ tipo: 'sin-red' })
  })

  it('debeEsperarElRetryAfterDelTopeDeCuentas', () => {
    expect(interpretarSolicitud(respuesta(429, { 'Retry-After': '600' }), { type: `${TIPO}limite-de-peticiones-excedido` }))
      .toEqual({ tipo: 'esperar', segundos: 600 })
  })

  it('debeRepartirLosErroresDelCuerpoPorCampo', () => {
    const cuerpo = { type: `${TIPO}peticion-invalida`, detail: 'Datos inválidos', errores: ['clave: La clave es muy repetitiva', 'consentimiento.privacidad: Debe aceptarse'] }
    expect(interpretarSolicitud(respuesta(400), cuerpo)).toEqual({
      tipo: 'rechazado',
      mensaje: 'Datos inválidos',
      campos: { clave: 'La clave es muy repetitiva', privacidad: 'Debe aceptarse' },
    })
  })
})

describe('camposRechazados', () => {
  it('debeIgnorarLoQueNoTieneLaFormaCampoMensaje', () => {
    expect(camposRechazados(null)).toEqual({})
    expect(camposRechazados({ errores: ['sin separador', 7, ': vacío'] } as never)).toEqual({})
  })
})

describe('envíos de cuenta', () => {
  it('debeSolicitarAccesoSinElTokenDeNingunaSesion', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(respuesta(202))
    window.sessionStorage.setItem('aguavigia.panel.token', 'del-panel')
    expect(await solicitarAcceso({ correo: 'a@example.com', nombre: 'Ana', clave: 'una clave larga y unica' }, clienteCon(pedir))).toEqual({ tipo: 'recibido' })
    expect(await enviada(pedir)).toEqual({
      ruta: '/api/cuentas/registro', metodo: 'POST', autorizacion: null,
      cuerpo: { correo: 'a@example.com', nombre: 'Ana', clave: 'una clave larga y unica' },
    })
  })

  it('debePedirElRestablecimientoYElReenvioSoloConElCorreo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(respuesta(202))
    await pedirRestablecimiento('a@example.com', clienteCon(pedir))
    expect(await enviada(pedir)).toMatchObject({ ruta: '/api/cuentas/restablecimiento', cuerpo: { correo: 'a@example.com' } })
    const otra = vi.fn<typeof fetch>().mockResolvedValue(respuesta(202))
    await reenviarVerificacion('a@example.com', clienteCon(otra))
    expect(await enviada(otra)).toMatchObject({ ruta: '/api/cuentas/verificacion/reenvio', cuerpo: { correo: 'a@example.com' } })
  })

  it('debeRegistrarAlVecinoConBarrioYConsentimientoYSinClave', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(respuesta(202))
    await registrarVecino({ correo: 'v@example.com', nombre: 'Vera', barrioId: 'manga', privacidad: true, avisos: false }, clienteCon(pedir))
    const { ruta, cuerpo } = await enviada(pedir)
    expect(ruta).toBe('/api/cuentas/vecino')
    expect(cuerpo).toEqual({ correo: 'v@example.com', nombre: 'Vera', barrioId: 'manga', consentimiento: { privacidad: true, avisos: false } })
    expect(cuerpo).not.toHaveProperty('clave')
  })

  it('debeDecirSinRedSiLaPeticionFalla', async () => {
    const pedir = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('sin red'))
    expect(await pedirRestablecimiento('a@example.com', clienteCon(pedir))).toEqual({ tipo: 'sin-red' })
  })
})
