import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { correoDe, rutaEnCorreo } from './ayudantes'
import { claveDelPanel, correoDelPanel, entrarAlPanel } from './sesion-panel'

// Sin PANEL_CORREO y PANEL_CLAVE no hay con quién invitar (ver `sesion-panel.ts`): esta prueba se omite.
test.skip(!correoDelPanel || !claveDelPanel, 'Faltan PANEL_CORREO y PANEL_CLAVE: sin un ADMIN conocido no hay quien invite')

/**
 * Invitar → correo en Mailhog → página HTML del backend para elegir la clave → ingreso en la SPA → un observador ve el panel y no puede
 * decidir nada. Crea una cuenta nueva en cada pasada (correo con UUID) y, a diferencia de las demás pruebas del panel, escribe: invita.
 * Pide `RATE_LIMIT_FACTOR_CUENTAS=10` en el backend, porque el enlace del correo es una ruta de `/api/cuentas/**`.
 */
test('debeInvitarPorCorreoElegirLaClaveYEntrarComoObservadorSinAcciones', async ({ page, request, browser }) => {
  test.setTimeout(300_000)
  const correo = `observador-${randomUUID()}@example.com`
  const clave = `Clave-${randomUUID()}`

  // 1. El ADMIN invita a una persona con el rol de menos permisos.
  await entrarAlPanel(page)
  await page.goto('/panel/cuentas')
  await page.getByRole('button', { name: 'Invitar a una persona' }).click()
  await page.getByLabel('Nombre').fill('Observadora de Prueba')
  await page.getByLabel('Correo').fill(correo)
  await page.getByLabel('Rol', { exact: true }).selectOption('OBSERVADOR')
  const invitacion = page.waitForResponse((r) => r.url().endsWith('/api/veedor/usuarios/invitaciones') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Enviar la invitación' }).click()
  expect((await invitacion).status()).toBe(201)
  await expect(page.getByText(new RegExp(`Invitamos a Observadora de Prueba \\(${correo.replace(/[.]/g, '\\.')}\\) como observador`))).toBeVisible()

  // 2. Sin elegir la clave todavía la cuenta no entra: la misma 401 que una clave mala.
  const invitada = await browser.newContext({ baseURL: 'http://localhost:4173', locale: 'es-CO' })
  const otra = await invitada.newPage()
  await otra.goto('/panel/ingreso')
  await otra.getByLabel('Correo').fill(correo)
  await otra.getByLabel('Clave', { exact: true }).fill(clave)
  await otra.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(otra.getByRole('alert').filter({ hasText: /Correo o clave incorrectos/ })).toBeVisible()

  // 3. El enlace del correo abre la página HTML del backend: ahí se elige la clave.
  const cuerpo = await correoDe(request, correo, (texto) => texto.includes('/enlaces/invitacion?token='))
  await otra.goto(rutaEnCorreo(cuerpo, '/api/cuentas/enlaces/invitacion'))
  await otra.locator('#clave').fill(clave)
  await otra.getByRole('button', { name: 'Crear mi clave' }).click()
  await expect(otra.locator('body')).not.toContainText(/inválido|venci/i)

  // 4. Ingresa a la SPA: un observador no tiene segundo factor que dar de alta y cae directo en la cola.
  await otra.goto('/panel/ingreso')
  await otra.getByLabel('Correo').fill(correo)
  await otra.getByLabel('Clave', { exact: true }).fill(clave)
  await otra.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(otra).toHaveURL(/\/panel$/)
  await expect(otra.getByRole('heading', { level: 1 })).not.toHaveText(/Consultando/)

  // 5. Ve la cola y no puede decidir: ni botones ni, por la API, permiso.
  await expect(otra.getByText('Tu cuenta puede ver la cola, pero no decidir sobre los reportes: faltan permisos de moderación.')).toBeVisible()
  await expect(otra.getByRole('button', { name: /^(Aprobar|Descartar)/ })).toHaveCount(0)
  const token = await otra.evaluate(() => sessionStorage.getItem('aguavigia.panel.token'))
  expect(token).toBeTruthy()
  const autorizacion = { Authorization: `Bearer ${token}` }
  expect((await request.get('/api/veedor/reportes/pendientes', { headers: autorizacion })).status()).toBe(200)
  expect((await request.patch('/api/veedor/reportes/00000000-0000-0000-0000-000000000000/aprobar', { headers: autorizacion })).status()).toBe(403)
  expect((await request.get('/api/veedor/usuarios', { headers: autorizacion })).status()).toBe(403)

  await invitada.close()
})
