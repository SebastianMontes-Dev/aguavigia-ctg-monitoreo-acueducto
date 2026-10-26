import { useLayoutEffect } from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components'
import { useModoSistema } from './datos'
import { SelectorTema } from './SelectorTema'
import estilos from './Marco.module.css'

const DESTINOS = [
  { to: '/', texto: 'Mapa' },
  { to: '/cumplimiento', texto: 'Cumplimiento' },
  { to: '/bitacora', texto: 'Bitácora' },
  { to: '/estadisticas', texto: 'Estadísticas' },
  { to: '/avisos', texto: 'Avisos' },
] as const

// ADR-071: en el celular, tres destinos; Historial agrupa Bitácora, Cumplimiento y Estadísticas.
const DESTINOS_CELULAR = [
  { to: '/', texto: 'Mapa' },
  { to: '/historial', texto: 'Historial' },
  { to: '/avisos', texto: 'Avisos' },
] as const

const HISTORIAL = ['/historial', '/bitacora', '/cumplimiento', '/estadisticas']

// ADR-105: estas páginas toman el grafito en el tema oscuro. Va en <body> (también lo heredan los menús flotantes, que se montan
// ahí) y nunca en <html>, de donde el mapa lee sus colores.
const CON_GRAFITO = ['/cumplimiento', '/bitacora', '/estadisticas', '/avisos']

export function usaGrafito(ruta: string): boolean {
  return CON_GRAFITO.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`))
}

// Un barrio abierto (/sectores/…) sigue siendo «Mapa»; en el celular, las tres páginas de historia son «Historial».
export function destinoActivo(ruta: string, destino: string, celular = false): boolean {
  if (destino === '/') return ruta === '/' || ruta.startsWith('/sectores/')
  if (celular && destino === '/historial') return HISTORIAL.some((prefijo) => ruta.startsWith(prefijo))
  return ruta.startsWith(destino)
}

function EnlacesNavegacion({ clase }: { clase: string | undefined }) {
  const { pathname } = useLocation()
  return DESTINOS.map((destino) => (
    <Link
      key={destino.to}
      to={destino.to}
      className={clase}
      aria-current={destinoActivo(pathname, destino.to) ? 'page' : undefined}
    >
      {destino.texto}
    </Link>
  ))
}

export function Marco() {
  const { pathname } = useLocation()
  // Una simulación nunca se presenta como real (F4): la franja se queda en todas las pantallas mientras dure.
  const simulacion = useModoSistema().data?.modo === 'SIMULACION'
  const grafito = usaGrafito(pathname)
  useLayoutEffect(() => {
    if (grafito) document.body.dataset.paleta = 'grafito'
    else delete document.body.dataset.paleta
  }, [grafito])
  return (
    <div className={estilos.marco} data-simulacion={simulacion || undefined}>
      <a href="#contenido" className={estilos.saltar}>Saltar al contenido</a>
      <header className={estilos.cabecera}>
        <Link to="/" className={estilos.marca} aria-label="AguaVigía, Cartagena: ir al mapa">
          AguaVigía <span className={estilos.ciudad}>Cartagena</span>
        </Link>
        <nav aria-label="Principal" className={estilos.navegacion}>
          <EnlacesNavegacion clase={estilos.destino} />
        </nav>
        <div className={estilos.temaEscritorio}><SelectorTema /></div>
        <DialogTrigger>
          <Button className={estilos.menu}>Menú</Button>
          <Popover className={estilos.menuPopover} placement="bottom end">
            <Dialog className={estilos.menuDialogo} aria-label="Menú">
              <nav aria-label="Secciones" className={estilos.menuEnlaces}>
                <EnlacesNavegacion clase={estilos.menuDestino} />
              </nav>
              <SelectorTema />
            </Dialog>
          </Popover>
        </DialogTrigger>
      </header>
      {simulacion && (
        <output className={estilos.simulacion}>
          <strong>Simulación.</strong> Datos de una simulación; no son reales.
        </output>
      )}
      <main id="contenido" className={estilos.principal} tabIndex={-1}>
        <Outlet />
      </main>
      <nav aria-label="Principal en el celular" className={estilos.barraInferior}>
        {DESTINOS_CELULAR.map((destino) => (
          <Link
            key={destino.to}
            to={destino.to}
            className={estilos.destinoInferior}
            aria-current={destinoActivo(pathname, destino.to, true) ? 'page' : undefined}
          >
            {destino.texto}
          </Link>
        ))}
      </nav>
    </div>
  )
}
