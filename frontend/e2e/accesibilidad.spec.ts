import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { PANTALLAS, titular, type Pantalla } from './pantallas'

// FE7 · accesibilidad: axe sin violaciones (WCAG 2.2 AA) en todas las pantallas, en claro y en oscuro (grafito incluido).
// Con movimiento reducido: la entrada escalonada (identidad.md §5) deja el contenido a medio opacar durante 560 ms y axe mediría
// contraste sobre un color que nadie ve. Es además la pasada de «movimiento reducido» de la puerta.

const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function revisar(page: Page, pantalla: Pantalla) {
  await pantalla.preparar?.(page)
  await page.goto(pantalla.ruta)
  await (pantalla.listo ?? titular)(page)
  await pantalla.abrir?.(page)
  await page.evaluate(() => document.fonts.ready)
  // Una pantalla del panel sin sesión válida acaba en el ingreso: axe pasaría sobre la pantalla equivocada.
  expect(new URL(page.url()).pathname, 'la pantalla no debe redirigir').toBe(pantalla.ruta.split('?')[0])
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS).disableRules(pantalla.sinReglas ?? []).analyze()
  // Que pasen reglas prueba que axe sí midió algo; «sin concluir» son los textos sobre el lienzo del mapa y las flechas decorativas.
  expect(resultado.passes.length, 'axe debe haber medido la pantalla').toBeGreaterThan(5)
  const resumen = resultado.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' | ')}`).join('\n')}`)
  expect(resumen, `${pantalla.ruta}\n${resumen.join('\n')}`).toEqual([])
}

for (const esquema of ['light', 'dark'] as const) {
  test.describe(`axe · tema ${esquema}`, () => {
    test.use({ colorScheme: esquema })
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })
    for (const pantalla of PANTALLAS) {
      test(`noDebeTenerViolacionesDeAccesibilidad: ${pantalla.nombre}`, async ({ page }) => {
        await revisar(page, pantalla)
      })
    }
  })
}
