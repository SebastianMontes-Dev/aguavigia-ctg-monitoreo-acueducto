import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { correoDe, nuevoDispositivo, puntoDentroDe, rutaEnCorreo } from './ayudantes'

interface SectorReal { id: string; poblacion: number | null; estado: string | null; enDisputa?: boolean }

// Los barrios que ya usan los otros specs reales no se tocan aquí.
const OCUPADOS = new Set(['arroyo-grande', 'zona-industrial', 'manga'])

/**
 * Un barrio sin datos con el umbral mínimo de tres vecinos (≤ 3000 habitantes): es el que el quórum mueve siempre. Contra un
 * boletín de Acuacar solo abriría una disputa (cambios-para-frontend F1), y uno que los vecinos acaban de dejar con servicio
 * no siempre vuelve a cambiar en la misma pasada (se vio el 2026-10-25 contra el backend local).
 */
async function barrioDisponible(request: APIRequestContext): Promise<string> {
  const { sectores } = await (await request.get('/api/sectores')).json() as { sectores: SectorReal[] }
  const barrio = sectores
    .filter((sector) => !OCUPADOS.has(sector.id) && sector.poblacion !== null && sector.poblacion > 0 && sector.poblacion <= 3000 && !sector.enDisputa)
    .filter((sector) => sector.estado === null)
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  expect(barrio, 'no queda un barrio pequeño sin datos que los vecinos puedan mover').toBeDefined()
  return barrio!.id
}

async function reportarTres(request: APIRequestContext, sectorId: string, tipo: 'SIN_AGUA' | 'SERVICIO_RESTABLECIDO') {
  const coordenada = await puntoDentroDe(request, sectorId)
  for (let vecino = 0; vecino < 3; vecino++) {
    const respuesta = await request.post('/api/reportes', {
      headers: { 'X-Dispositivo': await nuevoDispositivo(request) },
      data: { sectorId, tipo, coordenada, precisionMetros: 25 },
    })
    expect(respuesta.status()).toBe(201)
  }
}

test('debeConfirmarQueVolvioElAguaDesdeElEnlaceDelAvisoSoloAlPulsar', async ({ page, request }) => {
  const sectorId = await barrioDisponible(request)
  const correo = `restablecimiento-${randomUUID()}@example.com`

  // Una suscripción confirmada a ese barrio.
  expect((await request.post('/api/suscripciones', { data: { correo, sectorIds: [sectorId] } })).status()).toBe(201)
  const confirmar = rutaEnCorreo(await correoDe(request, correo, (cuerpo) => cuerpo.includes('/avisos/confirmar?token=')), '/avisos/confirmar')
  const token = new URL(confirmar, 'http://localhost').searchParams.get('token')!
  expect((await request.post(`/api/suscripciones/confirmar?token=${encodeURIComponent(token)}`)).status()).toBe(200)

  // Tres vecinos lo dejan sin servicio: llega el aviso con el enlace «Sí, ya volvió el agua».
  await reportarTres(request, sectorId, 'SIN_AGUA')
  const cuerpo = await correoDe(request, correo, (texto) => texto.includes('/restablecimiento?token='), 60)
  const enlace = rutaEnCorreo(cuerpo, `/sectores/${sectorId}/restablecimiento`)

  const votos: string[] = []
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && peticion.url().includes('/restablecimiento?token=')) votos.push(peticion.url())
  })
  await page.goto(enlace)
  await expect(page).toHaveURL(new RegExp(`/sectores/${sectorId}/restablecimiento$`))
  await expect(page.getByRole('heading', { level: 1, name: /^¿Ya volvió el agua a / })).toBeVisible()
  await expect(page.getByText('Ahora figura como: Sin servicio')).toBeVisible()
  expect(votos).toHaveLength(0)

  const voto = page.waitForResponse((respuesta) => respuesta.url().includes('/restablecimiento?token=') && respuesta.request().method() === 'POST')
  await page.getByRole('button', { name: 'Sí, ya volvió el agua' }).click()
  expect((await voto).status()).toBe(201)
  await expect(page.getByRole('status').filter({ hasText: 'Gracias' })).toContainText('Tu respuesta cuenta junto con la de tus vecinos.')
  expect(votos).toHaveLength(1)

  // Tres vecinos más deshacen el «sin servicio» (hoy el barrio vuelve a «sin datos»), para que la próxima pasada lo pueda usar.
  await reportarTres(request, sectorId, 'SERVICIO_RESTABLECIDO')
})
