import { expect, type APIRequestContext } from '@playwright/test'

/** Cada llamada crea una identidad distinta: así se simulan vecinos distintos (docs/api/reportes.md). */
export async function nuevoDispositivo(request: APIRequestContext): Promise<string> {
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
export async function puntoDentroDe(request: APIRequestContext, sectorId: string): Promise<{ latitud: number; longitud: number }> {
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

interface MensajeMailhog {
  To: { Mailbox: string; Domain: string }[]
  Content: { Body: string; Headers?: Record<string, string[]> }
  MIME?: { Parts?: { Body: string; Headers?: Record<string, string[]> }[] }
}

/**
 * Espera en Mailhog un correo para `correo` que cumpla `condicion` y devuelve su cuerpo sin la codificación
 * quoted-printable, listo para buscar enlaces.
 */
export async function correoDe(request: APIRequestContext, correo: string, condicion: (cuerpo: string) => boolean = () => true, intentos = 30): Promise<string> {
  const base = process.env.MAILHOG_URL ?? 'http://localhost:8025'
  for (let intento = 0; intento < intentos; intento++) {
    const respuesta = await request.get(`${base}/api/v2/search?kind=to&query=${encodeURIComponent(correo)}`)
    expect(respuesta.ok()).toBeTruthy()
    const datos = await respuesta.json() as { items: MensajeMailhog[] }
    const cuerpos = datos.items
      .filter((item) => item.To.some((destino) => `${destino.Mailbox}@${destino.Domain}` === correo))
      .map((mensaje) => [mensaje.Content.Body, ...(mensaje.MIME?.Parts?.map((parte) => parte.Body) ?? [])].join('\n')
        .replace(/=\r?\n/g, '').replace(/=3D/gi, '=').replace(/&amp;/g, '&'))
    const cuerpo = cuerpos.find(condicion)
    if (cuerpo) return cuerpo
    await new Promise((resolver) => setTimeout(resolver, 500))
  }
  throw new Error(`Mailhog no recibió el correo esperado para ${correo}`)
}

/** La ruta de la SPA de un enlace del correo, sin el origen que configure el backend. */
export function rutaEnCorreo(cuerpo: string, patron: string): string {
  const coincidencia = cuerpo.match(new RegExp(`https?://[^"'\\s<>]+${patron}\\?token=[^"'\\s<>]+`))
  if (!coincidencia) throw new Error(`Falta el enlace ${patron} en el correo`)
  const enlace = new URL(coincidencia[0])
  return `${enlace.pathname}${enlace.search}`
}
