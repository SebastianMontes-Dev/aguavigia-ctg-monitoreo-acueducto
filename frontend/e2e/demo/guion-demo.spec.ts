import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { campoCartagena } from '../panel-gestion'
import { correoDe, puntoDentroDe, rutaEnCorreo } from '../real/ayudantes'
import { claveDelPanel, correoDelPanel, entrarAlPanel } from '../real/sesion-panel'

// FE7 · el guion de la demo (docs/frontend/guion-demo.md), paso por paso y solo por la interfaz:
//   ciudadano reporta con foto → el veedor modera → el consenso cambia el mapa en vivo → el corte se cierra → el Índice se mueve →
//   un suscriptor recibe el aviso y responde «ya volvió».
// Se corre sobre una base limpia: `npm run demo:guion` con PANEL_CORREO y PANEL_CLAVE del ADMIN inicial. Deja capturas y una línea de tiempo
// en test-results/demo/.

test.skip(!correoDelPanel || !claveDelPanel, 'Faltan PANEL_CORREO y PANEL_CLAVE: sin el ADMIN inicial no hay quien modere')

const CARPETA = join(process.cwd(), 'test-results', 'demo')
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')

interface Sector { id: string; nombre: string; poblacion: number | null; estado: string | null; enDisputa?: boolean }
const linea: { paso: string; segundos: number; nota?: string }[] = []
const inicio = Date.now()
const marcar = (paso: string, nota?: string) => linea.push({ paso, segundos: Math.round((Date.now() - inicio) / 100) / 10, ...(nota ? { nota } : {}) })

async function captura(page: Page, nombre: string) {
  mkdirSync(CARPETA, { recursive: true })
  await page.screenshot({ path: join(CARPETA, `${nombre}.png`), fullPage: false })
}

async function vecino(browser: Browser, punto: { latitud: number; longitud: number }): Promise<{ contexto: BrowserContext; page: Page }> {
  const contexto = await browser.newContext({
    baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CO',
    permissions: ['geolocation'], geolocation: { latitude: punto.latitud, longitude: punto.longitud, accuracy: 25 },
  })
  return { contexto, page: await contexto.newPage() }
}

/** El vecino abre la app, comparte su ubicación y reporta «No tengo agua» en el barrio donde está. */
async function reportarSinAgua(page: Page, barrio: Sector) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Cartagena ahora' })).toBeVisible()
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click()
  await expect(page).toHaveURL(new RegExp(`/sectores/${barrio.id}$`))
  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await expect(page.getByRole('dialog')).toContainText('con la ubicación que compartiste')
  const respuesta = page.waitForResponse((valor) => valor.url().endsWith('/api/reportes') && valor.request().method() === 'POST')
  await page.getByRole('button', { name: 'No tengo agua', exact: true }).click()
  expect((await respuesta).status()).toBe(201)
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
}

test('debeRecorrerLaDemoDePrincipioAFinSobreUnaBaseLimpia', async ({ browser, request }) => {
  const correo = `demo-${randomUUID()}@example.com`

  // 0 · Punto de partida: la API real, sin simulación, y un barrio pequeño (umbral de 3 vecinos) sin datos.
  const modo = await (await request.get('/api/sistema/modo')).json() as { modo: string }
  expect(modo.modo, 'la demo corre contra la instancia real').toBe('REAL')
  const { sectores } = await (await request.get('/api/sectores')).json() as { sectores: Sector[] }
  const barrio = sectores
    .filter((sector) => sector.poblacion !== null && sector.poblacion > 0 && sector.poblacion <= 3000 && sector.estado === null && !sector.enDisputa)
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  expect(barrio, 'no hay un barrio pequeño sin datos para mover').toBeDefined()
  const punto = await puntoDentroDe(request, barrio!.id)
  const nombre = new RegExp(barrio!.nombre, 'i')
  marcar('0 · base limpia', `${sectores.length} barrios; se usa ${barrio!.nombre} (${barrio!.poblacion} habitantes)`)

  // El Índice antes: en una base limpia todavía no hay cortes cerrados que medir.
  const publico = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 800 }, locale: 'es-CO' })
  const indice = await publico.newPage()
  await indice.goto('/cumplimiento')
  await expect(indice.getByRole('heading', { level: 1 })).toBeVisible()
  const textoAntes = (await indice.getByRole('main').innerText()).replace(/\s+/g, ' ')
  await captura(indice, '01-indice-antes')
  marcar('0 · el Índice antes', textoAntes.slice(0, 140))

  // 1 · Alguien que quiere enterarse se suscribe al barrio y confirma el correo.
  const suscriptor = await publico.newPage()
  await suscriptor.goto(`/avisos?sector=${barrio!.id}`)
  await suscriptor.getByRole('textbox', { name: 'Tu correo' }).fill(correo)
  await suscriptor.getByRole('button', { name: /Enviar enlace de confirmación/ }).click()
  await expect(suscriptor.getByRole('status')).toContainText('Si la dirección es válida')
  const confirmacion = await correoDe(request, correo, (cuerpo) => cuerpo.includes('/avisos/confirmar'))
  await suscriptor.goto(rutaEnCorreo(confirmacion, '/avisos/confirmar'))
  await suscriptor.getByRole('button', { name: 'Confirmar avisos' }).click()
  await expect(suscriptor.getByRole('status')).toContainText('Avisos confirmados')
  await captura(suscriptor, '02-suscriptor-confirmado')
  marcar('1 · suscriptor confirmado', correo)

  // 2 · Un vecino mira el mapa: el barrio no tiene datos. Esa pestaña se queda abierta para ver el cambio en vivo.
  const mapa = await publico.newPage()
  await mapa.goto(`/sectores/${barrio!.id}`)
  const ficha = mapa.getByRole('article', { name: nombre })
  await expect(ficha).toBeVisible()
  await expect(mapa.getByText('En vivo', { exact: true })).toBeVisible()
  await expect(ficha.getByText('Sin servicio', { exact: true })).toHaveCount(0)
  await mapa.evaluate(() => { (window as unknown as { sinRecargar: boolean }).sinRecargar = true })
  await captura(mapa, '03-mapa-antes')
  marcar('2 · el mapa abierto, sin servicio no aparece')

  // 3 · Primer vecino: reporta con ubicación y sube una foto.
  const uno = await vecino(browser, punto)
  await reportarSinAgua(uno.page, barrio!)
  const foto = uno.page.waitForResponse((valor) => /\/api\/reportes\/[^/]+\/foto$/.test(valor.url()) && valor.request().method() === 'POST')
  await uno.page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'goteo.png', mimeType: 'image/png', buffer: PNG_1X1 })
  expect((await foto).status()).toBe(200)
  await expect(uno.page.getByRole('dialog').getByText('Foto recibida. Un moderador la revisa antes de que se publique.')).toBeVisible()
  await captura(uno.page, '04-vecino-reporta-con-foto')
  marcar('3 · primer vecino reportó con foto', 'queda «en revisión»; un solo reporte no mueve el mapa')
  await expect(ficha.getByText('Sin servicio', { exact: true })).toHaveCount(0)

  // 4 · El veedor entra al panel (alta del segundo factor la primera vez), ve el reporte con su foto y lo aprueba.
  const veedor = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 800 }, locale: 'es-CO' })
  const panel = await veedor.newPage()
  await entrarAlPanel(panel)
  const cola = panel.getByRole('region', { name: 'Reportes pendientes' })
  await expect(cola).toBeVisible()
  const pendiente = cola.getByRole('listitem').filter({ hasText: nombre }).first()
  await expect(pendiente).toContainText('No tiene agua')
  await expect(pendiente).toContainText('Ubicación verificada dentro del barrio')
  await expect(pendiente.getByRole('img', { name: /Foto del reporte en/ })).toBeVisible()
  await captura(panel, '05-veedor-cola-con-foto')
  await pendiente.getByRole('button', { name: 'Aprobar' }).click()
  await panel.getByRole('button', { name: 'Sí, aprobar' }).click()
  await expect(panel.getByRole('button', { name: 'Sí, aprobar' })).toHaveCount(0)
  await captura(panel, '06-veedor-aprobo')
  marcar('4 · el veedor aprobó el reporte y su foto')

  // 5 · Dos vecinos más reportan: con tres identidades distintas y la ubicación verificada, el consenso cambia el mapa sin recargar.
  const dos = await vecino(browser, punto)
  await reportarSinAgua(dos.page, barrio!)
  const tres = await vecino(browser, punto)
  await reportarSinAgua(tres.page, barrio!)
  marcar('5 · tercer reporte enviado', 'se espera el cambio en vivo')
  const cambioEn = Date.now()
  await expect(ficha.getByText('Sin servicio', { exact: true })).toBeVisible({ timeout: 30_000 })
  expect(await mapa.evaluate(() => (window as unknown as { sinRecargar?: boolean }).sinRecargar), 'el mapa cambió sin recargar la página').toBe(true)
  await captura(mapa, '07-mapa-cambio-en-vivo')
  marcar('5 · el mapa pasó a «Sin servicio» en vivo', `${Math.round((Date.now() - cambioEn) / 100) / 10} s después del tercer reporte`)

  // 6 · El suscriptor recibe el aviso de que el barrio cambió, con su enlace de baja y el de «¿ya volvió el agua?».
  const aviso = await correoDe(request, correo, (cuerpo) => cuerpo.includes('/avisos/baja') && !cuerpo.includes('/avisos/confirmar'), 60)
  const enlaceRestablecimiento = rutaEnCorreo(aviso, '/restablecimiento')
  expect(enlaceRestablecimiento).toContain(`/sectores/${barrio!.id}/restablecimiento?token=`)
  marcar('6 · el suscriptor recibió el aviso en Mailhog')

  // 7 · El veedor registra el corte que explica el cambio y lo cierra con la hora real en que volvió el agua.
  await panel.goto('/panel/cortes')
  await panel.getByRole('button', { name: /Registrar un corte/ }).click()
  await panel.getByRole('combobox', { name: 'Barrios afectados' }).fill(barrio!.nombre.slice(0, 8))
  await panel.getByRole('option', { name: nombre }).first().click()
  const causa = `Demostración FE7 ${new Date().toISOString().slice(0, 16)}`
  await panel.getByLabel('Inicio (Hora de Cartagena)').fill(campoCartagena(Date.now() - 3 * 3_600_000))
  await panel.getByLabel('Fin prometido (Hora de Cartagena)').fill(campoCartagena(Date.now() - 2 * 60_000))
  await panel.getByLabel('Causa').fill(causa)
  await panel.getByRole('button', { name: 'Registrar corte' }).click()
  await expect(panel.getByRole('heading', { name: causa })).toBeVisible()
  await captura(panel, '08-veedor-corte-registrado')
  await panel.getByRole('button', { name: /Cerrar este barrio/ }).first().click()
  await panel.getByLabel('Hora real (Hora de Cartagena)').fill(campoCartagena(Date.now() - 60_000))
  await panel.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(panel.getByText('Restablecido', { exact: true })).toBeVisible()
  await captura(panel, '09-veedor-corte-cerrado')
  marcar('7 · el veedor registró y cerró el corte', causa)

  // 8 · El Índice se mueve: antes no había cortes cerrados que medir y ahora hay uno, con lo prometido y lo que duró.
  await indice.reload()
  await expect(indice.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(async () => {
    const despues = (await indice.getByRole('main').innerText()).replace(/\s+/g, ' ')
    expect(despues).not.toBe(textoAntes)
    expect(despues).toMatch(/\b1 corte cerrado\b|1 cortes? cerrados?/)
  }).toPass({ timeout: 30_000 })
  await captura(indice, '10-indice-despues')
  marcar('8 · el Índice cambió', (await indice.getByRole('main').innerText()).replace(/\s+/g, ' ').slice(0, 160))

  // 9 · El suscriptor abre el enlace del aviso y responde que ya volvió el agua; la respuesta cuenta, no cambia el mapa por sí sola.
  await suscriptor.goto(enlaceRestablecimiento)
  await expect(suscriptor.getByRole('heading', { level: 1, name: /¿Ya volvió el agua a/ })).toBeVisible()
  await captura(suscriptor, '11-suscriptor-pregunta')
  await suscriptor.getByRole('button', { name: /Sí, ya volvió el agua/ }).click()
  await expect(suscriptor.getByText('Gracias. Tu respuesta cuenta junto con la de tus vecinos.')).toBeVisible()
  await captura(suscriptor, '12-suscriptor-respondio')
  marcar('9 · el suscriptor respondió «ya volvió»')

  mkdirSync(CARPETA, { recursive: true })
  writeFileSync(join(CARPETA, 'linea-de-tiempo.json'), JSON.stringify(linea, null, 2))
  process.stdout.write(`\nLínea de tiempo de la demo (${barrio!.nombre}):\n${linea.map((paso) => `  ${String(paso.segundos).padStart(6)} s  ${paso.paso}${paso.nota ? ` — ${paso.nota}` : ''}`).join('\n')}\n`)
  for (const contexto of [publico, veedor, uno.contexto, dos.contexto, tres.contexto]) await contexto.close()
})
