import { expect, test } from '@playwright/test'
import { guardarEstadoPanel } from './sesion-panel'
import { codigoTotp, segundosHastaLaSiguienteFranja } from './totp'

// El primer ADMIN nace con una clave aleatoria que el backend escribe una sola vez en su log (ADR-086). El CI fija una conocida
// con VEEDOR_PASSWORD_HASH y la pasa en estas variables; en local, sin ellas, esta prueba se omite.
const correo = process.env.PANEL_CORREO
const clave = process.env.PANEL_CLAVE
const claveNueva = `${clave ?? ''}-cambiada`

test.skip(!correo || !clave, 'Faltan PANEL_CORREO y PANEL_CLAVE: sin un ADMIN conocido no hay con quién entrar al panel')

test('debeDarDeAltaElSegundoFactorEntrarCambiarLaClaveYVolverAEntrarConElCodigo', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/panel/ingreso')
  await page.getByLabel('Correo').fill(correo!)
  await page.getByLabel('Clave', { exact: true }).fill(clave!)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()

  // Un ADMIN sin segundo factor entra con la sesión restringida: solo puede darlo de alta.
  await expect(page).toHaveURL(/\/panel\/segundo-factor$/)
  await page.getByRole('button', { name: 'Generar código QR' }).click()
  const secreto = (await page.getByText(/^[A-Z2-7]{4}( [A-Z2-7]{4}){3,}$/).innerText()).replace(/\s/g, '')
  expect(secreto).toMatch(/^[A-Z2-7]{16,}$/)
  await page.getByLabel('Código de la app').fill(codigoTotp(secreto))
  await page.getByRole('button', { name: 'Activar segundo factor' }).click()
  await expect(page).toHaveURL(/\/panel$/)
  const secciones = page.getByRole('navigation', { name: 'Secciones del panel' })
  await expect(secciones.getByRole('link', { name: 'Cuentas' })).toBeVisible()

  await secciones.getByRole('link', { name: 'Seguridad' }).click()
  await expect(page.getByText('El rol de administrador lo exige: no se puede desactivar.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Desactivar/ })).toHaveCount(0)

  await page.getByLabel('Clave actual', { exact: true }).fill(clave!)
  await page.getByLabel('Clave nueva', { exact: true }).fill(claveNueva)
  await page.getByRole('button', { name: /Cambiar clave y cerrar sesiones/ }).click()
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=clave$/)
  // Las pruebas que vienen después entran con la clave nueva y este secreto, que solo se ve una vez.
  guardarEstadoPanel({ secreto, clave: claveNueva })

  await page.getByLabel('Correo').fill(correo!)
  await page.getByLabel('Clave', { exact: true }).fill(claveNueva)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  // Cada código sirve una sola vez: el de la activación ya se gastó, así que se espera a la franja siguiente.
  await page.waitForTimeout((segundosHastaLaSiguienteFranja() + 1) * 1000)
  await page.getByLabel('Código de la app').fill(codigoTotp(secreto))
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page).toHaveURL(/\/panel$/)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=cerrada$/)
})
