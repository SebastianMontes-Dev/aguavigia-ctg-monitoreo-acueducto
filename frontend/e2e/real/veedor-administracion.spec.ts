import { expect, test } from '@playwright/test'
import { claveDelPanel, correoDelPanel, entrarAlPanel, tokenDelPanel } from './sesion-panel'

// Sin PANEL_CORREO y PANEL_CLAVE no hay con quién entrar al panel (ver `sesion-panel.ts`): estas pruebas se omiten.
test.skip(!correoDelPanel || !claveDelPanel, 'Faltan PANEL_CORREO y PANEL_CLAVE: sin un ADMIN conocido no hay con quién entrar al panel')

interface Cuenta { id: string; correo: string; sintetica?: boolean }

// Solo lee: no invita, aprueba ni suspende a nadie, porque las cuentas del backend real son compartidas por las demás pruebas.
test('debeMostrarLasCuentasSinContarLasSinteticasYPaginarPorCabeceras', async ({ page, request }) => {
  test.setTimeout(240_000)
  await entrarAlPanel(page)
  const autorizacion = { Authorization: `Bearer ${await tokenDelPanel(page)}` }

  const respuesta = await request.get('/api/veedor/usuarios?pagina=0&tamano=50', { headers: autorizacion })
  expect(respuesta.ok()).toBeTruthy()
  const cabeceras = respuesta.headers()
  const paginas = Number(cabeceras['x-total-pages'] ?? 1)
  const delServidor = await respuesta.json() as Cuenta[]

  await page.goto('/panel/cuentas')
  await expect(page.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name: 'Cuentas' })).toBeVisible()
  const bloque = page.getByRole('region', { name: 'Cuentas del panel y de los vecinos' })
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Consultando/)
  await expect(bloque.getByRole('button', { name: 'Invitar a una persona' })).toBeVisible()

  // Por defecto no se ve ninguna sintética: su correo es de un dominio reservado (`.invalid`) y no son personas.
  await expect(bloque.locator('tbody tr').first().or(bloque.getByText(/Ninguna cuenta coincide|Todavía no hay cuentas|Las últimas cuentas de la lista son sintéticas/))).toBeVisible({ timeout: 60_000 })
  await expect(bloque.getByText(/@sintetico\.invalid|\.invalid\b/)).toHaveCount(0)

  // Con el interruptor encendido la paginación sale de las cabeceras que mandó el servidor.
  const hayDelServidorSinteticas = delServidor.some((cuenta) => cuenta.sintetica === true)
  await bloque.getByRole('checkbox', { name: /Mostrar cuentas sintéticas/ }).check()
  await expect(bloque).toContainText(`Página 1 de ${paginas}`)
  if (hayDelServidorSinteticas) await expect(bloque.getByText(/\.invalid/).first()).toBeVisible()
  if (paginas > 1) await expect(bloque.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})

test('debeLeerLaAuditoriaDelBackendRealSinOfrecerEditarNiBorrar', async ({ page, request }) => {
  test.setTimeout(240_000)
  await entrarAlPanel(page)
  const autorizacion = { Authorization: `Bearer ${await tokenDelPanel(page)}` }
  const respuesta = await request.get('/api/veedor/auditoria?pagina=0&tamano=50', { headers: autorizacion })
  expect(respuesta.ok()).toBeTruthy()
  const eventos = await respuesta.json() as { accion: string }[]

  await page.goto('/panel/auditoria')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Consultando/)
  if (eventos.length === 0) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todavía no hay acciones registradas')
  } else {
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(eventos.length)
  }
  await expect(page.getByRole('button', { name: /Editar|Borrar|Eliminar/ })).toHaveCount(0)
})

test('debeMostrarLasMetricasYLaCopiaAnaliticaOSuAvisoDeQueEstaApagada', async ({ page, request }) => {
  test.setTimeout(240_000)
  await entrarAlPanel(page)
  const autorizacion = { Authorization: `Bearer ${await tokenDelPanel(page)}` }
  const metricas = await request.get('/api/veedor/sistema/metricas', { headers: autorizacion })
  expect(metricas.ok()).toBeTruthy()
  const copias = await request.get('/api/veedor/analitica/copia?limite=5', { headers: autorizacion })
  // 503 es un resultado válido (ADR-100): la copia está apagada o aún no hubo una primera.
  expect([200, 503]).toContain(copias.status())

  await page.goto('/panel/sistema')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Contadores de este proceso')
  const bloqueCopia = page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' })
  if (copias.status() === 503) {
    await expect(bloqueCopia).toContainText('el sistema funciona igual')
  } else {
    const filas = await copias.json() as unknown[]
    if (filas.length === 0) await expect(bloqueCopia).toContainText('Todavía no hubo ninguna copia')
    else await expect(bloqueCopia.getByRole('table')).toBeVisible()
  }
})
