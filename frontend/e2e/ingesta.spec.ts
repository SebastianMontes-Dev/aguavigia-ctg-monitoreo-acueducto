import { expect, test, type Page } from '@playwright/test'
import { CITA_MANGA, PERMISOS_OBSERVADOR, simularGestion } from './panel-gestion'

const propuestas = (page: Page) => page.getByRole('region', { name: 'Propuestas de la ingesta' })
const fila = (page: Page, barrio: string) => propuestas(page).getByRole('listitem').filter({ has: page.locator('strong', { hasText: barrio }) }).last()
const salud = (page: Page) => page.getByRole('region', { name: 'Salud de los colectores' })
const fallidos = (page: Page) => page.getByRole('region', { name: /Documentos fallidos/ })
const resueltas = (page: Page) => page.getByRole('heading', { name: 'Resueltas en esta visita' }).locator('..')

test('debeMostrarLaFraseDelBoletinElEnlaceYElMotivoJuntoALosBotones', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel/ingesta')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 propuestas esperan tu decisión')
  const manga = fila(page, 'Manga')
  await expect(manga).toContainText('propone «Sin servicio»')
  await expect(manga.locator('blockquote')).toHaveText(CITA_MANGA)
  await expect(manga.getByRole('link', { name: /Abrir el original en acuacar\.com\.co/ })).toHaveAttribute('href', 'https://www.acuacar.com.co/aviso-manga')
  await expect(manga).toContainText('Confianza 45%')
  await expect(manga).toContainText('Por qué espera revisión: Confianza baja')
  await expect(manga).toContainText('Declara que empieza')
  await expect(manga.getByRole('button', { name: 'Aprobar la propuesta de Manga' })).toBeEnabled()
  await expect(manga.getByRole('button', { name: 'Descartar la propuesta de Manga' })).toBeEnabled()
  // La de prensa dice que no declara ventana horaria; nada se estima.
  await expect(fila(page, 'Armenia')).toContainText('No declara una ventana horaria.')
})

test('debeDecirQueFaltanLaFraseYLaFuenteSinInventarlasYNoPermitirAprobar', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/ingesta')
  const bosque = fila(page, 'El Bosque')
  await expect(bosque).toContainText('no trae la frase del boletín que la respalda')
  await expect(bosque).toContainText('Sin enlace al original')
  await expect(bosque).toContainText('el servidor no indicó el motivo')
  await expect(bosque.locator('blockquote')).toHaveCount(0)
  await expect(bosque.getByRole('link')).toHaveCount(0)
  await expect(bosque.getByRole('button', { name: /Aprobar/ })).toHaveCount(0)
  await expect(bosque.getByRole('button', { name: /Descartar/ })).toBeVisible()
  expect(visto.decisiones).toEqual([])
})

test('debeAprobarConConfirmacionYDecirQueElMapaNoCambioSiLaPropuestaNoDeclaraVentana', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/ingesta')
  await fila(page, 'Armenia').getByRole('button', { name: 'Aprobar la propuesta de Armenia' }).click()
  await expect(page.getByText(/«Presión baja» se aplica a Armenia/)).toBeVisible()
  await expect(page.getByText(/no declara ventana horaria: el estado del barrio puede quedar como está/)).toBeVisible()
  expect(visto.decisiones).toEqual([])
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  const hecha = resueltas(page)
  await expect(hecha.getByText('Aprobada', { exact: true })).toBeVisible()
  // El servidor respondió 200 pero Armenia sigue «Sin servicio»: la pantalla lo dice en vez de dar el cambio por hecho.
  await expect(hecha).toContainText('Aprobar no siempre cambia el mapa: ahora Armenia muestra «Sin servicio», no «Presión baja»')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 propuestas esperan tu decisión')
  expect(visto.decisiones).toEqual([{ id: 'q2', accion: 'aprobar' }])
})

test('debeDecirQueElMapaYaMuestraElEstadoCuandoLaAprobacionLoCambio', async ({ page }) => {
  await simularGestion(page, { aprobarCambiaElMapa: true })
  await page.goto('/panel/ingesta')
  await fila(page, 'Manga').getByRole('button', { name: 'Aprobar la propuesta de Manga' }).click()
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  await expect(resueltas(page)).toContainText('El mapa ya muestra «Sin servicio» en Manga.')
})

test('debeDescartarYDejarLaResueltaSinBotonesActivos', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/ingesta')
  await fila(page, 'El Bosque').getByRole('button', { name: 'Descartar la propuesta de El Bosque' }).click()
  await expect(page.getByText('No toca El Bosque: la propuesta se archiva como descartada y no se borra.')).toBeVisible()
  await page.getByRole('button', { name: 'Sí, descartar' }).click()
  const hecha = resueltas(page)
  await expect(hecha.getByText('Descartada', { exact: true })).toBeVisible()
  await expect(hecha.getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 propuestas esperan tu decisión')
  expect(visto.decisiones).toEqual([{ id: 'q3', accion: 'descartar' }])
})

test('debeCancelarUnaConfirmacionSinEnviarNada', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/ingesta')
  await fila(page, 'Manga').getByRole('button', { name: 'Descartar la propuesta de Manga' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText(/No toca Manga/)).toHaveCount(0)
  await expect(fila(page, 'Manga').getByRole('button', { name: 'Descartar la propuesta de Manga' })).toBeFocused()
  expect(visto.decisiones).toEqual([])
})

test('debeAnularUnaAprobacionConMotivoYDejarlaAnulada', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/ingesta')
  await fila(page, 'Manga').getByRole('button', { name: 'Aprobar la propuesta de Manga' }).click()
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  await resueltas(page).getByRole('button', { name: 'Anular la aprobación' }).click()
  // Sin motivo no se envía nada: el error queda junto al campo.
  await page.getByRole('button', { name: 'Sí, anular la aprobación' }).click()
  await expect(page.getByText('Escribe por qué se anula la aprobación.')).toBeVisible()
  expect(visto.decisiones).toEqual([{ id: 'q1', accion: 'aprobar' }])
  await page.getByLabel('Motivo de la anulación').fill('El boletín hablaba de otro barrio')
  await page.getByRole('button', { name: 'Sí, anular la aprobación' }).click()
  await expect(resueltas(page).getByText('Anulada', { exact: true })).toBeVisible()
  await expect(resueltas(page).getByRole('button')).toHaveCount(0)
  expect(visto.decisiones.at(-1)).toEqual({ id: 'q1', accion: 'anulacion', motivo: 'El boletín hablaba de otro barrio' })
})

test('debeExplicarUn409CuandoOtraPersonaYaDecidioLaPropuesta', async ({ page }) => {
  await simularGestion(page, { conflictos: ['propuesta-aprobar'] })
  await page.goto('/panel/ingesta')
  await fila(page, 'Manga').getByRole('button', { name: 'Aprobar la propuesta de Manga' }).click()
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'la propuesta ya fue descartada' })).toBeVisible()
})

test('noDebeEnviarDosVecesUnaAprobacionPulsadaConPrisa', async ({ page }) => {
  const { visto } = await simularGestion(page, { retardoMs: 500 })
  await page.goto('/panel/ingesta')
  await fila(page, 'Manga').getByRole('button', { name: 'Aprobar la propuesta de Manga' }).click()
  await page.getByRole('button', { name: 'Sí, aprobar' }).dblclick()
  await expect(page.getByRole('button', { name: 'Aprobando…' })).toBeDisabled()
  await expect(resueltas(page).getByText('Aprobada', { exact: true })).toBeVisible()
  expect(visto.decisiones).toEqual([{ id: 'q1', accion: 'aprobar' }])
})

test('noDebeOfrecerBotonesAUnObservador', async ({ page }) => {
  await simularGestion(page, { permisos: PERMISOS_OBSERVADOR })
  await page.goto('/panel/ingesta')
  await expect(page.getByText(/no decidir sobre las propuestas/)).toBeVisible()
  await expect(propuestas(page).locator('blockquote')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Aprobar|Descartar|Anular/ })).toHaveCount(0)
  await expect(salud(page)).toBeVisible()
})

test('debeDecirQueNoHayPropuestasConLaColaVacia', async ({ page }) => {
  await simularGestion(page, { propuestas: [] })
  await page.goto('/panel/ingesta')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No hay propuestas por revisar')
  await expect(page.getByText('No hay propuestas pendientes')).toBeVisible()
})

test('debeMostrarLaSaludConUnColectorCaidoEnPalabrasYGlifo', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel/ingesta')
  const filas = salud(page).getByRole('listitem')
  await expect(filas).toHaveCount(3)
  // Los caídos primero, dichos con una palabra (el glifo es decorativo).
  await expect(filas.first()).toContainText('caracol-radio')
  await expect(filas.first()).toContainText('Caído')
  await expect(filas.first()).toContainText('Fallos seguidos4')
  await expect(filas.first()).toContainText('50%')
  await expect(filas.first()).toContainText('El feed devolvió 503')
  await expect(filas.first().locator('svg')).toHaveAttribute('aria-hidden', 'true')
  await expect(filas.nth(1)).toContainText('Con fallos')
  await expect(filas.nth(2)).toContainText('Activo')
  await expect(filas.nth(2)).toContainText('Último falloNunca')
  await expect(salud(page)).toContainText('memoria del servidor')
  await expect(page.getByText('1 colector caído · 2 documentos fallando')).toBeVisible()
})

test('debeDistinguirSaludVaciaDeSaludConFallo', async ({ page }) => {
  await simularGestion(page, { salud: [] })
  await page.goto('/panel/ingesta')
  await expect(salud(page)).toContainText('todavía no corrió ningún ciclo de ingesta')
  await page.unrouteAll()
  await simularGestion(page, { salud: 'error' })
  await page.goto('/panel/ingesta')
  // Un 500 se reintenta con espera antes de darse por fallo: la prueba espera ese tiempo.
  await expect(salud(page).getByRole('alert')).toContainText('No pudimos consultar la salud de los colectores', { timeout: 25_000 })
  await expect(salud(page)).not.toContainText('todavía no corrió')
})

test('debeMostrarLosDocumentosFallidosConSusMetadatos', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel/ingesta')
  const lista = fallidos(page).getByRole('listitem')
  await expect(lista).toHaveCount(2)
  await expect(lista.first()).toContainText('Boletín de suspensión del servicio')
  await expect(lista.first()).toContainText('acuacar · 12 reintentos')
  await expect(lista.first()).toContainText('Motivo: No se pudo leer el horario del boletín')
  await expect(lista.first()).toContainText('Primer intento')
  await expect(lista.first().getByRole('link', { name: /Abrir el original en acuacar\.com\.co/ })).toHaveAttribute('href', 'https://www.acuacar.com.co/boletin-roto')
  // Lo que el servidor no trae no se rellena.
  await expect(lista.nth(1)).toContainText('Documento sin título')
})

test('debeDistinguirFallidosVaciosDeUnFalloDeLaConsulta', async ({ page }) => {
  await simularGestion(page, { fallidos: [] })
  await page.goto('/panel/ingesta')
  await expect(fallidos(page)).toContainText('Ningún documento está fallando ahora')
  await page.unrouteAll()
  await simularGestion(page, { fallidos: 'error' })
  await page.goto('/panel/ingesta')
  await expect(fallidos(page).getByRole('alert')).toContainText('no sabemos si hay alguno', { timeout: 25_000 })
  await expect(fallidos(page)).not.toContainText('Ningún documento está fallando')
})
