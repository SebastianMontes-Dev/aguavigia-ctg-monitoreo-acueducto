import { Link } from '@tanstack/react-router'
import estilos from './Pagina.module.css'

/** Cualquier URL que el router no conoce: se dice sin rodeos y se ofrece el mapa. */
export function NoEncontrada() {
  return (
    <div className={estilos.pagina}>
      <h1 className={estilos.titular}>No encontramos esta página</h1>
      <p className={estilos.entrada}>El enlace no lleva a ninguna parte de AguaVigía.</p>
      <Link to="/" className={estilos.enlace}>Ir al mapa</Link>
    </div>
  )
}
