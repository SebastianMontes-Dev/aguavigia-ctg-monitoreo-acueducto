import { usaGrafito } from './Marco'

describe('usaGrafito', () => {
  it('debeUsarElGrafitoEnLasCuatroPaginasYEnLosEnlacesDeAvisos', () => {
    for (const ruta of ['/cumplimiento', '/bitacora', '/estadisticas', '/avisos', '/avisos/confirmar', '/avisos/baja']) {
      expect(usaGrafito(ruta), ruta).toBe(true)
    }
  })

  it('debeUsarElGrafitoEnLasCuentasPublicasYElVecino', () => {
    for (const ruta of ['/cuenta/solicitar', '/cuenta/olvide', '/cuenta/reenviar', '/vecino/registro', '/vecino/ingreso', '/vecino/perfil']) {
      expect(usaGrafito(ruta), ruta).toBe(true)
    }
  })

  it('noDebeUsarElGrafitoEnElMapaNiEnLaFichaDelBarrio', () => {
    for (const ruta of ['/', '/sectores/manga', '/sectores/manga/restablecimiento', '/historial', '/confirmar/abc', '/avisosx']) {
      expect(usaGrafito(ruta), ruta).toBe(false)
    }
  })
})
