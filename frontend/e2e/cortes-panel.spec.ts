import { expect, test, type Page } from '@playwright/test'
import { campoCartagena, PERMISOS_OBSERVADOR, simularGestion } from './panel-gestion'

const vencidos = (page: Page) => page.getByRole('region', { name: 'Vencidos' })

async function elegirBarrio(page: Page, nombre: string) {
  await page.getByRole('combobox', { name: 'Barrio de los cortes' }).fill(nombre)
  await page.getByRole('option', { name: nombre }).click()
}

test('debeTitularConLaColaDeVencidosYNoListarCortesSinElegirBarrio', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel/cortes')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 cortes esperan tu cierre')
  await expect(vencidos(page).getByRole('listitem')).toHaveCount(2)
  await expect(vencidos(page)).toContainText('La promesa venció')
  await expect(vencidos(page)).toContainText('falta tu confirmación')
  // El selector de barrio es obligatorio: sin barrio no se pide ninguna lista.
  await expect(page.getByText('Elige un barrio para ver sus cortes.')).toBeVisible()
  await elegirBarrio(page, 'Armenia')
  await expect(page.getByRole('heading', { name: 'Cortes de Armenia' })).toBeVisible()
  await expect(page.getByText('Aviso duplicado')).toBeVisible()
})

test('debeDecirQueNoHayVencidosYQueUnBarrioNoTieneCortes', async ({ page }) => {
  await simularGestion(page, { cortes: [] })
  await page.goto('/panel/cortes?sector=manga')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ningún corte espera tu cierre')
  await expect(page.getByText('No hay cortes vencidos.')).toBeVisible()
  await expect(page.getByText('No hay cortes registrados para este barrio.')).toBeVisible()
})

test('debeValidarLasFechasDelAltaYMandarlasEnUtcDesdeLaHoraDeCartagena', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/cortes')
  await page.getByRole('button', { name: /Registrar un corte/ }).click()
  await expect(page.getByLabel('Inicio (Hora de Cartagena)')).toBeVisible()
  await expect(page.getByLabel('Fin prometido (Hora de Cartagena)')).toBeVisible()

  await page.getByRole('button', { name: 'Registrar corte' }).click()
  await expect(page.getByText('Elige al menos un barrio.')).toBeVisible()
  await expect(page.getByText('Escribe cuándo empieza el corte.')).toBeVisible()
  await expect(page.getByText('Escribe hasta cuándo prometen el corte.')).toBeVisible()
  await expect(page.getByText('Escribe la causa que dio la fuente.')).toBeVisible()
  expect(visto.altas).toEqual([])

  await page.getByRole('combobox', { name: 'Barrios afectados' }).fill('Manga')
  await page.getByRole('option', { name: 'Manga' }).click()
  await expect(page.getByRole('list', { name: 'Barrios elegidos' })).toContainText('Manga')
  await page.getByLabel('Inicio (Hora de Cartagena)').fill('2030-12-01T08:00')
  await page.getByLabel('Fin prometido (Hora de Cartagena)').fill('2030-12-01T07:00')
  await page.getByLabel('Causa').fill('Mantenimiento de la línea')
  await page.getByRole('button', { name: 'Registrar corte' }).click()
  await expect(page.getByText('El fin prometido debe ser posterior al inicio.')).toBeVisible()
  expect(visto.altas).toEqual([])

  await page.getByLabel('Fin prometido (Hora de Cartagena)').fill('2030-12-01T16:30')
  await page.getByRole('button', { name: 'Registrar corte' }).click()
  // 8:00 a. m. en Cartagena son las 13:00 UTC.
  await expect(page.getByRole('heading', { name: 'Mantenimiento de la línea' })).toBeVisible()
  expect(visto.altas).toEqual([{ sectoresAfectados: ['manga'], inicio: '2030-12-01T13:00:00.000Z', finPrometido: '2030-12-01T21:30:00.000Z', causa: 'Mantenimiento de la línea' }])
  await expect(page).toHaveURL(/sector=manga&corte=k4|corte=k4&sector=manga/)
})

test('debeCerrarUnBarrioDeEnUnoYPasarElCorteARestablecidoAlCerrarElUltimo', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/cortes')
  await vencidos(page).getByRole('button', { name: /Abrir el corte de Armenia y Manga/ }).click()
  await expect(page.getByRole('heading', { name: 'Reparación de la línea de 24 pulgadas' })).toBeVisible()
  await expect(page.getByText('Confirmado', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar este barrio Armenia' }).click()
  // La hora real no puede estar en el futuro.
  await page.getByLabel('Hora real (Hora de Cartagena)').fill(campoCartagena(Date.now() + 5 * 3_600_000))
  await page.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(page.getByText('La hora real no puede estar en el futuro.')).toBeVisible()
  expect(visto.cierres).toEqual([])
  await page.getByLabel('Hora real (Hora de Cartagena)').fill(campoCartagena(Date.now() - 30 * 60_000))
  await page.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(page.getByText(/^Cerrado a las .* · Registrado por un revisor de AguaVigía\.$/)).toBeVisible()
  await expect(page.getByText('Confirmado', { exact: true })).toBeVisible()
  expect(visto.cierres.map((cierre) => cierre.ruta)).toEqual(['sectores/armenia/cierre'])

  await page.getByRole('button', { name: 'Cerrar este barrio Manga' }).click()
  await page.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(page.getByText('Restablecido', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Cerrar este barrio|Cerrar los)/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('1 corte espera tu cierre')
})

test('debeCerrarTodosLosBarriosPendientesDeUnaVez', async ({ page }) => {
  const { visto, cortes } = await simularGestion(page)
  await page.goto('/panel/cortes?sector=armenia&corte=k1')
  await page.getByRole('button', { name: 'Cerrar los 2 barrios pendientes' }).click()
  await page.getByRole('button', { name: 'Cerrar los 2 barrios', exact: true }).click()
  await expect(page.getByText('Restablecido', { exact: true })).toBeVisible()
  expect(visto.cierres.map((cierre) => cierre.ruta)).toEqual(['cierre'])
  expect(cortes.find((corte) => corte.id === 'k1')?.cierres).toHaveLength(2)
})

test('debeConfirmarElCierreProvisionalQuePusieronLosVecinos', async ({ page }) => {
  const { visto, cortes } = await simularGestion(page)
  await page.goto('/panel/cortes?sector=el-bosque&corte=k2')
  await expect(page.getByText(/Cierre provisional .*lo sostienen reportes de vecinos y falta tu confirmación/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar el cierre de El bosque' }).click()
  await expect(page.getByLabel('Hora real (Hora de Cartagena)')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar el cierre', exact: true }).click()
  await expect(page.getByText(/^Cerrado .* · Registrado por un revisor de AguaVigía\.$/)).toBeVisible()
  await expect(page.getByText('Restablecido', { exact: true })).toBeVisible()
  expect(visto.cierres.map((cierre) => cierre.ruta)).toEqual(['sectores/el-bosque/confirmacion'])
  expect(cortes.find((corte) => corte.id === 'k2')?.cierres[0]?.provisional).toBe(false)
})

test('debeAnularConMotivoYNoOfrecerMasAcciones', async ({ page }) => {
  const { visto } = await simularGestion(page)
  await page.goto('/panel/cortes?sector=armenia&corte=k1')
  await page.getByRole('button', { name: 'Anular el corte' }).click()
  await page.getByRole('button', { name: 'Sí, anular el corte' }).click()
  await expect(page.getByText('Escribe por qué se anula el corte.')).toBeVisible()
  expect(visto.cierres).toEqual([])
  await page.getByLabel('Motivo de la anulación').fill('Se publicó para otro barrio')
  await page.getByRole('button', { name: 'Sí, anular el corte' }).click()
  await expect(page.getByText('Anulado', { exact: true })).toBeVisible()
  await expect(page.getByText('Publicado por error: Se publicó para otro barrio')).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Anular el corte|Cerrar este barrio|Cerrar los)/ })).toHaveCount(0)
  expect(visto.cierres).toEqual([{ ruta: 'anulacion', cuerpo: { motivo: 'Se publicó para otro barrio' } }])
})

test('noDebeOfrecerAccionesSobreUnCorteYaAnulado', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel/cortes?sector=armenia&corte=k3')
  await expect(page.getByText('Publicado por error: Era el mismo aviso del día anterior')).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Anular el corte|Cerrar este barrio|Cerrar los|Confirmar el cierre)/ })).toHaveCount(0)
})

test('debeExplicarEnPantallaUnCierreQueYaEstabaHecho', async ({ page }) => {
  await simularGestion(page, { conflictos: ['cierre'] })
  await page.goto('/panel/cortes?sector=armenia&corte=k1')
  await page.getByRole('button', { name: 'Cerrar este barrio Armenia' }).click()
  await page.getByRole('button', { name: 'Cerrar el barrio' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Este barrio ya estaba cerrado' })).toBeVisible()
})

test('debeExplicarUnaAnulacionSobreUnCorteYaAnulado', async ({ page }) => {
  await simularGestion(page, { conflictos: ['anulacion'] })
  await page.goto('/panel/cortes?sector=armenia&corte=k1')
  await page.getByRole('button', { name: 'Anular el corte' }).click()
  await page.getByLabel('Motivo de la anulación').fill('Era de otro barrio')
  await page.getByRole('button', { name: 'Sí, anular el corte' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Este corte ya estaba anulado' })).toBeVisible()
})

test('noDebeOfrecerAccionesNiAltaAUnObservador', async ({ page }) => {
  await simularGestion(page, { permisos: PERMISOS_OBSERVADOR })
  await page.goto('/panel/cortes?sector=armenia&corte=k1')
  await expect(page.getByRole('heading', { name: 'Reparación de la línea de 24 pulgadas' })).toBeVisible()
  await expect(page.getByText(/no registrarlos, cerrarlos ni anularlos/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Registrar un corte|Anular el corte|Cerrar este barrio|Cerrar los|Confirmar el cierre)/ })).toHaveCount(0)
})

test('debeMostrarLasDisputasConSuFichaYSusCortes', async ({ page }) => {
  await simularGestion(page)
  await page.goto('/panel')
  await page.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name: 'Disputas' }).click()
  await expect(page).toHaveURL(/\/panel\/disputas$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 barrios en disputa')
  const bosque = page.getByRole('listitem').filter({ hasText: 'El bosque' })
  await expect(bosque).toContainText('5 reportes en contra')
  await expect(bosque).toContainText('12 de 12 vecinos')
  await expect(bosque.getByRole('link', { name: 'Ver la ficha de El bosque' })).toHaveAttribute('href', '/sectores/el-bosque')
  await bosque.getByRole('link', { name: 'Ver los cortes de El bosque' }).click()
  await expect(page).toHaveURL(/\/panel\/cortes\?sector=el-bosque$/)
  await expect(page.getByRole('heading', { name: 'Cortes de El bosque' })).toBeVisible()
})

test('debeDecirQueNoHayDisputas', async ({ page }) => {
  await simularGestion(page, { disputas: [] })
  await page.goto('/panel/disputas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No hay barrios en disputa')
})
