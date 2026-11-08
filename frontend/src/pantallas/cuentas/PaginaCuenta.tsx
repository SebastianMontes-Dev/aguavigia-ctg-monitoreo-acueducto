import { useLayoutEffect, type ReactNode } from 'react'
import { Icono, type NombreIcono } from '../../componentes/Icono'
import avisos from '../publico/Avisos.module.css'
import pagina from '../publico/Pagina.module.css'
import estilos from './Cuenta.module.css'

export interface Paso { icono: NombreIcono; titulo: string; detalle: string }

/**
 * Los enlaces de los correos de cuenta abren las páginas HTML del backend y la SPA no recibe ningún token. Si alguien llegara
 * con `?token=` a una de estas pantallas, se retira de la URL y de la historia: no se lee, no se guarda y no viaja a ningún lado.
 */
export function useSinTokenEnLaUrl(): void {
  useLayoutEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token')) return
    url.searchParams.delete('token')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])
}

interface Props {
  rotulo: string
  titular: string
  bajada: string
  tituloPasos: string
  pasos: readonly Paso[]
  /** Nombre accesible del bloque de la tarea. */
  etiqueta: string
  children: ReactNode
}

/** La tarea en un bloque de 480 px y, a su lado y de la misma altura, cómo funciona (identidad.md §4.1, ADR-104 y ADR-107). */
export function PaginaCuenta({ rotulo, titular, bajada, tituloPasos, pasos, etiqueta, children }: Props) {
  useSinTokenEnLaUrl()
  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={avisos.rotulo}>{rotulo}</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>{titular}</h1>
        <p className={estilos.bajada}>{bajada}</p>
      </header>
      <div className={estilos.columnas}>
        <section className={avisos.tarea} aria-label={etiqueta}>{children}</section>
        <aside className={`${avisos.explicacion} ${estilos.explicacion}`} aria-labelledby="titulo-como-funciona-cuenta">
          <h2 id="titulo-como-funciona-cuenta">{tituloPasos}</h2>
          <ol className={`${avisos.pasos} ${avisos.conIconos}`}>
            {pasos.map((paso) => (
              <li key={paso.titulo}>
                <span className={avisos.circulo}><Icono nombre={paso.icono} tamano={20} /></span>
                <strong>{paso.titulo}</strong>
                <span>{paso.detalle}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
