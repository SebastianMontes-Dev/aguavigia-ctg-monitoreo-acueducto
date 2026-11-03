// FE7 · rendimiento (RNF001): mide, contra la SPA servida y un backend real con 211 sectores, cuánto tarda en aparecer una respuesta útil
// con una red 3G simulada, cuántos SSE abre cada pestaña y cuántas veces se descarga la geometría.
//
//   AGUAVIGIA_BACKEND=http://localhost:8081 npx vite preview &      (o la pila de docker compose en otros puertos)
//   node scripts/medir-rendimiento.mjs [--repeticiones 5] [--url http://localhost:4173]
//
// No es una prueba de CI: los tiempos dependen de la máquina. Imprime una tabla en Markdown para pegar en docs/frontend/FE7.
import { chromium } from '@playwright/test'

const argumentos = process.argv.slice(2)
const leer = (nombre, defecto) => {
  const indice = argumentos.indexOf(`--${nombre}`)
  return indice >= 0 ? argumentos[indice + 1] : defecto
}
const BASE = leer('url', 'http://localhost:4173')
const REPETICIONES = Number(leer('repeticiones', '5'))
const SOLO = leer('solo', '')
const PERFILES_PEDIDOS = leer('perfiles', 'Fast 3G:4,Fast 3G:1,Slow 3G:4').split(',').map((par) => par.split(':'))
const SIN_CANALES = argumentos.includes('--sin-canales')

// Perfiles de DevTools: «Fast 3G» es la «3G simulada» de RNF001; «Slow 3G» se mide para decir hasta dónde llega la interfaz.
const PERFILES = {
  'Fast 3G': { downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8, uploadThroughput: (750 * 1024 * 0.9) / 8, latency: 562.5 },
  'Slow 3G': { downloadThroughput: (400 * 1024 * 0.9) / 8, uploadThroughput: (400 * 1024 * 0.9) / 8, latency: 2000 },
}

// Cada ruta, con el elemento que contesta la pregunta del vecino. El primero que aparezca en el DOM marca el instante.
const RUTAS = [
  { ruta: '/', respuesta: 'section[aria-label="Barrios por estado del agua"]', pregunta: '¿cómo está Cartagena ahora?' },
  { ruta: '/sectores/armenia', respuesta: 'article', pregunta: '¿hay agua en mi barrio?' },
  // Con la base vacía el titular dice que aún no hay cortes cerrados: esa también es la respuesta.
  { ruta: '/cumplimiento', respuesta: 'main', texto: /Aún no hay cortes cerrados|en promedio/i, pregunta: '¿cumplen los cortes?' },
]

const mediana = (valores) => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)]
const segundos = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(2).replace('.', ',') : 'sin respuesta')
const kilobytes = (bytes) => `${Math.round(bytes / 1024)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

async function abrir(navegador, { perfil, cpu = 1 }) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CO' })
  const pagina = await contexto.newPage()
  const cdp = await contexto.newCDPSession(pagina)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...PERFILES[perfil] })
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  const transferido = { bytes: 0, peticiones: 0 }
  cdp.on('Network.loadingFinished', (evento) => { transferido.bytes += evento.encodedDataLength; transferido.peticiones += 1 })
  return { contexto, pagina, transferido }
}

async function cargar(navegador, { ruta, respuesta, texto }, opciones) {
  const { contexto, pagina, transferido } = await abrir(navegador, opciones)
  await pagina.addInitScript(([selector, patron]) => {
    window.respuestaEn = null
    const mirar = () => {
      if (window.respuestaEn !== null) return
      const hay = patron ? new RegExp(patron.fuente, patron.banderas).test(document.querySelector('main')?.innerText ?? '') : document.querySelector(selector)
      if (hay) window.respuestaEn = performance.now()
    }
    new MutationObserver(mirar).observe(document, { childList: true, subtree: true })
    window.primerContenido = null
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) if (entrada.name === 'first-contentful-paint') window.primerContenido = entrada.startTime
    }).observe({ type: 'paint', buffered: true })
  }, [respuesta, texto ? { fuente: texto.source, banderas: texto.flags } : null])
  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'commit' })
  await pagina.waitForFunction(() => window.respuestaEn !== null, null, { timeout: 120_000, polling: 50 })
  const medidas = await pagina.evaluate(() => ({ respuesta: window.respuestaEn, fcp: window.primerContenido }))
  // Se deja correr un momento para contar todo lo que la pantalla termina bajando (el mapa y sus teselas llegan después).
  await pagina.waitForTimeout(1500)
  await contexto.close()
  return { ...medidas, kb: transferido.bytes, peticiones: transferido.peticiones }
}

async function tabla(navegador, perfil, cpu, repeticiones) {
  const filas = []
  for (const destino of RUTAS.filter((ruta) => !SOLO || ruta.ruta === SOLO)) {
    const corridas = []
    for (let i = 0; i < repeticiones; i += 1) {
      try {
        corridas.push(await cargar(navegador, destino, { perfil, cpu }))
        console.error(`  ${perfil} CPU ${cpu}× ${destino.ruta} #${i + 1}: ${Math.round(corridas.at(-1).respuesta)} ms`)
      } catch (error) {
        console.error(`  ${perfil} CPU ${cpu}× ${destino.ruta} #${i + 1}: SIN RESPUESTA (${error.message.split('\n')[0]})`)
      }
    }
    if (corridas.length === 0) { filas.push({ ...destino, respuesta: Infinity, peor: Infinity, fcp: 0, kb: 0, peticiones: 0 }); continue }
    filas.push({
      ...destino,
      respuesta: mediana(corridas.map((c) => c.respuesta)),
      peor: Math.max(...corridas.map((c) => c.respuesta)),
      fcp: mediana(corridas.map((c) => c.fcp ?? 0)),
      kb: mediana(corridas.map((c) => c.kb)),
      peticiones: mediana(corridas.map((c) => c.peticiones)),
    })
  }
  return filas
}

/** Cuántos SSE abre una pestaña al recorrer la aplicación, y cuántos dos pestañas. */
async function contarCanales(navegador) {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } })
  const abiertos = []
  const nueva = async (nombre) => {
    const pagina = await contexto.newPage()
    const propios = { nombre, abiertos: 0, vivos: 0, simultaneos: 0, geometria: 0, listados: 0 }
    pagina.on('request', (peticion) => {
      const ruta = new URL(peticion.url()).pathname
      if (ruta === '/api/sectores/stream') {
        propios.abiertos += 1; propios.vivos += 1; propios.simultaneos = Math.max(propios.simultaneos, propios.vivos)
      }
      if (ruta === '/api/sectores/geometria') propios.geometria += 1
      if (ruta === '/api/sectores') propios.listados += 1
    })
    // Un SSE termina cuando el cliente lo aborta (requestfailed) o el servidor lo cierra (requestfinished).
    const termina = (peticion) => { if (new URL(peticion.url()).pathname === '/api/sectores/stream') propios.vivos -= 1 }
    pagina.on('requestfailed', termina)
    pagina.on('requestfinished', termina)
    abiertos.push(propios)
    return pagina
  }

  const uno = await nueva('pestaña 1')
  await uno.goto(`${BASE}/`)
  await uno.getByRole('heading', { level: 1, name: 'Cartagena ahora' }).waitFor()
  await uno.waitForTimeout(2000)
  const trasLaPortada = { ...abiertos[0] }
  // Navegación dentro de la SPA (sin recargar): ficha, Cumplimiento, Bitácora, Estadísticas, Avisos y de vuelta al mapa.
  await uno.locator('nav[aria-label="Principal"]').getByRole('link', { name: 'Cumplimiento' }).click()
  await uno.getByRole('heading', { level: 1 }).waitFor()
  await uno.locator('nav[aria-label="Principal"]').getByRole('link', { name: 'Bitácora' }).click()
  await uno.getByRole('heading', { level: 1 }).waitFor()
  await uno.locator('nav[aria-label="Principal"]').getByRole('link', { name: 'Estadísticas' }).click()
  await uno.getByRole('heading', { level: 1 }).waitFor()
  await uno.locator('nav[aria-label="Principal"]').getByRole('link', { name: 'Mapa' }).click()
  await uno.getByRole('heading', { level: 1, name: 'Cartagena ahora' }).waitFor()
  await uno.getByRole('combobox', { name: 'Busca tu barrio' }).fill('arme')
  await uno.getByRole('option', { name: /Armenia/i }).click()
  await uno.getByRole('heading', { level: 1, name: 'Armenia' }).waitFor()
  await uno.waitForTimeout(2000)
  const trasRecorrer = { ...abiertos[0] }

  // Recarga en la misma pestaña: la geometría debe salir del almacén local y no volver a bajarse.
  const antes = abiertos[0].geometria
  await uno.reload()
  await uno.getByRole('heading', { level: 1, name: 'Armenia' }).waitFor()
  await uno.waitForTimeout(2000)
  const geometriaTrasRecargar = abiertos[0].geometria - antes

  const dos = await nueva('pestaña 2')
  await dos.goto(`${BASE}/`)
  await dos.getByRole('heading', { level: 1, name: 'Cartagena ahora' }).waitFor()
  await dos.waitForTimeout(2000)
  const cabeceras = await (await contexto.request.get(`${BASE}/api/sectores/geometria`)).headers()
  const sectores = (await (await contexto.request.get(`${BASE}/api/sectores`)).json()).sectores.length
  await contexto.close()
  return { sectores, trasLaPortada, trasRecorrer, geometriaTrasRecargar, pestana2: abiertos[1], cacheControl: cabeceras['cache-control'] }
}

const navegador = await chromium.launch()
try {
  const salida = []
  salida.push(`Medido el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (hora de Cartagena) contra ${BASE}, ${REPETICIONES} cargas en frío por celda (2 en Slow 3G), mediana y, entre paréntesis, la peor.`)
  salida.push('Celular 390×844, caché vacía en cada carga. «Respuesta útil»: el instante en que aparece en pantalla lo que contesta la pregunta de la ruta.\n')
  for (const [perfil, cpuTexto] of PERFILES_PEDIDOS) {
    const cpu = Number(cpuTexto)
    const filas = await tabla(navegador, perfil, cpu, perfil === 'Slow 3G' ? Math.min(2, REPETICIONES) : REPETICIONES)
    salida.push(`### ${perfil}${cpu > 1 ? `, CPU ${cpu}× más lenta` : ', CPU sin limitar'}\n`)
    salida.push('| Ruta | Pregunta | Respuesta útil | Primer contenido | Transferido | Peticiones |')
    salida.push('|---|---|---|---|---|---|')
    for (const f of filas) {
      salida.push(`| \`${f.ruta}\` | ${f.pregunta} | **${segundos(f.respuesta)} s** (${segundos(f.peor)}) | ${segundos(f.fcp)} s | ${kilobytes(f.kb)} KB | ${f.peticiones} |`)
    }
    salida.push('')
  }
  if (SIN_CANALES) { process.stdout.write(`${salida.join('\n')}\n`); process.exit(0) }
  const canales = await contarCanales(navegador)
  salida.push('### Canal en vivo y geometría\n')
  salida.push(`Con ${canales.sectores} sectores:\n`)
  salida.push(`- SSE de la pestaña 1 tras cargar la portada: **${canales.trasLaPortada.abiertos}** abierto. Al recorrer 6 pantallas sin recargar se abrieron **${canales.trasRecorrer.abiertos}** en total (el canal se cierra en las pantallas que no lo usan y se reabre al volver), pero nunca hubo más de **${canales.trasRecorrer.simultaneos}** a la vez.`)
  salida.push(`- SSE de la pestaña 2 abierta al mismo tiempo: **${canales.pestana2.abiertos}** (uno por pestaña; ${canales.pestana2.simultaneos} simultáneo).`)
  salida.push(`- Descargas de \`/api/sectores/geometria\`: **${canales.trasRecorrer.geometria}** en la pestaña 1 durante el recorrido; **${canales.geometriaTrasRecargar}** al recargarla; la pestaña 2 hizo **${canales.pestana2.geometria}**.`)
  salida.push(`- \`Cache-Control\` de la geometría: \`${canales.cacheControl}\`.`)
  process.stdout.write(`${salida.join('\n')}\n`)
} finally {
  await navegador.close()
}
