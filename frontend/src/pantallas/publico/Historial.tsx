import { Link } from '@tanstack/react-router'
import { Icono, type NombreIcono } from '../../componentes/Icono'
import bloques from '../../componentes/Bloques.module.css'
import pagina from './Pagina.module.css'
import estilos from './Historial.module.css'

interface Vista {
  to: '/cumplimiento' | '/bitacora' | '/estadisticas'
  icono: NombreIcono
  nombre: string
  pregunta: string
  detalle: string
}

// Las tres vistas de historia, en el orden de la navegación de escritorio. La primera responde la pregunta que más se hace: ¿cumplen?
const VISTAS: readonly Vista[] = [
  { to: '/cumplimiento', icono: 'calendario', nombre: 'Cumplimiento', pregunta: '¿Los cortes duran lo que anunciaron?', detalle: 'Lo prometido y lo que duró cada corte, con el Índice de Cumplimiento.' },
  { to: '/bitacora', icono: 'documento', nombre: 'Bitácora', pregunta: '¿Qué pasó, día por día?', detalle: 'Cada cambio de estado, con su fuente.' },
  { to: '/estadisticas', icono: 'ubicacion', nombre: 'Estadísticas', pregunta: '¿Dónde y cuándo se corta más?', detalle: 'Barrios más afectados y días con más cortes.' },
]

/**
 * ADR-107 (D5): la página del celular que agrupa las tres vistas de historia (ADR-071); en escritorio también se llega por la URL.
 * No pide datos: solo lleva a cada vista, así que no tiene estados de carga ni de error.
 */
export function Historial() {
  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Historial · tres maneras de verlo</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>Lo que pasó con el agua en Cartagena</h1>
      </header>
      <ul className={estilos.vistas}>
        {VISTAS.map((vista, indice) => (
          <li key={vista.to}>
            <Link to={vista.to} className={`${bloques.bloque} ${estilos.vista}${indice === 0 ? ` ${bloques.tenido}` : ''}`}>
              <span className={`${bloques.circulo} ${estilos.circulo}`}><Icono nombre={vista.icono} /></span>
              <span className={estilos.texto}>
                <span className={bloques.rotulo}>{vista.nombre}</span>
                <strong className={estilos.pregunta}>{vista.pregunta}</strong>
                <span className={bloques.bajada}>{vista.detalle}</span>
              </span>
              <span className={`${bloques.conIcono} ${estilos.ir}`}>Ver <Icono nombre="avanzar" tamano={16} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
