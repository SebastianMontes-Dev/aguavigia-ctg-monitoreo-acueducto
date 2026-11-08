import { expect, test, type Page } from '@playwright/test'
import { PERMISOS_OBSERVADOR, simularGestion } from './panel-gestion'

const cola = (page: Page) => page.getByRole('region', { name: 'Reportes pendientes' })
const fila = (page: Page, barrio: string) => cola(page).getByRole('listitem').filter({ hasText: barrio })

test('debeDecirQueNoHayReportesConLaColaVacia', async ({ page }) => {
  await simularGestion(page, { reportes: [] })
  await page.goto('/panel')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No hay reportes por revisar')
  await expect(page.getByText('No hay reportes pendientes')).toBeVisible()
})

test('debeMostrarLaColaConSenalDeRedComoSenalYLaFotoPedidaConElToken', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 reportes por revisar')
  // Los más antiguos primero: el orden de la cola es el del servidor.
  await expect(cola(page).getByRole('listitem').first()).toContainText('Armenia')
  await expect(fila(page, 'Armenia')).toContainText('No tiene agua')
  await expect(fila(page, 'Armenia')).toContainText('Ubicación verificada dentro del barrio')
  await expect(fila(page, 'Manga')).toContainText('Sin verificar')
  // La señal de red es solo del reporte que la trae, y se dice como señal, no como acusación.
  await expect(page.getByText(/ráfaga de reportes a este barrio\. Míralo primero\./)).toHaveCount(1)
  await expect(fila(page, 'Armenia')).toContainText('Míralo primero')
  await expect(cola(page).getByText(/bloque|culpa|sospech|fraude|spam/i)).toHaveCount(0)
  // La foto sin aprobar no es pública: se pide con `Authorization`, no con un `<img src>` directo.
  const foto = fila(page, 'Armenia').getByRole('img', { name: 'Foto del reporte en Armenia' })
  await expect(foto).toBeVisible()
  await expect(foto).toHaveAttribute('src', /^data:image\/png;base64,/)
  expect(visto.fotos.find((pedida) => pedida.nombre === 'foto-r1.png')?.autorizacion).toBe('Bearer token-de-prueba')
  await expect(fila(page, 'Armenia')).toContainText('Foto en revisión')
})

test('debeAprobarConConfirmacionYQuitarElReporteDeLaCola', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel')
  await fila(page, 'Armenia').getByRole('button', { name: 'Aprobar' }).click()
  await expect(page.getByText(/su foto pasa a ser pública/)).toBeVisible()
  expect(visto.moderaciones).toEqual([])
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  await expect(fila(page, 'Armenia')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 reportes por revisar')
  expect(visto.moderaciones).toEqual([{ id: 'r1', accion: 'aprobar' }])
})

test('debeCancelarUnaConfirmacionSinEnviarNada', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel')
  await fila(page, 'Manga').getByRole('button', { name: 'Descartar', exact: true }).click()
  await expect(page.getByText(/sigue contando para el cupo del dispositivo/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText(/sigue contando para el cupo/)).toHaveCount(0)
  await expect(fila(page, 'Manga').getByRole('button', { name: 'Descartar', exact: true })).toBeFocused()
  expect(visto.moderaciones).toEqual([])
})

test('debeDescartarUnReporteYQuitarloDeLaCola', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel')
  await fila(page, 'Manga').getByRole('button', { name: 'Descartar', exact: true }).click()
  await page.getByRole('button', { name: 'Sí, descartar', exact: true }).click()
  await expect(fila(page, 'Manga')).toHaveCount(0)
  expect(visto.moderaciones).toEqual([{ id: 'r2', accion: 'descartar' }])
})

test('debeDescartarSoloLaFotoYDejarElReporteEnLaCola', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel')
  await expect(fila(page, 'El bosque').getByRole('img')).toBeVisible()
  await fila(page, 'El bosque').getByRole('button', { name: 'Descartar solo la foto' }).click()
  await expect(page.getByText('Se retira solo la foto. El reporte y su voto siguen como están.')).toBeVisible()
  await page.getByRole('button', { name: 'Sí, descartar la foto' }).click()
  await expect(fila(page, 'El bosque').getByText('Foto descartada', { exact: true }).first()).toBeVisible()
  await expect(fila(page, 'El bosque').getByRole('img')).toHaveCount(0)
  await expect(fila(page, 'El bosque').getByRole('button', { name: 'Descartar solo la foto' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 reportes por revisar')
  expect(visto.moderaciones).toEqual([{ id: 'r3', accion: 'foto' }])
})

test('noDebeEnviarDosVecesUnaAprobacionPulsadaConPrisa', async ({ page }) => {
  const { visto } = await simularGestion(page, { retardoMs: 500 })
  await page.goto('/panel')
  await fila(page, 'Manga').getByRole('button', { name: 'Aprobar' }).click()
  const confirmar = page.getByRole('button', { name: 'Sí, aprobar' })
  await confirmar.dblclick()
  await expect(page.getByRole('button', { name: 'Aprobando…' })).toBeDisabled()
  await expect(fila(page, 'Manga')).toHaveCount(0)
  expect(visto.moderaciones).toEqual([{ id: 'r2', accion: 'aprobar' }])
})

test('debeExplicarQueOtraPersonaYaDecidioElReporte', async ({ page }) => {
  await simularGestion(page, { conflictos: ['aprobar'] })
  await page.goto('/panel')
  await fila(page, 'Manga').getByRole('button', { name: 'Aprobar' }).click()
  await page.getByRole('button', { name: 'Sí, aprobar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'ya fue decidido por otra persona' })).toBeVisible()
})

test('noDebeMostrarBotonesDeAccionAUnObservador', async ({ page }) => {
  await simularGestion(page, { permisos: PERMISOS_OBSERVADOR })
  await page.goto('/panel')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('3 reportes por revisar')
  await expect(page.getByText(/no decidir sobre los reportes/)).toBeVisible()
  await expect(fila(page, 'Armenia')).toBeVisible()
  await expect(page.getByRole('button', { name: /Aprobar|Descartar/ })).toHaveCount(0)
})
