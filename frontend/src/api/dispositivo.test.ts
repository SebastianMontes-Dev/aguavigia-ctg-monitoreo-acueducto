import { crearCliente } from './cliente'
import { obtenerDispositivo, olvidarDispositivo, renovarDispositivo } from './dispositivo'

const PREFIJO = 'https://aguavigia.example/errores/'

function almacenEnMemoria() {
  const datos = new Map<string, string>()
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => { datos.set(clave, valor) },
    removeItem: (clave: string) => { datos.delete(clave) },
  }
}

function clienteQueEmite(...tokens: (string | Response)[]) {
  const pendientes = [...tokens]
  const pedir = vi.fn<() => Promise<Response>>(async () => {
    const siguiente = pendientes.shift()
    if (siguiente instanceof Response) return siguiente
    return new Response(JSON.stringify({ token: siguiente }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  })
  return { cliente: crearCliente({ fetch: pedir as unknown as typeof fetch }), pedir }
}

describe('obtenerDispositivo', () => {
  afterEach(() => olvidarDispositivo(almacenEnMemoria()))

  it('debePedirElTokenUnaSolaVezYReutilizarlo', async () => {
    const almacen = almacenEnMemoria()
    const { cliente, pedir } = clienteQueEmite('token-1', 'token-2')
    expect(await obtenerDispositivo({ almacen, cliente })).toEqual({ tipo: 'listo', token: 'token-1' })
    expect(await obtenerDispositivo({ almacen, cliente })).toEqual({ tipo: 'listo', token: 'token-1' })
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(almacen.getItem('aguavigia.dispositivo')).toBe('token-1')
  })

  it('debeCompartirUnaSolaPeticionCuandoVariasPantallasLoPidenALaVez', async () => {
    const almacen = almacenEnMemoria()
    const { cliente, pedir } = clienteQueEmite('token-1', 'token-2')
    const [a, b] = await Promise.all([obtenerDispositivo({ almacen, cliente }), obtenerDispositivo({ almacen, cliente })])
    expect(a).toEqual(b)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('debeUsarElTokenGuardadoSinPedirOtro', async () => {
    const almacen = almacenEnMemoria()
    almacen.setItem('aguavigia.dispositivo', 'guardado')
    const { cliente, pedir } = clienteQueEmite('nuevo')
    expect(await obtenerDispositivo({ almacen, cliente })).toEqual({ tipo: 'listo', token: 'guardado' })
    expect(pedir).not.toHaveBeenCalled()
  })

  it('debeSobrevivirSinAlmacenamientoReutilizandoElTokenEnMemoria', async () => {
    const { cliente, pedir } = clienteQueEmite('token-1', 'token-2')
    expect(await obtenerDispositivo({ almacen: null, cliente })).toEqual({ tipo: 'listo', token: 'token-1' })
    expect(await obtenerDispositivo({ almacen: null, cliente })).toEqual({ tipo: 'listo', token: 'token-1' })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('debeSobrevivirAUnAlmacenamientoQueLanzaExcepciones', async () => {
    const roto = {
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
      removeItem: () => { throw new Error('bloqueado') },
    }
    const { cliente } = clienteQueEmite('token-1')
    expect(await obtenerDispositivo({ almacen: roto, cliente })).toEqual({ tipo: 'listo', token: 'token-1' })
  })

  it('debeDecirCuantoEsperarCuandoElServidorLimitaLosTokens', async () => {
    const limite = new Response(JSON.stringify({ type: `${PREFIJO}limite-de-peticiones-excedido`, status: 429 }), {
      status: 429, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '90' },
    })
    const { cliente } = clienteQueEmite(limite)
    expect(await obtenerDispositivo({ almacen: almacenEnMemoria(), cliente })).toEqual({ tipo: 'esperar', segundos: 90 })
  })

  it('debeDistinguirLaFaltaDeRedDeUnFalloDelServidor', async () => {
    const sinRed = crearCliente({ fetch: (async () => { throw new TypeError('network') }) as unknown as typeof fetch })
    expect(await obtenerDispositivo({ almacen: almacenEnMemoria(), cliente: sinRed })).toEqual({ tipo: 'sin-red' })
    const { cliente } = clienteQueEmite(new Response('{}', { status: 500 }))
    expect(await obtenerDispositivo({ almacen: almacenEnMemoria(), cliente })).toEqual({ tipo: 'fallo' })
  })
})

describe('renovarDispositivo', () => {
  afterEach(() => olvidarDispositivo(almacenEnMemoria()))

  it('debeDescartarElTokenViejoYGuardarElNuevo', async () => {
    const almacen = almacenEnMemoria()
    almacen.setItem('aguavigia.dispositivo', 'viejo')
    const { cliente } = clienteQueEmite('nuevo')
    expect(await renovarDispositivo({ almacen, cliente })).toEqual({ tipo: 'listo', token: 'nuevo' })
    expect(almacen.getItem('aguavigia.dispositivo')).toBe('nuevo')
  })
})
