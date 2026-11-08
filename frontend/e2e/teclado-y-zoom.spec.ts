import { expect, test, type Page } from '@playwright/test'
import { simularApi } from './api-simulada'
import { simularAdministracion } from './panel-admin'
import { simularGestion } from './panel-gestion'

// FE7 · accesibilidad que axe no mide: recorrido con teclado, foco visible, foco devuelto, texto al 200 % y movimiento reducido.

interface Parada { elemento: string; visible: boolean }

/** Recorre la página con Tab y anota, de cada parada, si el foco se ve (contorno o sombra de al menos 2 px). */
async function recorrer(page: Page, maximo = 60): Promise<Parada[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const paradas: Parada[] = []
  const vistos = new Set<string>()
  for (let i = 0; i < maximo; i += 1) {
    await page.keyboard.press('Tab')
    const parada = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      // El control o, si es un campo, el contenedor que dibuja el contorno con :focus-within.
      let contorno = false
      let sombra = false
      for (let nodo: HTMLElement | null = el, nivel = 0; nodo && nivel < 4 && !contorno && !sombra; nodo = nodo.parentElement, nivel += 1) {
        const estilo = getComputedStyle(nodo)
        contorno = estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2
        sombra = estilo.boxShadow !== 'none'
      }
      const nombre = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} «${(el.textContent ?? '').trim().slice(0, 30)}»`
      return { elemento: nombre, visible: contorno || sombra, clave: nombre }
    })
    if (!parada) break
    if (vistos.has(parada.clave)) break
    vistos.add(parada.clave)
    paradas.push({ elemento: parada.elemento, visible: parada.visible })
  }
  return paradas
}

const RUTAS: { ruta: string; preparar: (page: Page) => Promise<unknown> }[] = [
  { ruta: '/', preparar: simularApi },
  { ruta: '/sectores/armenia', preparar: simularApi },
  { ruta: '/cumplimiento', preparar: simularApi },
  { ruta: '/bitacora', preparar: simularApi },
  { ruta: '/estadisticas', preparar: simularApi },
  { ruta: '/avisos', preparar: simularApi },
  { ruta: '/historial', preparar: simularApi },
  { ruta: '/vecino/registro', preparar: simularApi },
  { ruta: '/panel/ingreso', preparar: simularApi },
  { ruta: '/panel', preparar: (page) => simularGestion(page) },
  { ruta: '/panel/cuentas', preparar: (page) => simularAdministracion(page) },
]

for (const { ruta, preparar } of RUTAS) {
  test(`debeRecorrerseConTecladoConElFocoSiempreVisible: ${ruta}`, async ({ page }) => {
    await preparar(page)
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    const paradas = await recorrer(page)
    expect(paradas.length, 'la página debe tener al menos un control alcanzable con Tab').toBeGreaterThan(2)
    expect(paradas.filter((parada) => !parada.visible).map((parada) => parada.elemento), 'controles que reciben el foco sin que se vea').toEqual([])
  })
}

test('debeOfrecerSaltarAlContenidoComoPrimeraParadaYLlevarElFocoAlMain', async ({ page }) => {
  await simularApi(page)
  await page.goto('/cumplimiento')
  await page.keyboard.press('Tab')
  const saltar = page.getByRole('link', { name: 'Saltar al contenido' })
  await expect(saltar).toBeFocused()
  await expect(saltar).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#contenido')).toBeFocused()
})

test('debeDevolverElFocoAlBotonQueAbrioLaHojaDeReporte', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  const abrir = page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' })
  await abrir.focus()
  await page.keyboard.press('Enter')
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  const foco = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
  expect(await foco(), 'el foco entra al diálogo').toBe(true)
  // El foco no se escapa del diálogo con Tab.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab')
    expect(await foco(), `Tab ${i + 1} dentro del diálogo`).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
  await expect(abrir).toBeFocused()
})

test('debeEscogerUnBarrioSoloConTecladoDesdeElBuscador', async ({ page }) => {
  await simularApi(page)
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Busca tu barrio' }).focus()
  await page.keyboard.type('arme')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/sectores\/armenia$/)
})

// Texto al 200 % (WCAG 1.4.4): el zoom del navegador al 200 % deja 640 px de ancho CSS en un monitor de 1280; a 400 % quedan 320 px, el
// mínimo de reflujo (1.4.10). Ahí se ve si la cabecera pasa al «Menú» y si algo se sale. Cambiar solo `font-size` no sirve de prueba:
// las consultas de medios de la cabecera están en px y no reaccionan a él, como tampoco lo hacen al tamaño de letra del sistema.
const ANCHOS = [{ nombre: 'zoom 200 % (640 px)', ancho: 640, alto: 450 }, { nombre: 'reflujo 400 % (320 px)', ancho: 320, alto: 560 }]

for (const { nombre, ancho, alto } of ANCHOS) {
  for (const { ruta, preparar } of RUTAS) {
    test(`debeSeguirUsableConElTexto, ${nombre}: ${ruta}`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto })
      await preparar(page)
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.waitForTimeout(150)
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(desborde, 'scroll horizontal del cuerpo').toBeLessThanOrEqual(1)
      // Ningún texto esencial recortado: ningún título ni botón con contenido más ancho que su caja cuando esta oculta el sobrante.
      const recortados = await page.evaluate(() => {
        const salida: string[] = []
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, button, a, label, legend'))) {
          // Los rótulos solo para lector de pantalla miden 1 px a propósito.
          const caja = el.getBoundingClientRect()
          if (el.offsetParent === null || caja.width <= 2 || caja.height <= 2) continue
          const estilo = getComputedStyle(el)
          const oculta = estilo.overflow === 'hidden' || estilo.overflowX === 'hidden'
          if (oculta && estilo.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1) salida.push(`${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 30)}»`)
        }
        return salida
      })
      expect(recortados, 'texto recortado sin elipsis').toEqual([])
    })
  }
}

test('debeAlcanzarLaAccionPrincipalDelReporteConElTextoAl200PorCiento', async ({ page }) => {
  await simularApi(page)
  await page.setViewportSize({ width: 640, height: 450 })
  await page.goto('/sectores/armenia')
  const abrir = page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' })
  await abrir.scrollIntoViewIfNeeded()
  await abrir.click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByRole('button', { name: 'No tengo agua' })).toBeVisible()
  await dialogo.getByRole('button', { name: 'No tengo agua' }).scrollIntoViewIfNeeded()
  await expect(dialogo.getByRole('button', { name: 'No tengo agua' })).toBeInViewport()
})

// Movimiento reducido: las entradas escalonadas y las barras que crecen aparecen ya en su estado final.
test('noDebeAnimarNadaConMovimientoReducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await simularApi(page)
  for (const ruta of ['/', '/cumplimiento', '/estadisticas', '/avisos']) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    const enMarcha = await page.evaluate(() =>
      document.getAnimations().filter((animacion) => {
        const objetivo = (animacion.effect as KeyframeEffect | null)?.target as HTMLElement | null
        // El selector de tema y los cambios de color tienen su propia transición de 240 ms: aquí solo importan las de movimiento.
        const propiedades = (animacion.effect as KeyframeEffect | null)?.getKeyframes().flatMap((cuadro) => Object.keys(cuadro)) ?? []
        return Boolean(objetivo) && propiedades.some((propiedad) => ['transform', 'translate', 'scale', 'rotate', 'strokeDashoffset', 'stroke-dashoffset'].includes(propiedad)) && animacion.playState === 'running'
      }).map((animacion) => (animacion.effect as KeyframeEffect).target?.nodeName ?? '?'),
    )
    expect(enMarcha, `${ruta}: animaciones de movimiento en marcha`).toEqual([])
  }
})
