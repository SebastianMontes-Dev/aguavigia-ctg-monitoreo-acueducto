import { expect, test } from '@playwright/test'
import { nuevoDispositivo, puntoDentroDe } from './ayudantes'
import { claveDelPanel, correoDelPanel, entrarAlPanel, tokenDelPanel } from './sesion-panel'

// Cada ADMIN real necesita su alta de segundo factor, que `panel.spec.ts` y `sesion-panel.ts` comparten: sin PANEL_CORREO y PANEL_CLAVE
// no hay con quién entrar al panel y estas pruebas se omiten.
test.skip(!correoDelPanel || !claveDelPanel, 'Faltan PANEL_CORREO y PANEL_CLAVE: sin un ADMIN conocido no hay con quién entrar al panel')

// PNG de 1×1 píxel: el servidor verifica la firma binaria y reescala la imagen, así que no vale un texto cualquiera.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

/** El valor de un `datetime-local` en la hora de Cartagena (UTC-5). */
const campoCartagena = (ms: number) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16)

test('debeAprobarUnReporteConFotoYPasarSuFotoAPublica', async ({ page, request }) => {
  test.setTimeout(240_000)
  // La parte pública: un vecino reporta con su ubicación y sube la foto. Mientras nadie la apruebe, la foto no es pública.
  const dispositivo = await nuevoDispositivo(request)
  const creado = await request.post('/api/reportes', {
    headers: { 'X-Dispositivo': dispositivo },
    data: { tipo: 'SIN_AGUA', sectorId: 'zona-industrial', coordenada: await puntoDentroDe(request, 'zona-industrial'), precisionMetros: 20 },
  })
  expect(creado.status()).toBe(201)
  const { id, subidaToken } = await creado.json() as { id: string; subidaToken: string }
  const subida = await request.post(`/api/reportes/${id}/foto`, {
    headers: { 'X-Subida': subidaToken },
    multipart: { foto: { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1X1 } },
  })
  expect(subida.ok()).toBeTruthy()
  expect(((await subida.json()) as { fotoEstado: string }).fotoEstado).toBe('EN_REVISION')

  await entrarAlPanel(page)
  const token = await tokenDelPanel(page)
  const autorizacion = { Authorization: `Bearer ${token}` }

  // Dónde está en la cola, de los más antiguos a los más nuevos: la pantalla pide 20 por página.
  let posicion = -1
  let nombreFoto = ''
  for (let pagina = 0; posicion < 0 && pagina < 25; pagina++) {
    const respuesta = await request.get(`/api/veedor/reportes/pendientes?pagina=${pagina}&tamano=20`, { headers: autorizacion })
    expect(respuesta.ok()).toBeTruthy()
    const reportes = await respuesta.json() as { id: string; fotoUrl?: string }[]
    const dentro = reportes.findIndex((reporte) => reporte.id === id)
    if (dentro >= 0) {
      posicion = pagina * 20 + dentro
      nombreFoto = reportes[dentro]!.fotoUrl!.split('/').at(-1)!
    }
    if (reportes.length < 20) break
  }
  expect(posicion, 'el reporte nuevo debe estar en la cola de moderación').toBeGreaterThanOrEqual(0)
  expect((await request.get(`/api/fotos/${nombreFoto}`)).status()).toBe(404)

  const cola = page.getByRole('region', { name: 'Reportes pendientes' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('por revisar')
  for (let pagina = 1; pagina <= Math.floor(posicion / 20); pagina++) {
    await cola.getByRole('button', { name: 'Cargar más reportes' }).click()
    await expect(cola.getByRole('listitem').nth(pagina * 20)).toBeVisible()
  }
  const fila = cola.getByRole('listitem').nth(posicion)
  await expect(fila).toContainText('Zona Industrial')
  await expect(fila).toContainText('No tiene agua')
  await expect(fila).toContainText('Ubicación verificada dentro del barrio')
  await expect(fila.getByRole('img', { name: 'Foto del reporte en Zona Industrial' })).toBeVisible()

  await fila.getByRole('button', { name: 'Aprobar' }).click()
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  await expect(page.getByRole('button', { name: 'Sí, aprobar' })).toHaveCount(0)
  await expect(async () => {
    expect((await request.get(`/api/fotos/${nombreFoto}`)).status()).toBe(200)
  }).toPass({ timeout: 15_000 })
})

test('debeCrearUnCorteCerrarloBarrioPorBarrioYVerloEnLaFichaPublica', async ({ page }) => {
  test.setTimeout(240_000)
  const volvieron = async () => {
    await page.goto('/sectores/manga')
    await expect(page.getByRole('heading', { level: 1, name: 'Manga' })).toBeVisible()
    return page.getByText('Volvió', { exact: true }).count()
  }
  await entrarAlPanel(page)
  const antes = await volvieron()

  await page.goto('/panel/cortes')
  await page.getByRole('button', { name: /Registrar un corte/ }).click()
  for (const barrio of ['Manga', 'Bocagrande']) {
    await page.getByRole('combobox', { name: 'Barrios afectados' }).fill(barrio)
    await page.getByRole('option', { name: barrio, exact: true }).click()
  }
  const causa = `Prueba automática FE3 ${Date.now()}`
  await page.getByLabel('Inicio (Hora de Cartagena)').fill(campoCartagena(Date.now() - 60 * 60_000))
  await page.getByLabel('Fin prometido (Hora de Cartagena)').fill(campoCartagena(Date.now() + 2 * 3_600_000))
  await page.getByLabel('Causa').fill(causa)
  await page.getByRole('button', { name: 'Registrar corte' }).click()
  await expect(page.getByRole('heading', { name: causa })).toBeVisible()
  await expect(page.getByText('Anunciado', { exact: true })).toBeVisible()

  // Se cierra un barrio y el otro sigue pendiente: el corte no pasa a restablecido hasta cerrar el último.
  await page.getByRole('button', { name: 'Cerrar este barrio Manga' }).click()
  await page.getByLabel('Hora real (Hora de Cartagena)').fill(campoCartagena(Date.now() - 5 * 60_000))
  await page.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(page.getByText(/^Cerrado .* · Registrado por un revisor de AguaVigía\.$/)).toBeVisible()
  await expect(page.getByText('Sigue pendiente de cierre.')).toBeVisible()
  await expect(page.getByText('Restablecido', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Cerrar este barrio Bocagrande' }).click()
  await page.getByLabel('Hora real (Hora de Cartagena)').fill(campoCartagena(Date.now() - 60_000))
  await page.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(page.getByText('Restablecido', { exact: true })).toBeVisible()

  // Lo que el veedor cerró se ve en la ficha pública del barrio, con la hora real en que volvió el agua.
  expect(await volvieron()).toBe(antes + 1)
})
