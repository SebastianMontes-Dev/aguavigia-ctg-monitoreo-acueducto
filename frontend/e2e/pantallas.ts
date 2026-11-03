import { expect, type Locator, type Page } from '@playwright/test'
import { simularApi } from './api-simulada'
import { simularAdministracion } from './panel-admin'
import { simularGestion } from './panel-gestion'
import { conSesionDeVecino, simularVecino } from './vecino'

// Las pantallas y estados de la aplicación, con la API simulada que cada una necesita. Las recorren la accesibilidad (axe) y las capturas.
export interface Pantalla {
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

export const titular = (page: Page) => expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

const publico = (nombre: string, ruta: string): Pantalla => ({ nombre, ruta, preparar: (page) => simularApi(page) })
const gestion = (nombre: string, ruta: string): Pantalla => ({ nombre, ruta, preparar: (page) => simularGestion(page) })
const administracion = (nombre: string, ruta: string): Pantalla => ({ nombre, ruta, preparar: (page) => simularAdministracion(page) })

export const PANTALLAS: Pantalla[] = [
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

