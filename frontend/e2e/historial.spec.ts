import { expect, test } from '@playwright/test'
import { simularApi } from './api-simulada'

test('debeLlevarDelHistorialATresVistasEnGrafito', async ({ page }) => {
  await simularApi(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/historial')
  await expect(page.getByRole('heading', { level: 1, name: 'Lo que pasó con el agua en Cartagena' })).toBeVisible()
  await expect(page.locator('body')).toHaveAttribute('data-paleta', 'grafito')

  const vistas = page.getByRole('main').getByRole('listitem')
  await expect(vistas).toHaveCount(3)
  await expect(vistas.nth(0)).toContainText('Cumplimiento')
  await expect(vistas.nth(1)).toContainText('Bitácora')
  await expect(vistas.nth(2)).toContainText('Estadísticas')

  await page.getByRole('link', { name: /Bitácora/ }).first().click()
  await expect(page).toHaveURL(/\/bitacora$/)
})

test('debeDecirQueUnaRutaDesconocidaNoExisteYOfrecerElMapa', async ({ page }) => {
  await simularApi(page)
  await page.goto('/esto-no-existe')
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible()
  await page.getByRole('link', { name: 'Ir al mapa' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('noDebeServirElMuestrarioEnLaBuildDeProduccion', async ({ page }) => {
  await simularApi(page)
  await page.goto('/muestrario')
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible()
})
