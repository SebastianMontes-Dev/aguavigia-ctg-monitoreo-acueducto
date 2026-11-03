import { Agent } from 'node:http'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { ProxyOptions } from 'vite'

const backend = process.env.AGUAVIGIA_BACKEND ?? 'http://localhost:8081'

// El proxy hace que la SPA y la API compartan origen: el proyecto corre solo en local, sin nginx (ADR-080).
// Sin conexiones persistentes hacia el backend: desde Node 19 el agente global las reutiliza, Tomcat cierra las ociosas y la primera
// petición que cae en una de ellas vuelve como 502 («socket hang up»). Eso se vio en FE7: la portada tardaba 8 o 20 s en vez de 3,6 s
// porque el listado, el SSE y la geometría recibían un 502 y el cliente reintentaba cinco segundos después.
const sinConexionesPersistentes = new Agent({ keepAlive: false })
const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  ['/api'].map((ruta) => [ruta, {
    target: backend,
    changeOrigin: true,
    agent: sinConexionesPersistentes,
    configure: (servidor: import('vite').HttpProxy.ProxyServer) => {
      // Para el navegador es el mismo origen; la petición interna al backend no necesita CORS.
      servidor.on('proxyReq', (peticion) => peticion.removeHeader('origin'))
    },
  }]),
)
// Spring no sirve portadas: este proxy acotado a acuacar.com las trae sin exponer el sitio entero (ADR-038).
proxy['/acuacar-media'] = {
  target: 'https://www.acuacar.com',
  changeOrigin: true,
  rewrite: (ruta: string) => ruta.replace(/^\/acuacar-media\//, '/wp-content/uploads/'),
  configure: (servidor: import('vite').HttpProxy.ProxyServer) => {
    servidor.on('proxyReq', (peticion) => {
      peticion.removeHeader('referer')
      peticion.setHeader('User-Agent', 'AguaVigiaCTG-Bot/1.0 (+alertas@aguavigia.com)')
    })
  },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // RNF001: sobre HTTP/1.1 y 3G cada archivo del camino crítico cuesta una vuelta de red (hay 6 conexiones por origen). Las librerías
        // que usa la primera pantalla viajan en un solo archivo en vez de una docena de fragmentos de 1 a 13 KB. MapLibre, PMTiles, el PDF y el
        // QR no entran: solo los pide la pantalla que los usa.
        codeSplitting: {
          groups: [{
            name: (id: string) => (/node_modules\/(\.pnpm\/)?(react|react-dom|scheduler|react-aria|react-aria-components|react-stately|@react-aria|@react-stately|@react-types|@internationalized|@swc|@tanstack|use-sync-external-store|openapi-fetch|clsx)\//.test(id) ? 'base' : null),
          }],
        },
      },
    },
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/pruebas/preparacion.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
