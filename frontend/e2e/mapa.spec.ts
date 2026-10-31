import { expect, test } from '@playwright/test'
import { listado, problema, simularApi } from './api-simulada'

test('debeResponderElEstadoYElFinPrometidoDeUnBarrioBuscado', async ({ page }) => {
  await simularApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Cartagena ahora' })).toBeVisible()

  await page.getByRole('combobox', { name: 'Busca tu barrio' }).fill('arme')
  await page.getByRole('option', { name: /Armenia/ }).click()

  await expect(page).toHaveURL(/\/sectores\/armenia$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Armenia' })).toBeVisible()
  await expect(page.getByText('Sin servicio', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Fin prometido')).toBeVisible()
  await expect(page.getByText('Aviso oficial de Acuacar.')).toBeVisible()
})

test('debePresentarElEstadoNuloComoSinDatosYNuncaComoConServicio', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/manga')
  const ficha = page.getByRole('article', { name: 'Manga' })
  await expect(ficha.getByText('Sin datos verificados')).toBeVisible()
  await expect(ficha.getByText('Con servicio')).toHaveCount(0)
  await expect(ficha.getByText('Barrio · sin dato censal')).toBeVisible()
  await expect(ficha.getByText('Sin fecha de registro.')).toBeVisible()
})

test('debeDecirQuienSostieneElEstadoYQueLosVecinosLoDisputanSinCambiarlo', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/el-bosque')
  const estado = page.getByRole('region', { name: 'Estado actual' })
  await expect(estado.getByText('Reportado por 12 vecinos')).toBeVisible()
  await expect(estado.getByText('5 vecinos reportan algo distinto. Pendiente de revisión.')).toBeVisible()
  await expect(estado.getByText('Con servicio')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sobre el barrio' })).toHaveCount(0)
})

test('debeAdvertirSinVerificacionRecienteSinCambiarElEstado', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/el-bosque')
  const ficha = page.getByRole('article', { name: 'El Bosque' })
  await expect(ficha.getByText('Con servicio')).toBeVisible()
  await expect(ficha.getByText(/Sin verificación reciente/)).toBeVisible()
})

test('debeReportarEnDosToquesConLaIdentidadDelDispositivo', async ({ page }) => {
  const { reportes, dispositivos, identidades } = await simularApi(page)
  await page.goto('/sectores/armenia')

  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await page.getByRole('button', { name: 'No tengo agua' }).click()

  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
  await expect(dialogo.getByText(/cuenta junto con los de tus vecinos/)).toBeVisible()
  expect(reportes).toHaveLength(1)
  expect(reportes[0]).toMatchObject({ tipo: 'SIN_AGUA', sectorId: 'armenia' })
  expect(reportes[0]).not.toHaveProperty('huella')
  expect(dispositivos).toEqual(['dispositivo-1'])
  expect(identidades).toEqual(['dispositivo-1'])
})

test('debePedirElDispositivoUnaSolaVezAunqueSeReporteDosVeces', async ({ page }) => {
  const { dispositivos, identidades } = await simularApi(page)
  await page.goto('/sectores/armenia')

  for (const opcion of ['No tengo agua', 'Llega poca agua']) {
    await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
    await page.getByRole('button', { name: opcion }).click()
    await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
    await page.getByRole('button', { name: 'Volver a Armenia' }).click()
  }
  expect(dispositivos).toHaveLength(1)
  expect(identidades).toEqual(['dispositivo-1', 'dispositivo-1'])
})

test('debeAdjuntarLaFotoConElTokenDeSubidaYDecirQueQuedaEnRevision', async ({ page }) => {
  const { fotos } = await simularApi(page)
  await page.goto('/sectores/armenia')
  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await page.getByRole('button', { name: 'No tengo agua' }).click()
  await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()

  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByText(/JPEG o PNG de hasta 10 MB/)).toBeVisible()
  await expect(dialogo.getByText(/WebP/)).toHaveCount(0)
  expect(await dialogo.locator('input[type=file]').getAttribute('accept')).toBe('image/jpeg,image/png')

  await dialogo.locator('input[type=file]').setInputFiles({ name: 'goteo.png', mimeType: 'image/png', buffer: Buffer.from('png de prueba') })
  await expect(dialogo.getByText('Foto recibida. Un moderador la revisa antes de que se publique.')).toBeVisible()
  expect(fotos).toEqual([{ id: 'r1', subida: 'subida-r1', tipo: expect.stringContaining('multipart/form-data') }])
})

test('debeExplicarQueElServidorRechazaLaFotoPorSuFormato', async ({ page }) => {
  await simularApi(page)
  await page.route(/\/api\/reportes\/[^/]+\/foto$/, (route) => route.fulfill(problema(415, 'formato-no-permitido', 'WebP no se acepta')))
  await page.goto('/sectores/armenia')
  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await page.getByRole('button', { name: 'No tengo agua' }).click()
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'goteo.png', mimeType: 'image/png', buffer: Buffer.from('x') })
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Esa imagen no sirve; usa una foto JPEG o PNG')
})

test('debeDecirQueUnCorteExpiradoOAnuladoNoTieneHoraReal', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  const historial = page.getByRole('region', { name: /Cortes cerrados en Armenia/ })
  await expect(historial.getByText('Nadie confirmó el restablecimiento; no cuenta en el Índice.')).toBeVisible()
  await expect(historial.getByText('Publicado por error: Era el mismo aviso del día anterior')).toBeVisible()
  // Solo el RESTABLECIDO se compara con lo prometido.
  await expect(historial.getByText(/Prometieron/)).toHaveCount(1)
})

const AVISO = { id: 'a1', tipo: 'CORTE_DETECTADO_POR_INGESTA', sectorId: 'armenia', timestamp: '2026-09-25T16:00:00Z', fuente: 'ACUACAR', descripcion: 'Aviso' }

function bitacoraConAviso(urlOriginal: string) {
  return (route: import('@playwright/test').Route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([{ ...AVISO, urlOriginal }]),
    headers: { 'X-Total-Count': '1', 'X-Total-Pages': '1', 'X-Page': '0', 'X-Page-Size': '1' },
  })
}

test('debeLlevarALaBitacoraDelBarrioYDeAhiAbrirLaFuenteOriginal', async ({ page }) => {
  await simularApi(page, { bitacora: bitacoraConAviso('https://www.acuacar.com/boletin/ejemplo') })
  await page.goto('/sectores/armenia')
  // Armenia tiene un corte abierto; el último aviso va en su propia fila, fuera de la tarjeta del corte.
  await expect(page.getByRole('region', { name: 'Último aviso' }).getByText('Aviso de Acuacar', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ver todos los avisos de Armenia en la bitácora' }).click()

  await expect(page).toHaveURL(/\/bitacora\?.*sector=armenia/)
  await expect(page).toHaveURL(/tipo=CORTE_DETECTADO_POR_INGESTA/)
  const fuente = page.getByRole('link', { name: 'Boletín de Acuacar' })
  await expect(fuente).toHaveAttribute('href', 'https://www.acuacar.com/boletin/ejemplo')
  await expect(fuente).toHaveAttribute('target', '_blank')
  await expect(fuente).toHaveAttribute('rel', /noopener/)
})

test('noDebeEnlazarUnaFuenteQueNoEsHttpEnLaBitacora', async ({ page }) => {
  await simularApi(page, { bitacora: bitacoraConAviso('javascript:alert(1)') })
  await page.goto('/bitacora?sector=armenia&tipo=CORTE_DETECTADO_POR_INGESTA')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Boletín de Acuacar' })).toHaveCount(0)
})

test('noDebeOfrecerElBotonDeAvisosSiElBarrioNoTieneNinguno', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  await expect(page.getByRole('heading', { level: 1, name: 'Armenia' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver todos/ })).toHaveCount(0)
})

test('debeDarUnaSolaLineaDeFrescuraSinRepetirVerificadoNiElListadoDeLaCiudad', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  await expect(page.getByRole('region', { name: 'Estado actual' }).getByText(/Actualizado hace \d+ min/)).toBeVisible()
  await expect(page.getByText(/Listado generado/)).toHaveCount(0)
  await expect(page.getByText(/verificado hace/i)).toHaveCount(0)
  await expect(page.getByText(/Estado registrado/)).toHaveCount(0)
})

test('debeContarUnCorteCerradoConFechasYHorasYSinLaPalabraVeedor', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  const historial = page.getByRole('region', { name: /Cortes cerrados en Armenia/ })
  // La frase de introducción repetía el título del bloque: no se muestra.
  await expect(historial.getByText(/corte por corte/)).toHaveCount(0)
  // El fixture promete 2 h y el veedor cerró 6 h después de lo prometido.
  await expect(historial.getByText('Tardó 6 horas más de lo prometido')).toBeVisible()
  // Las horas van primero y la diferencia en palabras, debajo y más pequeña.
  const orden = await historial.locator('dl, p').evaluateAll((nodos) => nodos.map((nodo) => nodo.tagName + ':' + (nodo.textContent ?? '').slice(0, 12)))
  expect(orden.findIndex((texto) => texto.startsWith('DL'))).toBeLessThan(orden.findIndex((texto) => texto.includes('Tardó')))
  // Fecha real («vie 17 oct»), no solo «mañana» o «ayer».
  await expect(historial.locator('dl')).toContainText(/(lun|mar|mié|jue|vie|sáb|dom) \d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/)
  await expect(historial.getByText('Prometieron')).toBeVisible()
  // Cada hora va grande y con su día debajo: se comparan lado a lado, sin restar.
  await expect(historial.locator('dl time')).toHaveCount(2)
  await expect(historial.getByText('Volvió', { exact: true })).toBeVisible()
  // La causa es texto del boletín tal cual salió de la fuente: no se muestra.
  await expect(historial.getByText(/Causa|Mantenimiento/)).toHaveCount(0)
  await expect(page.getByText(/veedor/i)).toHaveCount(0)
})

test('debeExplicarElCupoAgotadoSinReintentarSolo', async ({ page }) => {
  const { reportes } = await simularApi(page, {
    reporte: (route) => route.fulfill(problema(429, 'limite-reportes-excedido', 'Límite de reportes')),
  })
  await page.goto('/sectores/armenia')
  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await page.getByRole('button', { name: 'Llega poca agua' }).click()

  await expect(page.getByRole('alert')).toContainText('Ya enviaste tres reportes de este barrio')
  await page.waitForTimeout(1500)
  expect(reportes).toHaveLength(1)
})

test('debeAvisarSinCifrasCuandoNoSePuedeConsultarElEstado', async ({ page }) => {
  await simularApi(page, {
    sectores: (route) => route.fulfill(problema(503, 'base-de-datos-no-disponible', 'Base de datos no disponible')),
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('No pudimos consultar el estado')
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(page.getByText('Con servicio')).toHaveCount(0)
})

test('debeDejarRecibirAvisosEnLaEsquinaDeLaFicha', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  const enlace = page.getByRole('link', { name: 'Recibir avisos de Armenia' })
  await expect(enlace).toBeVisible()
  await expect(enlace).toHaveText('Recibir avisos')
  await enlace.click()
  await expect(page).toHaveURL(/\/avisos\?.*sector=armenia/)
})

test('debeOfrecerLaListaDeBarriosComoAlternativaAlMapa', async ({ page }) => {
  await simularApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Ver la lista de los 3 barrios con su estado' }).click()
  const lista = page.getByRole('region', { name: 'Todos los barrios' })
  await expect(lista.getByRole('link')).toHaveCount(3)
  await lista.getByRole('link', { name: /Manga/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Manga' })).toBeVisible()
})

test('noDebeDesbordarLaPaginaHaciaLosLados', async ({ page }) => {
  await simularApi(page)
  await page.goto('/sectores/armenia')
  await expect(page.getByRole('heading', { level: 1, name: 'Armenia' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('debeExplicarEnLaLeyendaLaMarcaDeLosBarriosEnDisputaSoloSiHayAlguno', async ({ page }) => {
  await simularApi(page)
  await page.goto('/')
  const leyenda = page.getByRole('list', { name: 'Leyenda del mapa' })
  await expect(leyenda.getByText('En disputa o por confirmar')).toBeVisible()

  await simularApi(page, {
    sectores: (route) => {
      const datos = listado()
      for (const sector of datos.sectores) Object.assign(sector, { enDisputa: false, reportesEnContra: 0 })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) })
    },
  })
  await page.reload()
  await expect(leyenda.getByText('Con servicio')).toBeVisible()
  await expect(leyenda.getByText('En disputa o por confirmar')).toHaveCount(0)
})

test('debeDarElIndiceDeTodoElCorteSoloAlAbrirloYDecirCuandoAunNoSePuedeMedir', async ({ page }) => {
  const pedidos: string[] = []
  await simularApi(page, {
    indiceCorte: (route) => {
      const id = new URL(route.request().url()).pathname.split('/').at(-1) ?? ''
      pedidos.push(id)
      return id === 'c-varios'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ duracionPrometidaSegundos: 14_400, duracionRealSegundos: 18_000, desviacionSegundos: 3600, porcentajeCumplimiento: 80, porcentajeProvisional: 0, cortesSinCierreConfirmado: 0, cortesAnulados: 0 }) })
        : route.fulfill(problema(409, 'conflicto-de-estado', 'El corte todavía no está cerrado'))
    },
  })
  const hace = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString()
  await page.route(/\/api\/sectores\/armenia\/cortes/, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'X-Total-Count': '2', 'X-Total-Pages': '1', 'X-Page': '0', 'X-Page-Size': '10' },
    body: JSON.stringify([
      { id: 'c-varios', sectoresAfectados: ['armenia', 'manga'], inicio: hace(30), finPrometido: hace(26), origen: 'OFICIAL_ACUACAR', estado: 'RESTABLECIDO',
        cierres: [{ sectorId: 'armenia', hora: hace(25), fuente: 'ACUACAR', provisional: false }, { sectorId: 'manga', hora: hace(24), fuente: 'ACUACAR', provisional: false }] },
      { id: 'c-pendiente', sectoresAfectados: ['armenia', 'el-bosque', 'manga'], inicio: hace(60), finPrometido: hace(56), origen: 'OFICIAL_ACUACAR', estado: 'CONFIRMADO',
        cierres: [{ sectorId: 'armenia', hora: hace(55), fuente: 'VEEDOR', provisional: false }] },
    ]),
  }))
  await page.goto('/sectores/armenia')
  const historial = page.getByRole('region', { name: 'Cortes cerrados en Armenia' })
  await expect(historial.getByText('Todo el corte (2 barrios)')).toBeVisible()
  expect(pedidos).toHaveLength(0)

  await historial.getByText('Todo el corte (2 barrios)').click()
  await expect(historial.getByText(/Índice 80/)).toBeVisible()
  await historial.getByText('Todo el corte (3 barrios)').click()
  await expect(historial.getByText('Todavía no se puede medir: falta el cierre de algún barrio.')).toBeVisible()
  expect(pedidos).toEqual(['c-varios', 'c-pendiente'])
})
