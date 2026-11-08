import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmarRestablecimiento, interpretarRestablecimiento } from './restablecimiento'

const problema = (estado: number, tipo: string) => new Response(
  JSON.stringify({ type: `https://aguavigia.example/errores/${tipo}`, title: tipo, status: estado }),
  { status: estado, headers: { 'Content-Type': 'application/problem+json' } },
)

afterEach(() => { vi.unstubAllGlobals() })

describe('restablecimiento con un toque', () => {
  it('debeTomarUn201ComoRespuestaRecibida', async () => {
    expect(await interpretarRestablecimiento(new Response('{}', { status: 201 }))).toEqual({ tipo: 'recibido' })
  })

  it('debeReconocerElEnlaceInvalidoPorSuTypeYNoPorElTexto', async () => {
    expect(await interpretarRestablecimiento(problema(403, 'enlace-invalido'))).toEqual({ tipo: 'enlace-invalido' })
    expect(await interpretarRestablecimiento(problema(400, 'peticion-invalida'))).toEqual({ tipo: 'enlace-invalido' })
    expect(await interpretarRestablecimiento(problema(403, 'acceso-denegado'))).toEqual({ tipo: 'fallo' })
  })

  it('debeLeerRetryAfterAnteUn429', async () => {
    const respuesta = new Response(null, { status: 429, headers: { 'Retry-After': '1200' } })
    expect(await interpretarRestablecimiento(respuesta)).toEqual({ tipo: 'esperar', segundos: 1200 })
  })

  it('debeDistinguirUnFalloDeRedDeUnErrorDelServidor', async () => {
    expect(await interpretarRestablecimiento(null)).toEqual({ tipo: 'sin-red' })
    expect(await interpretarRestablecimiento(new Response(null, { status: 503 }))).toEqual({ tipo: 'fallo' })
  })

  it('debeEnviarElTokenSoloEnLaPeticionAlBarrioDelEnlace', async () => {
    const fetchSimulado = vi.fn<typeof fetch>(async () => new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchSimulado)
    expect(await confirmarRestablecimiento('pie-de-la-popa', 'a+b/c')).toEqual({ tipo: 'recibido' })
    const [url, opciones] = fetchSimulado.mock.calls[0]!
    expect(url).toBe('/api/sectores/pie-de-la-popa/restablecimiento?token=a%2Bb%2Fc')
    expect(opciones?.method).toBe('POST')
    expect(new Headers(opciones?.headers).has('X-Dispositivo')).toBe(false)
  })
})
