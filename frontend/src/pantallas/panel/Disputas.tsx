import { Link } from '@tanstack/react-router'
import { useDisputas } from '../../app/datos-panel'
import { usePaletaGrafito } from '../../app/paleta'
import { GlifoEstado } from '../../componentes/GlifoEstado'
import bloques from '../../componentes/Bloques.module.css'
import { presentarEstado, type EstadoServicio } from '../../dominio/estados'
import { formatearNumero } from '../../dominio/formato'
import { fuenteEnPalabras } from '../../dominio/cortes'
import { nombreLegible } from '../../dominio/sectores'
import pagina from '../publico/Pagina.module.css'
import estilos from './Gestion.module.css'

function estadoValido(valor?: string | null): EstadoServicio | null {
  return valor === 'CON_SERVICIO' || valor === 'SIN_SERVICIO' || valor === 'PRESION_BAJA' || valor === 'CORTE_PROGRAMADO' ? valor : null
}

function titularDe(cargando: boolean, fallo: boolean, cantidad: number): string {
  if (cargando) return 'Consultando los barrios en disputa…'
  if (fallo) return 'No pudimos consultar las disputas'
  if (cantidad === 0) return 'No hay barrios en disputa'
  return cantidad === 1 ? '1 barrio en disputa' : `${formatearNumero(cantidad)} barrios en disputa`
}

/** FE3 · `/panel/disputas`: barrios donde los vecinos contradicen a la fuente oficial. Solo lectura: basta `VER_PANEL`. */
export function Disputas() {
  usePaletaGrafito()
  const disputas = useDisputas()
  const lista = disputas.data ?? []

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Disputas · los más contradichos primero</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>{titularDe(disputas.isPending, disputas.isError, lista.length)}</h1>
      </header>
      <div className={estilos.columnas}>
        <section className={`${bloques.bloque} ${bloques.compacto}`} aria-label="Barrios en disputa">
          {disputas.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /><span /></div>}
          {disputas.isError && (
            <p role="alert" className={estilos.vacioBloque}>
              No pudimos consultar las disputas. Revisa tu conexión e inténtalo otra vez.{' '}
              <button type="button" className={estilos.reintentar} onClick={() => void disputas.refetch()}>Reintentar</button>
            </p>
          )}
          {disputas.data && lista.length === 0 && (
            <div className={estilos.vacioBloque}>
              <p className={bloques.titulo}>No hay barrios en disputa</p>
              <p className={bloques.bajada}>Aparecen aquí cuando varios vecinos contradicen lo que dice la fuente oficial de un barrio.</p>
            </div>
          )}
          {lista.length > 0 && (
            <ul className={estilos.lista}>
              {lista.map((barrio) => {
                const estado = estadoValido(barrio.estado)
                const fuente = fuenteEnPalabras(barrio.origen)
                const nombre = nombreLegible(barrio.nombre)
                return (
                  <li key={barrio.id} className={estilos.disputa}>
                    <span className={estilos.glifoEstado}><GlifoEstado estado={estado} tamano={24} /></span>
                    <h2>{nombre}</h2>
                    <p className={estilos.cifrasDisputa}>
                      <span>{presentarEstado(estado).texto}{fuente ? ` · ${fuente}` : ''}</span>
                      <span><strong>{formatearNumero(barrio.reportesEnContra ?? 0)}</strong> {(barrio.reportesEnContra ?? 0) === 1 ? 'reporte en contra' : 'reportes en contra'}</span>
                      {barrio.respaldo?.vecinos != null && barrio.respaldo.umbral != null && (
                        <span><strong>{formatearNumero(barrio.respaldo.vecinos)}</strong> de {formatearNumero(barrio.respaldo.umbral)} vecinos que hacen falta</span>
                      )}
                    </p>
                    <div className={estilos.enlaces}>
                      <Link to="/sectores/$id" params={{ id: barrio.id ?? '' }} className={estilos.enlaceFuerte} aria-label={`Ver la ficha de ${nombre}`}>Ver la ficha</Link>
                      <Link to="/panel/cortes" search={{ sector: barrio.id ?? '' }} className={estilos.enlaceFuerte} aria-label={`Ver los cortes de ${nombre}`}>Ver sus cortes</Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <aside className={estilos.lateral} data-solo-ancho aria-label="Cómo leer las disputas">
          <section className={bloques.bloque} aria-labelledby="titulo-disputa">
            <h2 id="titulo-disputa" className={estilos.tituloLateral}>Cómo leerlas</h2>
            <p className={bloques.bajada}>Una disputa se marca, no cambia el color del estado del barrio: el estado sigue siendo el que afirma la fuente más fuerte.</p>
            <p className={bloques.bajada}>Son reportes de vecinos en contra, no una conclusión. Revisa los cortes del barrio y cierra o corrige lo que haga falta.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
