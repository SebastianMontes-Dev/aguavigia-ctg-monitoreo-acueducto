import { expect, test } from '@playwright/test'
import { simularApi } from './api-simulada'

const AVISO = 'Datos de una simulación; no son reales.'

test('debeMostrarLaFranjaDeSimulacionEnTodasLasPantallas', async ({ page }) => {
  await simularApi(page, { modo: 'SIMULACION' })
  for (const ruta of ['/', '/sectores/armenia', '/cumplimiento', '/bitacora', '/estadisticas', '/avisos']) {
    await page.goto(ruta)
    await expect(page.getByRole('status').filter({ hasText: AVISO }), ruta).toBeVisible()
  }
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
