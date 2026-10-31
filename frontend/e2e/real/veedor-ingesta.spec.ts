import { expect, test } from '@playwright/test'
import { claveDelPanel, correoDelPanel, entrarAlPanel, tokenDelPanel } from './sesion-panel'

// Sin PANEL_CORREO y PANEL_CLAVE no hay con quién entrar al panel (ver `sesion-panel.ts`): estas pruebas se omiten.
test.skip(!correoDelPanel || !claveDelPanel, 'Faltan PANEL_CORREO y PANEL_CLAVE: sin un ADMIN conocido no hay con quién entrar al panel')

interface Propuesta { id: string; sectorId: string; citaTextual?: string; urlOriginal?: string | null; estadoRevision: string }

// Solo lee: no aprueba ni descarta nada, porque las propuestas de `INGESTA_MODO=local` son datos del backend que otras pruebas comparten.
test('debeMostrarLasPropuestasDelBackendRealSinInventarEvidencia', async ({ page, request }) => {
  test.setTimeout(240_000)
  await entrarAlPanel(page)
  const autorizacion = { Authorization: `Bearer ${await tokenDelPanel(page)}` }

  const respuesta = await request.get('/api/veedor/ingesta/propuestas?pagina=0&tamano=20', { headers: autorizacion })
  expect(respuesta.ok()).toBeTruthy()
  const delServidor = await respuesta.json() as Propuesta[]
  const total = Number(respuesta.headers()['x-total-count'] ?? delServidor.length)

  await page.goto('/panel/ingesta')
  const cola = page.getByRole('region', { name: 'Propuestas de la ingesta' })
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Consultando/)
  if (delServidor.length === 0) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No hay propuestas por revisar')
    await expect(cola).toContainText('No hay propuestas pendientes')
  } else {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(total === 1 ? '1 propuesta' : 'propuestas')
    // Cada frase que se ve viene en la respuesta; cada propuesta sin frase lo dice, y no se muestra ninguna de más.
    const conCita = delServidor.filter((propuesta) => propuesta.citaTextual?.trim())
    await expect(cola.locator('blockquote')).toHaveCount(conCita.length)
    for (const propuesta of conCita) await expect(cola.locator('blockquote').filter({ hasText: propuesta.citaTextual!.trim().slice(0, 40) }).first()).toBeVisible()
    await expect(cola.getByText(/no trae la frase del boletín/)).toHaveCount(delServidor.length - conCita.length)
    await expect(cola.getByRole('button', { name: /^Aprobar la propuesta/ })).toHaveCount(conCita.length)
    await expect(cola.getByRole('button', { name: /^Descartar la propuesta/ })).toHaveCount(delServidor.length)
  }

  // Salud y fallidos salen de las mismas rutas que la pantalla; la lista de salud puede estar vacía mientras no corra un ciclo.
  const salud = await (await request.get('/api/veedor/ingesta/salud', { headers: autorizacion })).json() as { nombre: string }[]
  const regionSalud = page.getByRole('region', { name: 'Salud de los colectores' })
  if (salud.length === 0) await expect(regionSalud).toContainText('todavía no corrió ningún ciclo de ingesta')
  else for (const colector of salud) await expect(regionSalud).toContainText(colector.nombre)
  const fallidos = await (await request.get('/api/veedor/ingesta/fallidos', { headers: autorizacion })).json() as unknown[]
  const regionFallidos = page.getByRole('region', { name: /Documentos fallidos/ })
  if (fallidos.length === 0) await expect(regionFallidos).toContainText('Ningún documento está fallando ahora')
  else await expect(regionFallidos).toContainText(`Documentos fallidos · ${fallidos.length}`)
})

test('debeResponder404AUnaDecisionSobreUnaPropuestaQueNoExiste', async ({ page, request }) => {
  test.setTimeout(240_000)
  await entrarAlPanel(page)
  const autorizacion = { Authorization: `Bearer ${await tokenDelPanel(page)}` }
  for (const accion of ['aprobar', 'descartar']) {
    const respuesta = await request.patch(`/api/veedor/ingesta/propuestas/no-existe-fe4/${accion}`, { headers: autorizacion })
    expect(respuesta.status()).toBe(404)
  }
  const anulacion = await request.patch('/api/veedor/ingesta/propuestas/no-existe-fe4/anulacion', { headers: autorizacion, data: { motivo: 'prueba' } })
  expect(anulacion.status()).toBe(404)
})
