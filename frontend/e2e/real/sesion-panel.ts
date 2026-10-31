import { expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { codigoTotp, segundosHastaLaSiguienteFranja } from './totp'

// El primer ADMIN nace con una clave aleatoria (ADR-086) y estas pruebas la reciben en PANEL_CORREO y PANEL_CLAVE. La primera prueba que
// lo usa le da de alta el segundo factor y, como el secreto solo se ve una vez, lo deja anotado aquí para las demás. Playwright vacía
// `test-results` al empezar cada corrida, así que lo anotado nunca sobrevive a una base nueva.
const ARCHIVO = join(process.cwd(), 'test-results', 'estado-panel-real.json')

export interface EstadoPanel {
  secreto: string
  clave: string
}

export const correoDelPanel = process.env.PANEL_CORREO
export const claveDelPanel = process.env.PANEL_CLAVE

export function leerEstadoPanel(): EstadoPanel | null {
  try {
    return JSON.parse(readFileSync(ARCHIVO, 'utf8')) as EstadoPanel
  } catch {
    return null
  }
}

export function guardarEstadoPanel(estado: EstadoPanel): void {
  mkdirSync(dirname(ARCHIVO), { recursive: true })
  writeFileSync(ARCHIVO, JSON.stringify(estado))
}

/**
 * Entra al panel como ese ADMIN: con la clave inicial y el alta del segundo factor si nadie lo hizo todavía, o con la clave y el
 * código que dejó la prueba anterior. Cada código sirve una sola vez, así que se espera a la franja siguiente antes de usarlo.
 */
export async function entrarAlPanel(page: Page): Promise<void> {
  const estado = leerEstadoPanel()
  await page.goto('/panel/ingreso')
  await page.getByLabel('Correo').fill(correoDelPanel!)
  await page.getByLabel('Clave', { exact: true }).fill(estado?.clave ?? claveDelPanel!)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()

  if (estado) {
    await page.waitForTimeout((segundosHastaLaSiguienteFranja() + 1) * 1000)
    await page.getByLabel('Código de la app').fill(codigoTotp(estado.secreto))
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await expect(page).toHaveURL(/\/panel$/)
    return
  }

  await expect(page).toHaveURL(/\/panel\/segundo-factor$/)
  await page.getByRole('button', { name: 'Generar código QR' }).click()
  const secreto = (await page.getByText(/^[A-Z2-7]{4}( [A-Z2-7]{4}){3,}$/).innerText()).replace(/\s/g, '')
  await page.getByLabel('Código de la app').fill(codigoTotp(secreto))
  await page.getByRole('button', { name: 'Activar segundo factor' }).click()
  await expect(page).toHaveURL(/\/panel$/)
  guardarEstadoPanel({ secreto, clave: claveDelPanel! })
}

/** El token de la sesión abierta, para consultar la API desde la prueba con lo mismo que usa la pantalla. */
export async function tokenDelPanel(page: Page): Promise<string> {
  const token = await page.evaluate(() => sessionStorage.getItem('aguavigia.panel.token'))
  expect(token).toBeTruthy()
  return token!
}
