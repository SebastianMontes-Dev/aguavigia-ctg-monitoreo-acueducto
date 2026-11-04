import { defineConfig, devices } from '@playwright/test'

// El guion de la demo (docs/frontend/guion-demo.md) recorrido por la interfaz, de principio a fin, contra `docker compose up` sobre una base
// limpia. No va en `test:e2e:real`: cambia el mapa y el Índice a propósito y los otros specs reales suponen la base como la deja la siembra.
//   PANEL_CORREO y PANEL_CLAVE: el ADMIN inicial (la clave la imprime el log del backend, ADR-086).
const puerto = 4173

export default defineConfig({
  testDir: 'e2e/demo',
  fullyParallel: false,
  workers: 1,
  timeout: 600_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${puerto}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run build && npm run preview',
    url: `http://localhost:${puerto}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
