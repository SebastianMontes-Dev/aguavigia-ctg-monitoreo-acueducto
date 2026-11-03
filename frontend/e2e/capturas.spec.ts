import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { PANTALLAS, titular } from './pantallas'

// FE7 · capturas para revisar-diseno: cada pantalla en 1440×900, 1024×768, 768×1024 y 390×844, en claro, en oscuro y con movimiento
// reducido (en claro). No es una prueba: solo corre con CAPTURAS=1 y escribe en test-results/capturas/fe7/ (ignorado por git).
// `npm run test:e2e` vacía test-results al empezar: se corre al final y, si hace falta conservarlas, se copian aparte.
//   CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --project=escritorio
test.skip(!process.env.CAPTURAS, 'Solo con CAPTURAS=1')

const ANCHOS = [
  { nombre: '1440', ancho: 1440, alto: 900 },
  { nombre: '1024', ancho: 1024, alto: 768 },
  { nombre: '768', ancho: 768, alto: 1024 },
  { nombre: '390', ancho: 390, alto: 844 },
]
const VARIANTES = [
  { nombre: 'claro', esquema: 'light', movimiento: 'no-preference' },
  { nombre: 'oscuro', esquema: 'dark', movimiento: 'no-preference' },
  { nombre: 'reducido', esquema: 'light', movimiento: 'reduce' },
] as const

const CARPETA = join(process.cwd(), 'test-results', 'capturas', 'fe7')
const archivo = (nombre: string) => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '')

for (const pantalla of PANTALLAS) {
  test(`captura: ${pantalla.nombre}`, async ({ browser }) => {
    test.setTimeout(120_000)
    mkdirSync(CARPETA, { recursive: true })
    for (const variante of VARIANTES) {
      for (const { nombre, ancho, alto } of ANCHOS) {
        const contexto = await browser.newContext({ viewport: { width: ancho, height: alto }, colorScheme: variante.esquema, reducedMotion: variante.movimiento, locale: 'es-CO', isMobile: ancho < 600, hasTouch: ancho < 600 })
        const page = await contexto.newPage()
        await pantalla.preparar?.(page)
        await page.goto(pantalla.ruta)
        await (pantalla.listo ?? titular)(page)
        await pantalla.abrir?.(page)
        await page.evaluate(() => document.fonts.ready)
        // La entrada escalonada dura 560 ms (identidad.md §5): la captura se toma cuando terminó.
        await page.waitForTimeout(variante.movimiento === 'reduce' ? 150 : 900)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await page.screenshot({ path: join(CARPETA, `${archivo(pantalla.nombre)}__${nombre}__${variante.nombre}.png`) })
        await contexto.close()
      }
    }
  })
}
