import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet } from '@tanstack/react-router'
import { Marco } from './Marco'
import { ConfirmarReporte } from '../pantallas/publico/ConfirmarReporte'
import { FichaSector } from '../pantallas/publico/FichaSector'
import { Historial, NoEncontrada } from '../pantallas/publico/Pendiente'
import { PantallaMapa } from '../pantallas/publico/PantallaMapa'
import { ResumenCiudad } from '../pantallas/publico/ResumenCiudad'
import { Cumplimiento } from '../pantallas/publico/Cumplimiento'
import { Estadisticas } from '../pantallas/publico/Estadisticas'
import { Bitacora } from '../pantallas/publico/Bitacora'
import { PendientePanel } from '../pantallas/panel/PendientePanel'
import { esTipoBitacora } from '../dominio/historia'
import { Avisos } from '../pantallas/publico/Avisos'
import { BajaAvisos, ConfirmarAvisos } from '../pantallas/publico/EnlaceAvisos'
import { Restablecimiento } from '../pantallas/publico/Restablecimiento'

const raiz = createRootRoute({ component: Outlet, notFoundComponent: NoEncontrada })

const publico = createRoute({ getParentRoute: () => raiz, id: 'publico', component: Marco })

// Ruta sin segmento: el mapa se monta una vez para la ciudad y para cada barrio.
const mapa = createRoute({ getParentRoute: () => publico, id: 'mapa', component: PantallaMapa })
const inicio = createRoute({ getParentRoute: () => mapa, path: '/', component: ResumenCiudad })
const sector = createRoute({ getParentRoute: () => mapa, path: 'sectores/$id', component: FichaSector })

// Fuera del mapa: es la página a la que lleva el correo de aviso, con su propio botón (FE1).
const restablecimiento = createRoute({
  getParentRoute: () => publico, path: 'sectores/$id/restablecimiento',
  validateSearch: (busqueda: Record<string, unknown>): { token?: string } =>
    typeof busqueda.token === 'string' ? { token: busqueda.token } : {},
  component: Restablecimiento,
})

const confirmar = createRoute({ getParentRoute: () => publico, path: 'confirmar/$id', component: ConfirmarReporte })

const historial = createRoute({ getParentRoute: () => publico, path: 'historial', component: Historial })
const cumplimiento = createRoute({
  getParentRoute: () => publico, path: 'cumplimiento',
  validateSearch: (busqueda: Record<string, unknown>): { sector?: string } =>
    typeof busqueda.sector === 'string' ? { sector: busqueda.sector } : {},
  component: Cumplimiento,
})
const bitacora = createRoute({
  getParentRoute: () => publico, path: 'bitacora',
  validateSearch: (busqueda: Record<string, unknown>): { sector?: string; tipo?: import('../dominio/historia').TipoBitacora; desde?: string; hasta?: string } => ({
    ...(typeof busqueda.sector === 'string' ? { sector: busqueda.sector } : {}),
    ...(esTipoBitacora(busqueda.tipo) ? { tipo: busqueda.tipo } : {}),
    ...(typeof busqueda.desde === 'string' ? { desde: busqueda.desde } : {}),
    ...(typeof busqueda.hasta === 'string' ? { hasta: busqueda.hasta } : {}),
  }),
  component: Bitacora,
})
const estadisticas = createRoute({
  getParentRoute: () => publico, path: 'estadisticas', component: Estadisticas,
})
const avisos = createRoute({
  getParentRoute: () => publico,
  path: 'avisos',
  validateSearch: (busqueda: Record<string, unknown>): { sector?: string } =>
    typeof busqueda.sector === 'string' ? { sector: busqueda.sector } : {},
  component: Avisos,
})
const confirmarAvisos = createRoute({
  getParentRoute: () => publico, path: 'avisos/confirmar',
  validateSearch: (busqueda: Record<string, unknown>): { token?: string } =>
    typeof busqueda.token === 'string' ? { token: busqueda.token } : {},
  component: ConfirmarAvisos,
})
const bajaAvisos = createRoute({
  getParentRoute: () => publico, path: 'avisos/baja',
  validateSearch: (busqueda: Record<string, unknown>): { token?: string } =>
    typeof busqueda.token === 'string' ? { token: busqueda.token } : {},
  component: BajaAvisos,
})

// Provisional de F0–F1: tokens y contraste medidos en pantalla, fuera de la navegación ciudadana.
const muestrario = createRoute({
  getParentRoute: () => raiz, path: 'muestrario', component: lazyRouteComponent(() => import('./Muestrario'), 'Muestrario'),
})

// Panel del veedor (F5): cada pantalla se carga aparte para que no pese en la carga del mapa (plan §3).
const panelIngreso = createRoute({
  getParentRoute: () => raiz,
  path: 'panel/ingreso',
  validateSearch: (busqueda: Record<string, unknown>): { motivo?: 'vencida' | 'cerrada' } =>
    busqueda.motivo === 'vencida' || busqueda.motivo === 'cerrada' ? { motivo: busqueda.motivo } : {},
  component: lazyRouteComponent(() => import('../pantallas/panel/Ingreso'), 'Ingreso'),
})
const panelSegundoFactor = createRoute({
  getParentRoute: () => raiz,
  path: 'panel/segundo-factor',
  component: lazyRouteComponent(() => import('../pantallas/panel/SegundoFactor'), 'SegundoFactor'),
})
const panel = createRoute({
  getParentRoute: () => raiz, path: 'panel', component: lazyRouteComponent(() => import('../pantallas/panel/MarcoPanel'), 'MarcoPanel'),
})
const seccionPanel = <Ruta extends string>(path: Ruta, titular: string) => createRoute({
  getParentRoute: () => panel, path, component: () => <PendientePanel titular={titular} />,
})
const panelModeracion = seccionPanel('/', 'Moderación')
const panelCortes = seccionPanel('cortes', 'Cortes')
const panelIngesta = seccionPanel('ingesta', 'Ingesta')
const panelCuentas = seccionPanel('cuentas', 'Cuentas')
const panelAuditoria = seccionPanel('auditoria', 'Auditoría')
const panelSeguridad = seccionPanel('seguridad', 'Seguridad')

const arbol = raiz.addChildren([
  publico.addChildren([
    mapa.addChildren([inicio, sector]),
    restablecimiento, confirmar, historial, cumplimiento, bitacora, estadisticas, avisos, confirmarAvisos, bajaAvisos,
  ]),
  panelIngreso,
  panelSegundoFactor,
  panel.addChildren([panelModeracion, panelCortes, panelIngesta, panelCuentas, panelAuditoria, panelSeguridad]),
  muestrario,
])

export const router = createRouter({ routeTree: arbol, defaultPreload: 'intent', scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
