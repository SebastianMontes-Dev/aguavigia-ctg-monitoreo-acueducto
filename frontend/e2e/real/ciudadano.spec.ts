import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// PNG de 1×1 píxel: el servidor verifica la firma binaria y reescala la imagen, así que no vale un texto cualquiera.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

/** Cada llamada crea una identidad distinta: así se simulan vecinos distintos (docs/api/reportes.md). */
async function nuevoDispositivo(request: APIRequestContext): Promise<string> {
  const respuesta = await request.post('/api/dispositivos')
  expect(respuesta.status()).toBe(201)
  return ((await respuesta.json()) as { token: string }).token
}

type Anillo = number[][]

function dentro(anillo: Anillo, x: number, y: number): boolean {
  let adentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi = 0, yi = 0] = anillo[i] ?? []
    const [xj = 0, yj = 0] = anillo[j] ?? []
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro
  }
  return adentro
}

/** Un punto dentro del barrio, de la geometría real: con él el servidor puede marcar el reporte UBICACION_VERIFICADA. */
async function puntoDentroDe(request: APIRequestContext, sectorId: string): Promise<{ latitud: number; longitud: number }> {
  const geometria = await (await request.get('/api/sectores/geometria')).json() as {
    features: { id: string; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[]
  }
  const barrio = geometria.features.find((feature) => String(feature.id) === sectorId)
  expect(barrio, `el barrio ${sectorId} no está en la geometría`).toBeDefined()
  const poligonos = (barrio!.geometry.type === 'Polygon' ? [barrio!.geometry.coordinates] : barrio!.geometry.coordinates) as number[][][][]
  const exterior = poligonos[0]![0]!
  const xs = exterior.map(([x = 0]) => x)
  const ys = exterior.map(([, y = 0]) => y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  for (let i = 1; i < 40; i++) {
    for (let j = 1; j < 40; j++) {
      const x = minX + ((maxX - minX) * i) / 40
      const y = minY + ((maxY - minY) * j) / 40
      if (dentro(exterior, x, y)) return { latitud: y, longitud: x }
    }
  }
  throw new Error(`no se encontró un punto dentro de ${sectorId}`)
}

async function abrirReporte(page: Page, opcion: string) {
  await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: opcion, exact: true }).click()
}

test('debeAbrirElMapaConLos211BarriosYElCanalEnVivoSinRecursosExternos', async ({ page }) => {
  const externos: string[] = []
  page.on('request', (peticion) => {
    if (peticion.url().startsWith('http') && new URL(peticion.url()).origin !== 'http://localhost:4173') {
      externos.push(peticion.url())
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Cartagena ahora' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver la lista de los 211 barrios con su estado' }).click()
  const lista = page.getByRole('region', { name: 'Todos los barrios' })
  await expect(lista.getByRole('link')).toHaveCount(211)
  await expect(page.getByText('En vivo', { exact: true })).toBeVisible()

  await page.getByRole('combobox', { name: 'Busca tu barrio' }).fill('zona industrial')
  await page.getByRole('option', { name: /Zona Industrial/i }).click()
  await expect(page).toHaveURL(/\/sectores\/zona-industrial$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Zona Industrial' })).toBeVisible()
  expect(externos).toEqual([])
})

test('debeReportarEnDosToquesYRecibirUn201', async ({ page }) => {
  await page.goto('/sectores/zona-industrial')
  await expect(page.getByRole('heading', { level: 1, name: 'Zona Industrial' })).toBeVisible()

  const respuesta = page.waitForResponse((valor) => valor.url().endsWith('/api/reportes') && valor.request().method() === 'POST')
  await abrirReporte(page, 'No tengo agua')

  expect((await respuesta).status()).toBe(201)
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Tu reporte cuenta junto con los de tus vecinos')
})

test('debeMostrarElMensajeDel429EnElCuartoReporteDelMismoDispositivo', async ({ page }) => {
  const dispositivos: (string | null)[] = []
  let tokensPedidos = 0
  page.on('request', (peticion) => {
    const ruta = new URL(peticion.url()).pathname
    if (peticion.method() !== 'POST') return
    if (ruta === '/api/dispositivos') tokensPedidos++
    if (ruta === '/api/reportes') dispositivos.push(peticion.headers()['x-dispositivo'] ?? null)
  })
  await page.goto('/sectores/alameda-la-victoria')
  await expect(page.getByRole('heading', { level: 1, name: 'Alameda la Victoria' })).toBeVisible()

  for (let intento = 0; intento < 4; intento++) {
    const respuesta = page.waitForResponse((valor) => valor.url().endsWith('/api/reportes') && valor.request().method() === 'POST')
    await abrirReporte(page, 'Llega poca agua')
    expect((await respuesta).status()).toBe(intento < 3 ? 201 : 429)

    if (intento < 3) {
      await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
      await page.getByRole('button', { name: 'Volver a Alameda la Victoria' }).click()
    } else {
      await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Ya enviaste tres reportes de este barrio')
    }
  }
  // El token se pide una sola vez y es el mismo en los cuatro reportes: el cupo es por dispositivo.
  expect(tokensPedidos).toBe(1)
  expect(dispositivos).toHaveLength(4)
  expect(dispositivos[0]).toBeTruthy()
  expect(new Set(dispositivos).size).toBe(1)
})

test('debeActualizarElEstadoPorConsensoSSESinRecargarLaPagina', async ({ page, request }) => {
  await page.goto('/sectores/arroyo-grande')
  const ficha = page.getByRole('article', { name: 'Arroyo Grande' })
  await expect(ficha).toBeVisible()
  await expect(page.getByText('En vivo', { exact: true })).toBeVisible()

  const yaSinServicio = await ficha.getByText('Sin servicio', { exact: true }).isVisible()
  const tipo = yaSinServicio ? 'SERVICIO_RESTABLECIDO' : 'SIN_AGUA'
  const estadoEsperado = yaSinServicio ? 'Con servicio' : 'Sin servicio'

  // Tres dispositivos distintos, cada uno con la ubicación dentro del barrio: así el sustento queda verificado.
  const coordenada = await puntoDentroDe(request, 'arroyo-grande')
  for (let vecino = 0; vecino < 3; vecino++) {
    const respuesta = await request.post('/api/reportes', {
      headers: { 'X-Dispositivo': await nuevoDispositivo(request) },
      data: { sectorId: 'arroyo-grande', tipo, coordenada, precisionMetros: 25 },
    })
    expect(respuesta.status()).toBe(201)
    expect(((await respuesta.json()) as { verificacion: string }).verificacion).toBe('UBICACION_VERIFICADA')
  }

  await expect(ficha.getByText(estadoEsperado, { exact: true })).toBeVisible({ timeout: 30_000 })
})

test('debeConfirmarSoloAlTocarUnaVezEInformarSiElReporteNoExiste', async ({ page, request }) => {
  const creado = await request.post('/api/reportes', {
    headers: { 'X-Dispositivo': await nuevoDispositivo(request) },
    data: { sectorId: 'manga', tipo: 'PRESION_BAJA' },
  })
  expect(creado.status()).toBe(201)
  const reporte = await creado.json() as { id: string }
  let confirmaciones = 0
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === `/api/reportes/${reporte.id}/confirmar`) {
      confirmaciones++
    }
  })

  await page.goto(`/confirmar/${reporte.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Confirmar reporte' })).toBeVisible()
  await page.waitForTimeout(500)
  expect(confirmaciones).toBe(0)

  const respuesta = page.waitForResponse((valor) => valor.url().endsWith(`/api/reportes/${reporte.id}/confirmar`))
  await page.getByRole('button', { name: 'Confirmar este reporte' }).click()
  expect((await respuesta).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Confirmación recibida' })).toBeVisible()
  expect(confirmaciones).toBe(1)

  await page.goto('/confirmar/no-existe')
  const inexistente = page.waitForResponse((valor) => valor.url().endsWith('/api/reportes/no-existe/confirmar'))
  await page.getByRole('button', { name: 'Confirmar este reporte' }).click()
  expect((await inexistente).status()).toBe(404)
  await expect(page.getByRole('alert')).toContainText('Este reporte no está disponible')
})

test('debeSubirLaFotoDeUnReporteYDecirQueQuedaEnRevision', async ({ page }) => {
  await page.goto('/sectores/zona-industrial')
  await expect(page.getByRole('heading', { level: 1, name: 'Zona Industrial' })).toBeVisible()
  await abrirReporte(page, 'No tengo agua')
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()

  const foto = page.waitForResponse((valor) => /\/api\/reportes\/[^/]+\/foto$/.test(valor.url()) && valor.request().method() === 'POST')
  await dialogo.locator('input[type=file]').setInputFiles({ name: 'goteo.png', mimeType: 'image/png', buffer: PNG_1X1 })

  const respuesta = await foto
  expect(respuesta.status()).toBe(200)
  expect(respuesta.request().headers()['x-subida']).toBeTruthy()
  expect(((await respuesta.json()) as { fotoEstado: string }).fotoEstado).toBe('EN_REVISION')
  await expect(dialogo.getByText('Foto recibida. Un moderador la revisa antes de que se publique.')).toBeVisible()
})

test('debeRechazarUnaFotoWebPSinGastarElPermisoDeSubida', async ({ request }) => {
  const dispositivo = await nuevoDispositivo(request)
  const creado = await request.post('/api/reportes', {
    headers: { 'X-Dispositivo': dispositivo },
    data: { sectorId: 'manga', tipo: 'SIN_AGUA' },
  })
  expect(creado.status()).toBe(201)
  const { id, subidaToken } = await creado.json() as { id: string; subidaToken: string }

  const webp = await request.post(`/api/reportes/${id}/foto`, {
    headers: { 'X-Subida': subidaToken },
    multipart: { foto: { name: 'foto.webp', mimeType: 'image/webp', buffer: Buffer.from('RIFF0000WEBPVP8 ') } },
  })
  expect(webp.status()).toBe(415)
  expect(((await webp.json()) as { type: string }).type).toMatch(/\/formato-no-permitido$/)

  // El archivo se valida antes de gastar el token: con una imagen válida el mismo token todavía sirve.
  const png = await request.post(`/api/reportes/${id}/foto`, {
    headers: { 'X-Subida': subidaToken },
    multipart: { foto: { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1X1 } },
  })
  expect(png.status()).toBe(200)
})

test('debeReportarSinDispositivoYRecibirUn401DispositivoInvalido', async ({ request }) => {
  const sinIdentidad = await request.post('/api/reportes', { data: { sectorId: 'manga', tipo: 'SIN_AGUA' } })
  expect(sinIdentidad.status()).toBe(401)
  expect(((await sinIdentidad.json()) as { type: string }).type).toMatch(/\/dispositivo-invalido$/)
})

test('debePedirOtroDispositivoYReintentarCuandoElGuardadoYaNoSirve', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('aguavigia.dispositivo', 'token-que-este-servidor-no-firmo'))
  const tokens: number[] = []
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === '/api/dispositivos') tokens.push(1)
  })
  await page.goto('/sectores/zona-industrial')
  const respuestas: number[] = []
  page.on('response', (valor) => {
    if (valor.url().endsWith('/api/reportes') && valor.request().method() === 'POST') respuestas.push(valor.status())
  })
  await abrirReporte(page, 'No tengo agua')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
  expect(respuestas).toEqual([401, 201])
  expect(tokens).toHaveLength(1)
})
