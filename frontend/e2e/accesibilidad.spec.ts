import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { simularApi } from './api-simulada'
import { simularAdministracion } from './panel-admin'
import { simularGestion } from './panel-gestion'
import { conSesionDeVecino, simularVecino } from './vecino'

// FE7 · accesibilidad: axe sin violaciones (WCAG 2.2 AA) en todas las pantallas, en claro y en oscuro (grafito incluido).
// Con movimiento reducido: la entrada escalonada (identidad.md §5) deja el contenido a medio opacar durante 560 ms y axe mediría
// contraste sobre un color que nadie ve. Es además la pasada de «movimiento reducido» de la puerta.

const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

interface Pantalla {
  nombre: string
  ruta: string
  /** Prepara la API simulada y la sesión que la pantalla necesita. */
  preparar?: (page: Page) => Promise<unknown>
  /** Lo que prueba que la pantalla ya pintó su contenido; por defecto, el titular. */
  listo?: (page: Page) => Promise<void>
  /** Deja abierto un diálogo, un formulario o un menú: la pantalla en su estado más cargado. */
  abrir?: (page: Page) => Promise<void>
  /** Reglas de axe que no aplican a este estado, con el porqué junto a la pantalla. */
  sinReglas?: string[]
}

/** Sube el elemento al centro de la ventana, lejos de la barra inferior fija del celular (scrollIntoViewIfNeeded lo deja pegado al borde). */
const alCentro = (lugar: Locator) => lugar.evaluate((nodo) => nodo.scrollIntoView({ block: 'center' }))

const titular = (page: Page) => expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

const publico = (nombre: string, ruta: string): Pantalla => ({ nombre, ruta, preparar: (page) => simularApi(page) })
const gestion = (nombre: string, ruta: string): Pantalla => ({ nombre, ruta, preparar: (page) => simularGestion(page) })
const administracion = (nombre: string, ruta: string): Pantalla => ({ nombre, ruta, preparar: (page) => simularAdministracion(page) })

const PANTALLAS: Pantalla[] = [
  // Mapa y ficha
  publico('mapa', '/'),
  publico('ficha de un barrio', '/sectores/armenia'),
  publico('ficha de un barrio sin datos', '/sectores/manga'),
  publico('¿ya volvió el agua?', '/sectores/armenia/restablecimiento?token=abc'),
  publico('confirmar un reporte', '/confirmar/r1'),
  // Historia y avisos
  publico('historial', '/historial'),
  publico('cumplimiento', '/cumplimiento'),
  publico('bitácora', '/bitacora'),
  publico('estadísticas', '/estadisticas'),
  publico('avisos', '/avisos'),
  publico('confirmar avisos', '/avisos/confirmar?token=abc'),
  publico('baja de avisos', '/avisos/baja?token=abc'),
  publico('página no encontrada', '/esto-no-existe'),
  // Cuentas públicas y vecino
  {
    ...publico('solicitar acceso al panel', '/cuenta/solicitar'),
    abrir: async (page) => { await alCentro(page.getByRole('link', { name: '¿No te llegó el correo?' })) },
  },
  publico('olvidé mi clave', '/cuenta/olvide'),
  publico('reenviar verificación', '/cuenta/reenviar'),
  {
    // Igual que «solicitar acceso»: en el celular la barra inferior fija tapa a medias la última casilla mientras no se hace scroll: axe mide el objetivo cortado.
    ...publico('registro del vecino', '/vecino/registro'),
    abrir: async (page) => { await alCentro(page.getByRole('button', { name: /Crear mi cuenta/ })) },
  },
  publico('ingreso del vecino', '/vecino/ingreso'),
  {
    nombre: 'perfil del vecino', ruta: '/vecino/perfil',
    preparar: async (page) => { await simularVecino(page); await conSesionDeVecino(page) },
  },
  // Panel
  publico('ingreso al panel', '/panel/ingreso'),
  gestion('moderación', '/panel'),
  gestion('cortes', '/panel/cortes'),
  gestion('cortes de un barrio', '/panel/cortes?sector=armenia'),
  gestion('disputas', '/panel/disputas'),
  gestion('ingesta', '/panel/ingesta'),
  administracion('sistema', '/panel/sistema'),
  administracion('cuentas', '/panel/cuentas'),
  administracion('auditoría', '/panel/auditoria'),
  administracion('seguridad de la cuenta', '/panel/seguridad'),
  // Estados con algo abierto: los diálogos y los formularios son donde más se pierde el foco y la etiqueta.
  {
    ...publico('hoja de reporte abierta', '/sectores/armenia'),
    abrir: async (page) => {
      await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    ...publico('búsqueda de barrio con opciones', '/'),
    // react-aria oculta el resto de la página (`ariaHideOutside`) mientras la lista está abierta y deja sus enlaces enfocables; el foco se
    // queda en el campo y Tab cierra la lista y lo devuelve todo. Es el comportamiento de la librería, no de la pantalla.
    sinReglas: ['aria-hidden-focus'],
    abrir: async (page) => {
      await page.getByRole('combobox', { name: 'Busca tu barrio' }).fill('a')
      await expect(page.getByRole('option').first()).toBeVisible()
    },
  },
  {
    ...administracion('invitar a una persona', '/panel/cuentas'),
    abrir: async (page) => {
      await page.getByRole('button', { name: 'Invitar a una persona' }).click()
      await expect(page.getByLabel('Correo')).toBeVisible()
    },
  },
  {
    ...gestion('registrar un corte', '/panel/cortes'),
    abrir: async (page) => {
      await page.getByRole('button', { name: /Registrar un corte/ }).click()
      await expect(page.getByLabel('Inicio (Hora de Cartagena)')).toBeVisible()
    },
  },
  {
    ...gestion('confirmar una aprobación', '/panel'),
    abrir: async (page) => {
      await page.getByRole('listitem').filter({ hasText: 'Armenia' }).getByRole('button', { name: 'Aprobar' }).first().click()
      await expect(page.getByRole('button', { name: 'Sí, aprobar' })).toBeVisible()
    },
  },
]

async function revisar(page: Page, pantalla: Pantalla) {
  await pantalla.preparar?.(page)
  await page.goto(pantalla.ruta)
  await (pantalla.listo ?? titular)(page)
  await pantalla.abrir?.(page)
  await page.evaluate(() => document.fonts.ready)
  // Una pantalla del panel sin sesión válida acaba en el ingreso: axe pasaría sobre la pantalla equivocada.
  expect(new URL(page.url()).pathname, 'la pantalla no debe redirigir').toBe(pantalla.ruta.split('?')[0])
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS).disableRules(pantalla.sinReglas ?? []).analyze()
  // Que pasen reglas prueba que axe sí midió algo; «sin concluir» son los textos sobre el lienzo del mapa y las flechas decorativas.
  expect(resultado.passes.length, 'axe debe haber medido la pantalla').toBeGreaterThan(5)
  const resumen = resultado.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' | ')}`).join('\n')}`)
  expect(resumen, `${pantalla.ruta}\n${resumen.join('\n')}`).toEqual([])
}

for (const esquema of ['light', 'dark'] as const) {
  test.describe(`axe · tema ${esquema}`, () => {
    test.use({ colorScheme: esquema })
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })
    for (const pantalla of PANTALLAS) {
      test(`noDebeTenerViolacionesDeAccesibilidad: ${pantalla.nombre}`, async ({ page }) => {
        await revisar(page, pantalla)
      })
    }
  })
}
