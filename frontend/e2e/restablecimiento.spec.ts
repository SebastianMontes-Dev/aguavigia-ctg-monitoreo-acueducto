import { expect, test, type Page, type Route } from '@playwright/test'
import { problema, simularApi } from './api-simulada'

/** Devuelve las URL de cada voto que llega al servidor. */
async function simularVotos(page: Page, responder: (route: Route) => Promise<void>) {
  const votos: string[] = []
  await page.route(/\/api\/sectores\/[^/]+\/restablecimiento\?token=/, (route) => {
    votos.push(route.request().url())
    return responder(route)
  })
  return votos
}

test('noDebeVotarAlAbrirElEnlaceYDebeRegistrarLaRespuestaAlPulsar', async ({ page }) => {
  await simularApi(page)
  const votos = await simularVotos(page, (route) => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'r9', sectorId: 'armenia', tipo: 'SERVICIO_RESTABLECIDO' }) }))
  await page.goto('/sectores/armenia/restablecimiento?token=firmado')

  await expect(page.getByRole('heading', { level: 1, name: '¿Ya volvió el agua a Armenia?' })).toBeVisible()
  await expect(page.getByText('Ahora figura como: Sin servicio')).toBeVisible()
  await expect(page).toHaveURL(/\/sectores\/armenia\/restablecimiento$/)
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
  expect(votos).toHaveLength(0)

  await page.getByRole('button', { name: 'Sí, ya volvió el agua' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Gracias' })).toContainText('Tu respuesta cuenta junto con la de tus vecinos.')
  expect(votos).toHaveLength(1)
  expect(votos[0]).toContain('/api/sectores/armenia/restablecimiento?token=firmado')
  await expect(page.getByRole('link', { name: 'Ver Armenia' })).toHaveAttribute('href', '/sectores/armenia')
})

test('debeDecirQueElEnlaceYaNoSirveYLlevarAlBarrio', async ({ page }) => {
  await simularApi(page)
  await simularVotos(page, (route) => route.fulfill(problema(403, 'enlace-invalido', 'El enlace no sirve')))
  await page.goto('/sectores/armenia/restablecimiento?token=vencido')
  await page.getByRole('button', { name: 'Sí, ya volvió el agua' }).click()
  await expect(page.getByRole('alert')).toContainText('Este enlace ya no sirve')
  await expect(page.getByRole('button', { name: 'Sí, ya volvió el agua' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Ver Armenia' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Armenia' })).toBeVisible()
})

test('debeEsperarLoQueDiceRetryAfterAnteUn429', async ({ page }) => {
  await simularApi(page)
  const votos = await simularVotos(page, (route) => route.fulfill({ ...problema(429, 'limite-reportes-excedido', 'Cupo agotado'), headers: { 'Retry-After': '1200' } }))
  await page.goto('/sectores/armenia/restablecimiento?token=firmado')
  const boton = page.getByRole('button', { name: 'Sí, ya volvió el agua' })
  await boton.click()
  await expect(page.getByRole('alert')).toContainText('Espera 20 minutos antes de volver a intentarlo.')
  await expect(boton).toBeDisabled()
  expect(votos).toHaveLength(1)
})

test('debeExplicarQueFaltaElEnlaceCompletoSinOfrecerElBoton', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia/restablecimiento')
  await expect(page.getByRole('alert')).toContainText('Falta el enlace completo')
  await expect(page.getByRole('button', { name: 'Sí, ya volvió el agua' })).toHaveCount(0)
})

test('noDebeInventarElBarrioSiNoEstaEnElListado', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/no-existe/restablecimiento?token=firmado')
  await expect(page.getByRole('heading', { level: 1, name: '¿Ya volvió el agua a tu barrio?' })).toBeVisible()
  await expect(page.getByText(/Ahora figura como/)).toHaveCount(0)
})
