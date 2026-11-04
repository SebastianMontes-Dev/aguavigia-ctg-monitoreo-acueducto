import { expect, test, type Page } from '@playwright/test'
import { simularApi } from './api-simulada'
import { simularAdministracion } from './panel-admin'
import { simularGestion } from './panel-gestion'

// FE7 · «texto al 200 %» como lo pide quien sube el tamaño de letra del navegador, sin tocar el zoom: la letra base pasa de 16 a 32 px y
// las consultas de medios en `em` reaccionan, las de `px` no. Es distinto del zoom (teclado-y-zoom.spec.ts), que cambia el ancho CSS.
test.use({ launchOptions: { args: ['--blink-settings=defaultFontSize=32'] } })

{
  const RUTAS: { ruta: string; preparar: (page: Page) => Promise<unknown> }[] = [
    { ruta: '/', preparar: simularApi },
    { ruta: '/sectores/armenia', preparar: simularApi },
    { ruta: '/cumplimiento', preparar: simularApi },
    { ruta: '/bitacora', preparar: simularApi },
    { ruta: '/estadisticas', preparar: simularApi },
    { ruta: '/avisos', preparar: simularApi },
    { ruta: '/historial', preparar: simularApi },
    { ruta: '/panel/ingreso', preparar: simularApi },
    { ruta: '/panel', preparar: (page) => simularGestion(page) },
    { ruta: '/panel/cuentas', preparar: (page) => simularAdministracion(page) },
  ]

  for (const { ruta, preparar } of RUTAS) {
    test(`noDebeDesbordarConLaLetraBaseAlDoble: ${ruta}`, async ({ page }) => {
      // También en el celular de 360 px: la regla de `base.css` (elementos que encogen y palabras que se parten) y los ajustes de la barra inferior,
      // las filas de Cumplimiento, el mapa y las rejillas `auto-fit` lo resuelven. Solo cuenta lo que ensancha la página (ver `recortado`).
      await preparar(page)
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const base = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
      expect(base, 'la letra base del navegador se duplicó').toBe(32)
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      const culpables = desborde > 1 ? await page.evaluate(() => {
        const ancho = document.documentElement.clientWidth
        // Solo cuenta lo que ensancha la página: lo que está dentro de una región con scroll propio (pestañas, tablas) no la ensancha.
        const recortado = (el: HTMLElement) => {
          for (let padre = el.parentElement; padre && padre !== document.body; padre = padre.parentElement) {
            if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(padre).overflowX)) return true
          }
          return false
        }
        return Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((el) => el.getBoundingClientRect().right > ancho + 1 && el.offsetParent !== null && !recortado(el))
          .slice(0, 8)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} der=${Math.round(el.getBoundingClientRect().right)} ancho=${Math.round(el.getBoundingClientRect().width)}`)
      }) : []
      expect(desborde, `scroll horizontal del cuerpo: ${culpables.join(' | ')}`).toBeLessThanOrEqual(1)
      // En el mapa y la ficha del celular la búsqueda y el mapa van antes que el titular (identidad.md §4): con la letra al doble el titular queda
      // bajo el primer pliegue y lo que debe verse sin bajar es la búsqueda, que es lo primero que hace quien llega.
      if (ruta === '/' || ruta.startsWith('/sectores/')) await expect(page.getByRole('combobox', { name: 'Busca tu barrio' })).toBeInViewport()
      else await expect(page.getByRole('heading', { level: 1 }).first()).toBeInViewport({ ratio: 0.5 })
    })
  }
}
