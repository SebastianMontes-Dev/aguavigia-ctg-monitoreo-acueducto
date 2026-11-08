import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { correoDe, puntoDentroDe, rutaEnCorreo } from './ayudantes'

// Un barrio grande: su umbral de vecinos es alto y un solo reporte de prueba no mueve su estado.
const BARRIO = { id: 'san-pedro-martir', nombre: 'San Pedro Martir', busqueda: 'san pedro martir' }
const CLAVE_VECINO = 'aguavigia.vecino.token'

async function ingresar(page: Page, correo: string, clave: string) {
  await page.goto('/vecino/ingreso')
  await page.getByLabel('Correo', { exact: true }).fill(correo)
  await page.getByLabel('Clave', { exact: true }).fill(clave)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}

/**
 * Registro de vecino → enlace en Mailhog → página HTML del backend para elegir la clave → ingreso en la SPA → verificar el barrio con una
 * geolocalización simulada dentro del polígono → reportar y ver `CUENTA_VERIFICADA`. Pide `RATE_LIMIT_FACTOR_CUENTAS=10` en el backend:
 * `/api/cuentas/**` admite 10 peticiones cada 10 minutos por IP y este flujo gasta 3.
 */
test('debeRegistrarseElegirLaClaveVerificarElBarrioYReportarComoVecino', async ({ page, request, context }) => {
  const correo = `vecino-${randomUUID()}@example.com`
  const clave = `Clave-${randomUUID()}`
  const reportes: { autorizacion: string | undefined; dispositivo: string | undefined }[] = []
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === '/api/reportes') {
      reportes.push({ autorizacion: peticion.headers().authorization, dispositivo: peticion.headers()['x-dispositivo'] })
    }
  })

  // 1. Registro: sin clave, con barrio y la casilla de privacidad.
  await page.goto('/vecino/registro')
  await page.getByLabel('Correo', { exact: true }).fill(correo)
  await page.getByLabel('Nombre', { exact: true }).fill('Vecina de Prueba')
  await page.getByRole('combobox', { name: 'Tu barrio' }).fill(BARRIO.busqueda)
  await page.getByRole('option', { name: BARRIO.nombre }).click()
  await page.getByLabel(/Acepto que AguaVigía guarde/).check()
  const registro = page.waitForResponse((r) => r.url().endsWith('/api/cuentas/vecino') && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
  expect((await registro).status()).toBe(202)
  await expect(page.getByRole('status')).toContainText('Si la dirección es válida')

  // 2. Sin elegir la clave todavía, la cuenta no entra (la misma 401 que una clave mala).
  await ingresar(page, correo, clave)
  await expect(page.getByRole('alert').filter({ hasText: 'Correo o clave incorrectos' })).toBeVisible()

  // 3. El enlace del correo abre la página HTML del backend: ahí se elige la clave y la cuenta queda activa.
  const cuerpo = await correoDe(request, correo, (texto) => texto.includes('/enlaces/invitacion?token='))
  await page.goto(rutaEnCorreo(cuerpo, '/api/cuentas/enlaces/invitacion'))
  await page.locator('#clave').fill(clave)
  await page.getByRole('button', { name: 'Crear mi clave' }).click()
  await expect(page.locator('body')).not.toContainText(/inválido|venci/i)

  // 4. Ingreso en la SPA y perfil: el barrio aún sin verificar.
  await ingresar(page, correo, clave)
  await expect(page).toHaveURL(/\/vecino\/perfil$/)
  await expect(page.getByRole('heading', { level: 1, name: `Vecina de Prueba, vecino de ${BARRIO.nombre}` })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Estado de tu barrio' })).toContainText(`${BARRIO.nombre}: sin verificar`)

  // 5. Verificar el barrio con una ubicación dentro del polígono.
  const punto = await puntoDentroDe(request, BARRIO.id)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: punto.latitud, longitude: punto.longitud, accuracy: 25 })
  const verificacion = page.waitForResponse((r) => r.url().endsWith('/api/vecino/verificacion-barrio'))
  await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
  expect((await verificacion).status()).toBe(200)
  await expect(page.getByRole('region', { name: 'Estado de tu barrio' })).toContainText(`${BARRIO.nombre}: verificado`)

  // 6. Reportar con la cuenta: el token del vecino va junto al del dispositivo y el reporte llega verificado por la cuenta.
  await page.goto(`/sectores/${BARRIO.id}`)
  await expect(page.getByRole('heading', { level: 1, name: BARRIO.nombre })).toBeVisible()
  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await expect(page.getByRole('dialog')).toContainText(`Reportas como Vecina de Prueba, vecino de ${BARRIO.nombre}.`)
  const reporte = page.waitForResponse((r) => r.url().endsWith('/api/reportes') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Llega poca agua', exact: true }).click()
  const respuesta = await reporte
  expect(respuesta.status()).toBe(201)
  expect(((await respuesta.json()) as { verificacion: string }).verificacion).toBe('CUENTA_VERIFICADA')
  expect(reportes).toHaveLength(1)
  expect(reportes[0]?.autorizacion).toMatch(/^Bearer .+/)
  expect(reportes[0]?.dispositivo).toBeTruthy()

  // 7. El token de un vecino no abre nada del panel.
  const token = await page.evaluate((llave) => window.sessionStorage.getItem(llave), CLAVE_VECINO)
  expect(token).toBeTruthy()
  const panel = await request.get('/api/veedor/reportes/pendientes', { headers: { Authorization: `Bearer ${token}` } })
  expect(panel.status()).toBe(403)
  await page.goto('/panel')
  await expect(page).toHaveURL(/\/panel\/ingreso$/)

  // 8. Cerrar todas las sesiones: el token deja de servir en el servidor.
  await page.goto('/vecino/perfil')
  await page.getByRole('button', { name: 'Cerrar todas mis sesiones' }).click()
  await expect(page).toHaveURL(/\/vecino\/ingreso\?motivo=cerrada$/)
  const tras = await request.get('/api/vecino/yo', { headers: { Authorization: `Bearer ${token}` } })
  expect(tras.status()).toBe(401)
})
