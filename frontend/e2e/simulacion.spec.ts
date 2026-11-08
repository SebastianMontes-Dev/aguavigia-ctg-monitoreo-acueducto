import { expect, test } from '@playwright/test'
import { simularApi } from './api-simulada'
import { simularGestion } from './panel-gestion'

const AVISO = 'Datos de una simulación; no son reales.'

test('debeMostrarLaFranjaDeSimulacionEnTodasLasPantallas', async ({ page }) => {
  await simularApi(page, { modo: 'SIMULACION' })
  for (const ruta of ['/', '/sectores/armenia', '/cumplimiento', '/bitacora', '/estadisticas', '/avisos', '/historial', '/cuenta/solicitar', '/vecino/registro', '/vecino/ingreso']) {
    await page.goto(ruta)
    await expect(page.getByRole('status').filter({ hasText: AVISO }), ruta).toBeVisible()
  }
})

// El panel y el ingreso no están en el marco público: sin su propia franja, un veedor podría decidir sobre una simulación creyendo que es la real.
test('debeMostrarLaFranjaDeSimulacionTambienEnElIngresoYEnElPanel', async ({ page }) => {
  await simularGestion(page)
  await page.route('**/api/sistema/modo', (route) => route.fulfill({ json: { modo: 'SIMULACION', cuentasSinteticas: 0 } }))
  for (const ruta of ['/panel/ingreso', '/panel', '/panel/cortes', '/panel/seguridad']) {
    await page.goto(ruta)
    await expect(page.getByRole('status').filter({ hasText: AVISO }), ruta).toBeVisible()
  }
})

test('noDebeMostrarNadaEnElPanelConLaInstanciaReal', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(AVISO)).toHaveCount(0)
})

test('noDebeMostrarNadaConLaInstanciaReal', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  await expect(page.getByRole('heading', { level: 1, name: 'Armenia' })).toBeVisible()
  await expect(page.getByText(AVISO)).toHaveCount(0)
})

test('noDebeMostrarNadaNiBloquearElMapaSiElModoFalla', async ({ page }) => {
  await simularApi(page)
  await page.route('**/api/sistema/modo', (route) => route.abort())
  await page.goto('/sectores/armenia')
  await expect(page.getByRole('heading', { level: 1, name: 'Armenia' })).toBeVisible()
  await expect(page.getByText(AVISO)).toHaveCount(0)
})
