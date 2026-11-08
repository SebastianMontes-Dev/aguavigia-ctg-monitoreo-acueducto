import {
  aprobarCuenta, cambiarAccesoDeCuenta, invitarCuenta, leerAuditoria, leerCopias, leerCuentas, leerCuentasVisibles, leerMetricas, reactivarCuenta,
  rechazarCuenta, reenviarInvitacion, SALTOS_SEGUIDOS, suspenderCuenta,
} from './administracion'
import { crearCliente } from './cliente'
import { sesion } from './sesion'

const TIPO = 'https://aguavigia.example/errores/'

function json(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': estado >= 400 ? 'application/problem+json' : 'application/json', ...cabeceras } })
}

function clienteCon(pedir: ReturnType<typeof vi.fn<typeof fetch>>) {
  return crearCliente({ baseUrl: 'http://api.prueba', fetch: pedir })
}

async function peticion(pedir: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) {
  const enviada = pedir.mock.calls[n]?.[0]
  if (!(enviada instanceof Request)) throw new Error(`la petición ${n} no se envió`)
  const copia = enviada.clone()
  const texto = await copia.text()
  return { ruta: new URL(copia.url).pathname, busqueda: new URL(copia.url).search, metodo: copia.method, cuerpo: texto ? JSON.parse(texto) as unknown : null }
}

const hay = { 'X-Total-Count': '90', 'X-Total-Pages': '3', 'X-Page': '0', Link: '</api/veedor/usuarios?pagina=1>; rel="next"' }
const ultima = { 'X-Total-Count': '90', 'X-Total-Pages': '3', 'X-Page': '2' }

afterEach(() => sesion.limpiar())

describe('lecturas de administración', () => {
  it('debePedirLasCuentasConSusFiltrosYLeerLaPaginacionDeLasCabeceras', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [{ id: 'u1' }], hay))
    const pagina = await leerCuentas(0, { estado: 'INVITADA', barrioId: 'manga' }, { cliente: clienteCon(pedir) })
    expect(pagina.cuentas).toEqual([{ id: 'u1' }])
    expect(pagina.paginacion).toMatchObject({ total: 90, paginas: 3, pagina: 0, hayMas: true })
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/usuarios', busqueda: '?pagina=0&tamano=50&estado=INVITADA&barrioId=manga', metodo: 'GET' })
  })

  it('debeNoMandarFiltrosVacios', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [], ultima))
    await leerCuentas(2, { estado: '', barrioId: '' }, { cliente: clienteCon(pedir) })
    expect((await peticion(pedir)).busqueda).toBe('?pagina=2&tamano=50')
  })

  it('debePedirLaAuditoriaPaginadaYLasMetricasYLasCopias', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, [{ id: 'e1' }], ultima))
      .mockResolvedValueOnce(json(200, { desde: '2026-10-31T10:00:00Z' }))
      .mockResolvedValueOnce(json(200, [{ id: 1, resultado: 'OK' }]))
    expect((await leerAuditoria(1, { cliente: clienteCon(pedir) })).eventos).toEqual([{ id: 'e1' }])
    expect(await leerMetricas({ cliente: clienteCon(pedir) })).toEqual({ desde: '2026-10-31T10:00:00Z' })
    expect(await leerCopias({ cliente: clienteCon(pedir) })).toEqual([{ id: 1, resultado: 'OK' }])
    expect(await peticion(pedir, 0)).toMatchObject({ ruta: '/api/veedor/auditoria', busqueda: '?pagina=1&tamano=50' })
    expect((await peticion(pedir, 1)).ruta).toBe('/api/veedor/sistema/metricas')
    expect(await peticion(pedir, 2)).toMatchObject({ ruta: '/api/veedor/analitica/copia', busqueda: '?limite=5' })
  })

  it('debeFallarConElEstadoCuandoLaCopiaAnaliticaDa503', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(503, { type: `${TIPO}servicio-no-disponible`, status: 503 }))
    await expect(leerCopias({ cliente: clienteCon(pedir) })).rejects.toMatchObject({ estado: 503, tipo: 'servicio-no-disponible' })
  })

  it('debeFallarConElEstadoCuandoNoHayPermiso', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(403, { type: `${TIPO}acceso-denegado`, status: 403 }))
    await expect(leerAuditoria(0, { cliente: clienteCon(pedir) })).rejects.toMatchObject({ estado: 403, tipo: 'acceso-denegado' })
  })
})

describe('búsqueda de cuentas que no son sintéticas', () => {
  const sintetica = { id: 's', sintetica: true }
  const real = { id: 'r', sintetica: false }

  it('debeSaltarLasPaginasHechasSoloDeSinteticasHastaDarConUnaCuentaDeVerdad', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, [sintetica], { ...hay, 'X-Page': '0' }))
      .mockResolvedValueOnce(json(200, [sintetica], { ...hay, 'X-Page': '1' }))
      .mockResolvedValueOnce(json(200, [sintetica, real], ultima))
    const pagina = await leerCuentasVisibles(0, {}, true, { cliente: clienteCon(pedir) })
    expect(pagina).toMatchObject({ saltadas: 2, agotado: false, paginacion: { pagina: 2 } })
    expect(pagina.cuentas).toHaveLength(2)
    expect(pedir).toHaveBeenCalledTimes(3)
    expect((await peticion(pedir, 1)).busqueda).toBe('?pagina=1&tamano=50')
  })

  it('debeNoSaltarNadaSiSeMuestranLasSinteticas', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [sintetica], hay))
    const pagina = await leerCuentasVisibles(0, {}, false, { cliente: clienteCon(pedir) })
    expect(pagina.saltadas).toBe(0)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('debeDevolverLaUltimaPaginaVaciaSinBuscarMasAllaDelFinal', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(200, [], ultima))
    const pagina = await leerCuentasVisibles(2, {}, true, { cliente: clienteCon(pedir) })
    expect(pagina).toMatchObject({ cuentas: [], saltadas: 0, agotado: false })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('debeParaEnElTopeDeBusquedaYDecirloEnVezDePedirParaSiempre', async () => {
    const pedir = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json(200, [sintetica], hay)))
    const pagina = await leerCuentasVisibles(0, {}, true, { cliente: clienteCon(pedir) })
    expect(pagina).toMatchObject({ agotado: true, saltadas: SALTOS_SEGUIDOS })
    expect(pedir).toHaveBeenCalledTimes(SALTOS_SEGUIDOS)
  })
})

describe('acciones sobre cuentas', () => {
  const cuenta = { id: 'u2', estado: 'ACTIVA' }
  const ajuste = { rol: 'VEEDOR' as const, concedidos: ['VER_AUDITORIA' as const], revocados: [] }

  it('debeInvitarConCorreoNombreYRol', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(json(201, { ...cuenta, estado: 'INVITADA' }))
    const resultado = await invitarCuenta({ correo: 'luis@example.com', nombre: 'Luis', rol: 'OBSERVADOR' }, clienteCon(pedir))
    expect(resultado).toMatchObject({ tipo: 'hecho' })
    expect(await peticion(pedir)).toEqual({ ruta: '/api/veedor/usuarios/invitaciones', busqueda: '', metodo: 'POST', cuerpo: { correo: 'luis@example.com', nombre: 'Luis', rol: 'OBSERVADOR' } })
  })

  it('debeDistinguirUnCorreoRepetidoDeUnDatoInvalido', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(409, { type: `${TIPO}conflicto-de-estado` }))
      .mockResolvedValueOnce(json(400, { type: `${TIPO}peticion-invalida`, detail: 'barrio inexistente' }))
    expect(await invitarCuenta({ correo: 'a@b.co', nombre: 'A', rol: 'ADMIN' }, clienteCon(pedir))).toEqual({ tipo: 'conflicto' })
    expect(await invitarCuenta({ correo: 'a@b.co', nombre: 'A', rol: 'ADMIN' }, clienteCon(pedir))).toMatchObject({ tipo: 'rechazado' })
  })

  it('debeReenviarUnaInvitacionQueResponde202SinCuerpo', async () => {
    const pedir = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }))
    expect(await reenviarInvitacion('u2', clienteCon(pedir))).toMatchObject({ tipo: 'hecho' })
    expect(await peticion(pedir)).toMatchObject({ ruta: '/api/veedor/usuarios/u2/invitacion/reenvio', metodo: 'POST' })
  })

  it('debeLlamarCadaRutaDelCicloDeUnaCuenta', async () => {
    const pedir = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json(200, cuenta)))
    const cliente = clienteCon(pedir)
    await rechazarCuenta('u2', cliente)
    await suspenderCuenta('u2', cliente)
    await reactivarCuenta('u2', cliente)
    await aprobarCuenta('u2', ajuste, cliente)
    await cambiarAccesoDeCuenta('u2', ajuste, cliente)
    const enviadas = await Promise.all([0, 1, 2, 3, 4].map((n) => peticion(pedir, n)))
    expect(enviadas.map((envio) => `${envio.metodo} ${envio.ruta}`)).toEqual([
      'PATCH /api/veedor/usuarios/u2/rechazo',
      'PATCH /api/veedor/usuarios/u2/suspension',
      'PATCH /api/veedor/usuarios/u2/reactivacion',
      'PATCH /api/veedor/usuarios/u2/aprobacion',
      'PATCH /api/veedor/usuarios/u2/permisos',
    ])
    expect(enviadas[3]?.cuerpo).toEqual(ajuste)
    expect(enviadas[4]?.cuerpo).toEqual(ajuste)
  })

  it('debeExplicarCadaRechazoDelServidorPorSuCodigo', async () => {
    const pedir = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(409, { type: `${TIPO}conflicto-de-estado` }))
      .mockResolvedValueOnce(json(404, { type: `${TIPO}recurso-no-encontrado` }))
      .mockResolvedValueOnce(json(403, { type: `${TIPO}acceso-denegado` }))
    const cliente = clienteCon(pedir)
    expect(await suspenderCuenta('u2', cliente)).toEqual({ tipo: 'conflicto' })
    expect(await suspenderCuenta('u2', cliente)).toEqual({ tipo: 'no-existe' })
    expect(await suspenderCuenta('u2', cliente)).toEqual({ tipo: 'sin-permiso' })
  })
})
