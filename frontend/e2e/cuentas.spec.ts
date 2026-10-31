import { expect, test } from '@playwright/test'
import { problema, simularApi } from './api-simulada'
import { conEspera } from './vecino'

const NEUTRO_ACCESO = 'Si la dirección es válida, te enviamos un correo para confirmarla.'

async function llenarSolicitud(page: import('@playwright/test').Page, clave = 'una clave larga y unica') {
  await page.getByLabel('Nombre', { exact: true }).fill('Ana Pérez')
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.com')
  await page.getByLabel('Clave', { exact: true }).fill(clave)
}

test('debeSolicitarAccesoConMensajeNeutroSinPrometerNada', async ({ page }) => {
  await simularApi(page)
  const cuerpos: unknown[] = []
  await page.route('**/api/cuentas/registro', (route) => {
    cuerpos.push(route.request().postDataJSON())
    return route.fulfill({ status: 202 })
  })
  await page.goto('/cuenta/solicitar')
  await expect(page.getByRole('heading', { level: 1, name: 'Pide acceso al panel' })).toBeVisible()
  await llenarSolicitud(page)
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  await expect(page.getByRole('status')).toHaveText(NEUTRO_ACCESO)
  await expect(page.getByText(/una persona del equipo tiene que aprobar la cuenta/)).toBeVisible()
  expect(cuerpos).toEqual([{ correo: 'ana@example.com', nombre: 'Ana Pérez', clave: 'una clave larga y unica' }])
  await expect(page.getByRole('link', { name: /Reenviar el correo/ })).toHaveAttribute('href', '/cuenta/reenviar')
})

test('debeValidarLaClaveEnElClienteSinPedirNadaYPonerElErrorJuntoAlCampo', async ({ page }) => {
  await simularApi(page)
  let peticiones = 0
  await page.route('**/api/cuentas/registro', (route) => {
    peticiones++
    return route.fulfill({ status: 202 })
  })
  await page.goto('/cuenta/solicitar')
  await llenarSolicitud(page, 'corta')
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  const clave = page.getByLabel('Clave', { exact: true })
  await expect(clave).toHaveAttribute('aria-invalid', 'true')
  await expect(clave).toBeFocused()
  await expect(page.getByText('Usa al menos 12 caracteres.')).toBeVisible()
  expect(peticiones).toBe(0)
  await page.getByLabel('Nombre', { exact: true }).fill('')
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible()
  await expect(page.getByLabel('Nombre', { exact: true })).toBeFocused()
})

test('debeRepartirElDetalleDelServidorJuntoACadaCampo', async ({ page }) => {
  await simularApi(page)
  await page.route('**/api/cuentas/registro', (route) => route.fulfill({
    ...problema(400, 'peticion-invalida', 'Datos inválidos'),
    body: JSON.stringify({ type: 'https://aguavigia.example/errores/peticion-invalida', status: 400, detail: 'Datos inválidos', errores: ['clave: La clave repite demasiado los mismos caracteres'] }),
  }))
  await page.goto('/cuenta/solicitar')
  await llenarSolicitud(page, 'aaaaaaaaaaaaaaaa')
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  await expect(page.getByText('La clave repite demasiado los mismos caracteres')).toBeVisible()
  await expect(page.getByLabel('Clave', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Revisa los campos marcados.')).toBeVisible()
})

test('debeDecirCuantoEsperarEnElLimiteYNoDarPorEnviadaUnaSolicitudSinRed', async ({ page }) => {
  await simularApi(page)
  let intento = 0
  await page.route('**/api/cuentas/registro', (route) => {
    intento++
    if (intento === 1) return route.fulfill(conEspera(problema(429, 'limite-de-peticiones-excedido', 'Límite'), 600))
    if (intento === 2) return route.abort('connectionfailed')
    return route.fulfill(problema(500, 'error-interno', 'Detalle interno que no se debe mostrar'))
  })
  await page.goto('/cuenta/solicitar')
  await llenarSolicitud(page)
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Podrás volver a intentarlo en 10 minutos' })).toBeVisible()
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos comprobar si se recibió la solicitud. Revisa tu conexión' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: /Solicitar acceso/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No pudimos comprobar si se recibió la solicitud. Inténtalo de nuevo' })).toBeVisible()
  await expect(page.getByText('Detalle interno')).toHaveCount(0)
})

test('debeDecirLoMismoAlOlvidarLaClaveExistaONoLaCuenta', async ({ page }) => {
  await simularApi(page)
  const correos: string[] = []
  await page.route('**/api/cuentas/restablecimiento', (route) => {
    correos.push((route.request().postDataJSON() as { correo: string }).correo)
    return route.fulfill({ status: 202 })
  })
  await page.goto('/cuenta/olvide')
  await page.getByLabel('Correo', { exact: true }).fill('existe@example.com')
  await page.getByRole('button', { name: /Enviar enlace/ }).click()
  const primero = await page.getByRole('status').innerText()
  await page.getByRole('button', { name: 'Usar otro correo' }).click()
  await page.getByLabel('Correo', { exact: true }).fill('no-existe@example.com')
  await page.getByRole('button', { name: /Enviar enlace/ }).click()
  await expect(page.getByRole('status')).toHaveText(primero)
  expect(primero).toBe('Si hay una cuenta con ese correo, te enviamos un enlace para elegir una clave nueva. Vence en 30 minutos.')
  expect(correos).toEqual(['existe@example.com', 'no-existe@example.com'])
})

test('debePedirUnCorreoValidoAntesDeEnviar', async ({ page }) => {
  await simularApi(page)
  let peticiones = 0
  await page.route('**/api/cuentas/restablecimiento', (route) => {
    peticiones++
    return route.fulfill({ status: 202 })
  })
  await page.goto('/cuenta/olvide')
  await page.getByRole('button', { name: /Enviar enlace/ }).click()
  await expect(page.getByText('Escribe tu correo.')).toBeVisible()
  await page.getByLabel('Correo', { exact: true }).fill('sin-arroba')
  await page.getByRole('button', { name: /Enviar enlace/ }).click()
  await expect(page.getByText(/Revisa el correo: debe tener la forma/)).toBeVisible()
  expect(peticiones).toBe(0)
})

test('debeReenviarElCorreoConElMismoMensajeYSinPedirRegistrarseOtraVez', async ({ page }) => {
  await simularApi(page)
  const cuerpos: unknown[] = []
  await page.route('**/api/cuentas/verificacion/reenvio', (route) => {
    cuerpos.push(route.request().postDataJSON())
    return route.fulfill({ status: 202 })
  })
  await page.goto('/cuenta/reenviar')
  await expect(page.getByRole('heading', { level: 1, name: '¿No te llegó el correo?' })).toBeVisible()
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.com')
  await page.getByRole('button', { name: /Reenviar el correo/ }).click()
  await expect(page.getByRole('status')).toHaveText('Si hay una solicitud pendiente, te reenviamos el correo.')
  expect(cuerpos).toEqual([{ correo: 'ana@example.com' }])
})

test('debeRetirarElTokenDeLaUrlSiAlgunaPantallaDeCuentaLoRecibe', async ({ page }) => {
  await simularApi(page)
  await page.goto('/cuenta/solicitar?token=secreto-del-correo')
  await expect(page.getByRole('heading', { level: 1, name: 'Pide acceso al panel' })).toBeVisible()
  await expect.poll(() => page.url()).not.toContain('token')
  expect(page.url()).not.toContain('secreto')
})

test('debeEnlazarLasCuentasDesdeElIngresoDelPanel', async ({ page }) => {
  await simularApi(page)
  await page.goto('/panel/ingreso')
  await expect(page.getByRole('link', { name: 'Olvidé mi clave' })).toHaveAttribute('href', '/cuenta/olvide')
  await expect(page.getByRole('link', { name: 'Solicitar acceso' })).toHaveAttribute('href', '/cuenta/solicitar')
  await expect(page.getByRole('link', { name: '¿No te llegó el correo?' })).toHaveAttribute('href', '/cuenta/reenviar')
  await page.getByRole('link', { name: 'Solicitar acceso' }).click()
  await expect(page).toHaveURL(/\/cuenta\/solicitar$/)
})

test('noDebeUsarLaPalabraVeedorEnLasPantallasPublicasDeCuenta', async ({ page }) => {
  await simularApi(page)
  for (const ruta of ['/cuenta/solicitar', '/cuenta/olvide', '/cuenta/reenviar', '/vecino/registro', '/vecino/ingreso']) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('body'), ruta).not.toContainText(/veedor/i)
  }
})
