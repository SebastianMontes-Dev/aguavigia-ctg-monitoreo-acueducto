// Lista las operaciones de backend/openapi.yaml que ningún módulo de src llama (FE7, paso 1).
// Solo pueden quedar las exclusiones de docs/frontend/README.md («Fuera del frontend»); cualquier otra es un hueco y falla.
//
// «Llama» significa una de dos cosas, según cómo consuma el módulo la ruta:
//   - openapi-fetch:  cliente.GET('/api/x/{id}', ...)  → cubre esa operación (ruta + método);
//   - literal suelto:  fetch(`/api/x/${id}`), new EventSource('/api/x'), un enlace → cubre la ruta con cualquier método,
//     porque ahí el método no se ve en el texto.
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contrato = resolve(raiz, '../backend/openapi.yaml')
const carpetaFuente = resolve(raiz, 'src')

const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

// Fuera del frontend por decisión (docs/frontend/README.md, «Fuera del frontend»). Un patrón con * cubre un prefijo.
export const EXCLUSIONES = [
  { patron: '/api/sim/*', motivo: 'la usa el simulador' },
  { patron: '/api/iot/presion', motivo: 'es para sensores, inactivo' },
  { patron: '/api/v2/requests.json', motivo: 'Open311, una API para máquinas' },
  { patron: '/api/cuentas/enlaces/*', motivo: 'páginas HTML que sirve el backend; el frontend solo depende de que existan (FE6)' },
  { patron: '/api/cuentas/verificacion', motivo: 'JSON de FE6b, que no se hizo a propósito: el correo sigue llevando a las páginas HTML del backend (decisión D-C)' },
  { patron: '/api/cuentas/invitacion', motivo: 'JSON de FE6b, que no se hizo a propósito: el correo sigue llevando a las páginas HTML del backend (decisión D-C)' },
  { patron: '/api/cuentas/clave', motivo: 'JSON de FE6b, que no se hizo a propósito: el correo sigue llevando a las páginas HTML del backend (decisión D-C)' },
  { patron: '/api/fotos/*', motivo: 'sin pantalla que la pida: no hay GET público de reportes y la foto es evidencia, no contenido público (reportes.md); el panel usa /api/veedor/fotos' },
  { patron: '/api/analitica/cumplimiento', motivo: 'duplica /api/cumplimiento y puede dar 503 (F7 de cambios-para-frontend.md)' },
  { patron: '/api/analitica/cumplimiento/mensual', motivo: 'duplica /api/cumplimiento y puede dar 503 (F7 de cambios-para-frontend.md)' },
  { patron: '/api/analitica/reportes/ranking', motivo: 'duplica lo que Estadísticas ya saca de Mongo y puede dar 503; sin pantalla por decisión del cierre (ADR-112, F8 de cambios-para-frontend.md)' },
  { patron: '/api/analitica/reportes/tendencia', motivo: 'duplica lo que Estadísticas ya saca de Mongo y puede dar 503; sin pantalla por decisión del cierre (ADR-112, F8 de cambios-para-frontend.md)' },
  { patron: '/api/analitica/bitacora/integridad', motivo: 'comprobación de la cadena de hashes de la bitácora inmutable; sin pantalla por decisión del cierre, puede dar 503 (ADR-113, F8 de cambios-para-frontend.md)' },
  { patron: '/api/veedor/analitica/vigilancia', motivo: 'revisiones del vigilante de la copia analítica; sin pantalla por decisión del cierre (ADR-113, F8 de cambios-para-frontend.md)' },
]

const normalizar = (ruta) => ruta.replace(/\{[^}]*\}|\$\{[^}]*\}/g, '{}').replace(/\/+$/, '')

function excluida(ruta) {
  return EXCLUSIONES.find(({ patron }) =>
    patron.endsWith('*') ? ruta.startsWith(patron.slice(0, -1)) : ruta === patron,
  )
}

/** Lee `paths:` del contrato sin dependencias: ruta con 2 espacios, método con 4. */
export function operacionesDelContrato(yaml) {
  const operaciones = []
  let enPaths = false
  let ruta = null
  for (const linea of yaml.split('\n')) {
    if (/^paths:\s*$/.test(linea)) { enPaths = true; continue }
    if (enPaths && /^\S/.test(linea)) break
    if (!enPaths) continue
    const nuevaRuta = /^ {2}(\/\S*):\s*$/.exec(linea)
    if (nuevaRuta) { ruta = nuevaRuta[1]; continue }
    const metodo = /^ {4}([a-z]+):\s*$/.exec(linea)
    if (metodo && ruta && METODOS.includes(metodo[1])) operaciones.push({ ruta, metodo: metodo[1].toUpperCase() })
  }
  return operaciones
}

async function archivosFuente(carpeta) {
  const salida = []
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name !== 'generado') salida.push(...(await archivosFuente(ruta)))
    } else if (/\.(ts|tsx)$/.test(entrada.name) && !/\.(test|spec)\.tsx?$/.test(entrada.name)) {
      salida.push(ruta)
    }
  }
  return salida
}

/**
 * Recorta un literal «/api/…» hasta donde termina la ruta: un `${…}` pegado a una barra es un segmento (`{}`); cualquier
 * otro `${…}`, `?` o `#` ya es cadena de consulta o sufijo y no forma parte de la ruta.
 */
export function rutaDelLiteral(texto) {
  let ruta = ''
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]
    if (c === '?' || c === '#') break
    if (c === '$' && texto[i + 1] === '{') {
      if (ruta.endsWith('/')) {
        let hondura = 0
        i += 1 // el `$`
        do {
          if (texto[i] === '{') hondura += 1
          if (texto[i] === '}') hondura -= 1
          i += 1
        } while (i < texto.length && hondura > 0)
        i -= 1
        ruta += '{}'
        continue
      }
      break
    }
    ruta += c
  }
  return ruta
}

/** Qué rutas toca el código: llamadas de openapi-fetch (con método) y literales «/api/…» (sin método). */
export function usosEnElCodigo(fuentes) {
  const conMetodo = new Set()
  const literales = new Set()
  for (const texto of fuentes) {
    for (const [, metodo, ruta] of texto.matchAll(/\.(GET|POST|PUT|PATCH|DELETE)\(\s*['"`](\/api\/[^'"`]*)['"`]/g)) {
      conMetodo.add(`${metodo} ${normalizar(ruta)}`)
    }
    for (const [, resto] of texto.matchAll(/['"`](\/api\/[^'"`]*)/g)) literales.add(normalizar(rutaDelLiteral(resto)))
  }
  return { conMetodo, literales }
}

const yaml = await readFile(contrato, 'utf8')
const operaciones = operacionesDelContrato(yaml)
const fuentes = await Promise.all((await archivosFuente(carpetaFuente)).map((archivo) => readFile(archivo, 'utf8')))
const { conMetodo, literales } = usosEnElCodigo(fuentes)

const sinLlamar = []
const excluidas = []
let llamadas = 0
for (const { ruta, metodo } of operaciones) {
  const clave = normalizar(ruta)
  const cubierta = conMetodo.has(`${metodo} ${clave}`) || literales.has(clave)
  const exclusion = excluida(ruta)
  if (cubierta) llamadas += 1
  else if (exclusion) excluidas.push({ ruta, metodo, motivo: exclusion.motivo })
  else sinLlamar.push({ ruta, metodo })
}

const rutas = new Set(operaciones.map(({ ruta }) => ruta))
process.stdout.write(
  `Contrato: ${rutas.size} rutas, ${operaciones.length} operaciones. Llamadas desde src: ${llamadas}. Excluidas: ${excluidas.length}.\n`,
)
for (const { ruta, metodo, motivo } of excluidas) process.stdout.write(`  excluida  ${metodo.padEnd(6)} ${ruta}  (${motivo})\n`)
if (sinLlamar.length > 0) {
  process.stderr.write(`\nOperaciones del contrato que ningún módulo de src llama (${sinLlamar.length}):\n`)
  for (const { ruta, metodo } of sinLlamar) process.stderr.write(`  ${metodo.padEnd(6)} ${ruta}\n`)
  process.stderr.write(
    '\nO se consumen desde src, o se añaden a EXCLUSIONES con su motivo y a docs/frontend/README.md («Fuera del frontend»).\n',
  )
  process.exit(1)
}
process.stdout.write('Sin huecos: todo el contrato está cubierto o excluido a propósito.\n')
