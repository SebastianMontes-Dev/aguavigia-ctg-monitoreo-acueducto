import { expect, test, type Page } from '@playwright/test'
import { simularApi } from './api-simulada'

// El muestrario (/muestrario) es de desarrollo desde FE7: la build que prueba Playwright no lo trae. El tema y la tipografía se
// comprueban en una página real, el mapa, que pinta el papel directamente sobre <body>.

// toHaveCSS reintenta: el cambio de tema dura 240 ms (identidad.md §5) y una lectura inmediata ve el color de antes.
function esperarFondo(page: Page, color: string) {
  return expect(page.locator('body')).toHaveCSS('background-color', color)
}

const PAPEL_CLARO = 'rgb(245, 245, 242)'
const PAPEL_OSCURO = 'rgb(15, 18, 20)'

async function abrirMapa(page: Page) {
  await simularApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Cartagena ahora' })).toBeVisible()
}

// El selector de tema vive en la cabecera en escritorio y dentro del «Menú» en el celular.
async function elegirTema(page: Page, tema: 'Claro' | 'Oscuro') {
  const menu = page.getByRole('button', { name: 'Menú' })
  if (await menu.isVisible()) await menu.click()
  await page.locator('label:visible', { hasText: new RegExp(`^${tema}$`) }).first().click()
}

test('debeAplicarLosTokensEnElTemaClaroYEnElOscuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await abrirMapa(page)
  await esperarFondo(page, PAPEL_CLARO)

  await elegirTema(page, 'Oscuro')
  await esperarFondo(page, PAPEL_OSCURO)

  await page.reload()
  await esperarFondo(page, PAPEL_OSCURO)
})

test('debeSeguirAlSistemaYDejarQueElInterruptorLoContradiga', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await abrirMapa(page)
  await esperarFondo(page, PAPEL_OSCURO)

  await elegirTema(page, 'Claro')
  await esperarFondo(page, PAPEL_CLARO)

  await page.reload()
  await esperarFondo(page, PAPEL_CLARO)
})

// ADR-071: la serif llega del mismo origen y solo en la marca y los titulares; los controles usan la del sistema.
test('debeServirNewsreaderDesdeElProyectoYSoloEnMarcaYTitular', async ({ page }) => {
  const pedidas: string[] = []
  page.on('request', (peticion) => pedidas.push(peticion.url()))
  await abrirMapa(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /^Newsreader/)
  await expect(page.getByRole('combobox', { name: 'Busca tu barrio' })).not.toHaveCSS('font-family', /Newsreader/)
  await page.evaluate(() => document.fonts.ready)
  expect(pedidas.filter((url) => url.includes('.woff2'))).toEqual([
    expect.stringMatching(/\/fuentes\/newsreader-latin-wght\.woff2$/),
  ])
  const origen = new URL(page.url()).origin
  expect(pedidas.filter((url) => url.startsWith('http') && !url.startsWith(origen))).toEqual([])
})

test('noDebeHacerScrollHorizontalEnElCuerpo', async ({ page }) => {
  await abrirMapa(page)
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(desborda).toBe(false)
})
