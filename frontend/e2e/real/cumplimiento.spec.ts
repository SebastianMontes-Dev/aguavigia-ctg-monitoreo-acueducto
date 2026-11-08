import { expect, test } from '@playwright/test'

test('debeTitularConElVeredictoYPromediarPorCorteConLaApiReal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cumplimiento')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^El agua vuelve (antes de|a|más tarde de) la hora anunciada$/)
  await expect(page.getByText(/^Cumplimiento · \d+ cortes? cerrados?/)).toBeVisible()
  const respuesta = page.getByRole('region', { name: 'En promedio' })
  await expect(respuesta.getByText(/(^El agua vuelve .* la hora anunciada, en promedio\.$)|(^En promedio, el agua vuelve a la hora anunciada\.$)/)).toBeVisible()
  const indice = await respuesta.getByText(/^Índice/).textContent()
  expect(indice?.replace(/[  ]/g, ' ').trim()).toMatch(/^Índice \d{1,3}(,\d)?\s?%$/)
  await expect(page.locator('section[aria-labelledby="titulo-serie"] ol li').first()).toContainText(/\d+ cortes?/)
})
