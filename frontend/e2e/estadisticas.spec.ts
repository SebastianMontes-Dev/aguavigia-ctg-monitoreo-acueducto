import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { estadisticasDeEjemplo } from '../src/pruebas/datos/historia'
import { problema, simularApi } from './api-simulada'

function simularEstadisticas(page: Page, cuerpo: unknown) {
  return simularApi(page, { estadisticas: (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) }) })
}

test('debeTitularConLaDuracionPromedioYNombrarLosDiasExtremos', async ({ page }) => {
  await simularApi(page)
  await page.goto('/estadisticas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Un corte dura 5 horas y media en promedio')
  await expect(page.getByRole('main')).toHaveCount(1)
  const cifras = page.locator('dl')
  await expect(cifras.getByText('22', { exact: true })).toBeVisible()
  await expect(cifras.getByText('Miércoles', { exact: true })).toBeVisible()
  await expect(cifras.getByText('Domingo', { exact: true })).toBeVisible()
  const dias = page.getByRole('list', { name: 'Cortes de lunes a domingo' }).getByRole('listitem')
  await expect(dias).toHaveCount(7)
  await expect(dias.first()).toContainText('Lun')
  await expect(dias.last()).toContainText('Dom')
})

test('debeGuardarTablasYCsvDetrasDeVerDatos', async ({ page }) => {
  await simularApi(page)
  await page.goto('/estadisticas')
  const tablaDias = page.getByRole('table', { name: 'Cortes registrados de lunes a domingo' })
  await expect(tablaDias).toBeHidden()
  await page.getByText('Ver los datos y descargar el CSV').click()
  await expect(tablaDias.getByRole('rowheader')).toHaveText(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  const barrios = page.getByRole('table', { name: 'Barrios con más cortes' })
  await expect(barrios.getByRole('rowheader')).toHaveText(['Torices', 'Getsemani', 'Bocagrande'])
  await expect(page.getByRole('link', { name: 'Descargar en CSV' })).toHaveAttribute('href', '/api/estadisticas/exportar.csv')
})

test('debeUsarElNombreDeLaRespuestaYElIdComoRespaldo', async ({ page }) => {
  await simularEstadisticas(page, {
    sectoresMasAfectados: [
      { sectorId: 'armenia', nombre: 'ARMENIA', cantidadCortes: 3 },
      { sectorId: 'barrio-nuevo', nombre: 'Desconocido', cantidadCortes: 2 },
    ],
    cortesPorDiaDeSemana: { Lunes: 3, Martes: 2, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Domingo: 0 },
    duracionPromedioHoras: 2.5,
  })
  await page.goto('/estadisticas')
  const barrios = page.locator('section[aria-labelledby="titulo-barrios"] ol li')
  await expect(barrios).toHaveText([/^Armenia/, /^barrio-nuevo/])
})

test('debeDecirQueTodaviaNoHayCortesPorBarrio', async ({ page }) => {
  await simularEstadisticas(page, {
    sectoresMasAfectados: [],
    cortesPorDiaDeSemana: { Lunes: 1, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Domingo: 0 },
    duracionPromedioHoras: 2.5,
  })
  await page.goto('/estadisticas')
  await expect(page.getByText('Todavía no hay cortes registrados por barrio.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Un corte dura 2 horas y media en promedio')
})

test('noDebeNombrarElDiaConMasCortesConMenosDeCincoNiConfundirSinDatoConCero', async ({ page }) => {
  await simularEstadisticas(page, {
    sectoresMasAfectados: [{ sectorId: 'manga', nombre: 'MANGA', cantidadCortes: 1 }],
    cortesPorDiaDeSemana: { Lunes: 1, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0 },
    duracionPromedioHoras: 0,
  })
  await page.goto('/estadisticas')
  await expect(page.getByText(/Con 1 corte registrado todavía no se puede sacar una conclusión: hacen falta al menos 5\./)).toBeVisible()
  await expect(page.locator('dl').getByText('Lunes', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/el día con más cortes/)).toHaveCount(0)
  const dias = page.getByRole('list', { name: 'Cortes de lunes a domingo' }).getByRole('listitem')
  await expect(dias.nth(1)).toContainText('0')
  await expect(dias.last()).toContainText('Sin dato')
})

test('debeTitularLaPreguntaYExplicarLaAusenciaSinDatos', async ({ page }) => {
  await simularEstadisticas(page, {
    sectoresMasAfectados: [],
    cortesPorDiaDeSemana: { Lunes: 0, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0, Domingo: 0 },
    duracionPromedioHoras: 0,
  })
  await page.goto('/estadisticas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cuándo hay cortes en Cartagena')
  await expect(page.getByText('Todavía no hay datos registrados para resumir.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Cortes de lunes a domingo' })).toHaveCount(0)
})

test('debePermitirReintentarDespuesDeUnError', async ({ page }) => {
  let intentos = 0
  await simularApi(page, { estadisticas: (route) => {
    intentos++
    return intentos < 5
      ? route.fulfill(problema(503, 'fallo-temporal', 'Fallo temporal'))
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estadisticasDeEjemplo) })
  } })
  await page.goto('/estadisticas')
  await expect(page.getByRole('alert')).toContainText('No pudimos consultar las estadísticas', { timeout: 20_000 })
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Un corte dura 5 horas y media en promedio')
})

test('debeResponderEnLaPrimeraVistaConElGraficoDeDias', async ({ page }) => {
  const alto = (page.viewportSize()?.width ?? 0) < 600 ? 844 : 900
  await page.setViewportSize({ width: (page.viewportSize()?.width ?? 0) < 600 ? 390 : 1440, height: alto })
  await simularEstadisticas(page, {
    ...estadisticasDeEjemplo,
    sectoresMasAfectados: [
      ...estadisticasDeEjemplo.sectoresMasAfectados,
      { sectorId: 'manga', nombre: 'MANGA', cantidadCortes: 2 },
      { sectorId: 'armenia', nombre: 'ARMENIA', cantidadCortes: 1 },
      { sectorId: 'crespo', nombre: 'CRESPO', cantidadCortes: 1 },
    ],
  })
  await page.goto('/estadisticas')
  const grafico = page.getByRole('list', { name: 'Cortes de lunes a domingo' })
  await expect(grafico).toBeVisible()
  const caja = await grafico.boundingBox()
  expect(caja!.y + caja!.height).toBeLessThan(alto - 56)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= 2 * innerHeight)).toBe(true)
  const barrios = page.locator('section[aria-labelledby="titulo-barrios"] ol li')
  await expect(barrios).toHaveCount(5)
  await page.getByRole('button', { name: 'Ver los 6 barrios' }).click()
  await expect(barrios).toHaveCount(6)
})

test('debeAlternarLasCuatroGraficasYQueLaAyudaYLosDatosLaSigan', async ({ page }) => {
  await simularApi(page)
  await page.goto('/estadisticas')
  const selector = page.getByRole('group', { name: 'Elegir gráfica' })
  await expect(selector.getByRole('button')).toHaveText(['Por día', 'Duración', 'Cierres', 'Novedades'])
  await expect(selector.getByRole('button', { name: 'Por día' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Cortes por día de la semana' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Novedades por tipo' })).toBeHidden()

  await selector.getByRole('button', { name: 'Duración' }).click()
  await expect(page.getByRole('heading', { name: 'Duración promedio por mes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cortes por día de la semana' })).toBeHidden()
  await expect(page.getByRole('list', { name: 'Duración promedio de cada mes' }).getByRole('listitem').first()).toContainText('cierres')
  await page.locator('summary', { hasText: 'Cómo se mide' }).click()
  await expect(page.locator('details').getByText('Un cierre es un barrio restablecido', { exact: false })).toBeVisible()
  await page.getByText('Ver los datos y descargar el CSV').click()
  await expect(page.getByRole('table', { name: 'Duración promedio por mes' })).toBeVisible()

  await selector.getByRole('button', { name: 'Cierres' }).click()
  await expect(page.getByRole('heading', { name: 'Cierres por mes' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Cierres por mes' })).toBeVisible()

  await selector.getByRole('button', { name: 'Novedades' }).click()
  await expect(page.getByRole('heading', { name: 'Novedades por tipo' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Eventos de la bitácora por tipo' }).getByRole('listitem')).toHaveCount(4)
})

test('debeDejarLaTarjetaSoloConCifrasYLaNotaBajoElTitular', async ({ page }) => {
  await simularApi(page)
  await page.goto('/estadisticas')
  const nota = page.getByText('La duración promedio cuenta solo los cortes cerrados.')
  await expect(nota).toBeVisible()
  await expect(page.getByRole('region', { name: 'Resumen' }).getByText('La duración promedio')).toHaveCount(0)
})

test('debeDejarLosDosBloquesYSusPiesARas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await simularApi(page)
  await page.goto('/estadisticas')
  const selector = page.getByRole('group', { name: 'Elegir gráfica' })
  await expect(selector).toBeVisible()
  const enlace = page.getByRole('link', { name: /Ver el cumplimiento/ })
  for (const nombre of ['Por día', 'Duración', 'Cierres', 'Novedades']) {
    await selector.getByRole('button', { name: nombre }).click()
    const pieGraficas = await selector.boundingBox()
    const pieBarrios = await enlace.boundingBox()
    expect(pieGraficas!.y).toBeCloseTo(pieBarrios!.y, 0)
    expect(pieGraficas!.height).toBeCloseTo(pieBarrios!.height, 0)
  }
})

test('debeOrdenarLosBarriosEmpatadosAlfabeticamente', async ({ page }) => {
  await simularEstadisticas(page, {
    ...estadisticasDeEjemplo,
    sectoresMasAfectados: [
      { sectorId: 'manga', nombre: 'MANGA', cantidadCortes: 5 },
      { sectorId: 'torices', nombre: 'TORICES', cantidadCortes: 8 },
      { sectorId: 'armenia', nombre: 'ARMENIA', cantidadCortes: 5 },
    ],
  })
  await page.goto('/estadisticas')
  const barrios = page.locator('section[aria-labelledby="titulo-barrios"] ol li')
  await expect(barrios).toHaveText([/^Torices/, /^Armenia/, /^Manga/])
  await expect(page.getByText('Más en Torices: 8 cortes')).toBeVisible()
})

test('debeImprimirUnaHojaConLasCuatroGraficasEnClaroYVolverAlTemaDeAntes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await simularApi(page)
  await page.goto('/estadisticas')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('ol[aria-label="Eventos de la bitácora por tipo"]')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await page.emulateMedia({ media: 'print' })
  for (const nombre of ['Cortes por día de la semana', 'Duración promedio por mes', 'Cierres por mes', 'Novedades por tipo', 'Barrios con más cortes', 'Cómo se mide']) {
    await expect(page.getByRole('heading', { name: nombre })).toBeVisible()
  }
  await expect(page.getByText(/Generado el/)).toBeVisible()
  await expect(page.getByRole('group', { name: 'Elegir gráfica' })).toBeHidden()
  await expect(page.getByRole('link', { name: /Ver el cumplimiento/ })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Principal', exact: true })).toBeHidden()
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined()
})

test('debeDescargarElPdfDirectoSinAbrirLaImpresionDelNavegador', async ({ page }) => {
  await simularApi(page)
  await page.goto('/estadisticas')
  await page.evaluate(() => {
    Object.assign(window, { impresiones: 0 })
    window.print = () => { (window as unknown as { impresiones: number }).impresiones++ }
  })
  await page.getByText('Ver los datos y descargar el CSV').click()
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar en PDF' }).click(),
  ])
  expect(descarga.suggestedFilename()).toMatch(/^aguavigia-estadisticas-\d{4}-\d{2}-\d{2}\.pdf$/)
  const archivo = readFileSync(await descarga.path())
  expect(archivo.subarray(0, 5).toString()).toBe('%PDF-')
  expect(archivo.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1)
  expect(await page.evaluate(() => (window as unknown as { impresiones: number }).impresiones)).toBe(0)
  await expect(page.getByRole('button', { name: 'Descargar en PDF' })).toBeEnabled()
})
