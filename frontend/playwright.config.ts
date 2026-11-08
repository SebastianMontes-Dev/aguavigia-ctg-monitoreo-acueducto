import { defineConfig, devices } from '@playwright/test'

const puerto = 4173

export default defineConfig({
  testDir: 'e2e',
  testIgnore: '**/real/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${puerto}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run build && npm run preview',
    url: `http://localhost:${puerto}`,
    reuseExistingServer: !process.env.CI,
    // Hermético: lo que una prueba no simula no debe llegar a un backend que haya en el puerto 8081 (en desarrollo suele haber uno): sus 401 cerraban la
    // sesión del panel a mitad de una prueba y dos o tres fallaban por corrida. Con el puerto 9 esas peticiones fallan al instante y siempre igual.
    env: { AGUAVIGIA_BACKEND: 'http://127.0.0.1:9' },
    timeout: 120_000,
  },
})
