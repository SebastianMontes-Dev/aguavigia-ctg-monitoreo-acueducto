import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from 'react-aria-components'
import { useAhora } from '../../app/ahora'
import { useBarriosPanel, useCortesDelBarrio, useVencidos } from '../../app/datos-panel'
import { usePermisos } from '../../app/panel'
import { usePaletaGrafito } from '../../app/paleta'
import { Icono } from '../../componentes/Icono'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { cierresProvisionales, barriosEnPalabras, barriosPendientes, estadoDeCorteEnPalabras, razonDeVencido, ventanaEnPalabras } from '../../dominio/cortes-panel'
import type { Corte } from '../../dominio/cortes'
import { nombreLegible } from '../../dominio/sectores'
import { haceCuanto } from '../../dominio/tiempo'
import pagina from '../publico/Pagina.module.css'
import { DetalleCorte } from './DetalleCorte'
import { FormularioAlta } from './FormulariosCorte'
import estilos from './Gestion.module.css'

function titularDe(cargando: boolean, fallo: boolean, cantidad: number): string {
  if (cargando) return 'Consultando los cortes vencidos…'
  if (fallo) return 'No pudimos consultar los cortes vencidos'
  if (cantidad === 0) return 'Ningún corte espera tu cierre'
  return cantidad === 1 ? '1 corte espera tu cierre' : `${cantidad} cortes esperan tu cierre`
}

/** Ordena del más reciente al más antiguo: lo último que se anunció es lo primero que se busca. */
function masRecientesPrimero(cortes: readonly Corte[]): Corte[] {
  return [...cortes].sort((a, b) => Date.parse(b.inicio ?? '') - Date.parse(a.inicio ?? ''))
}

/**
 * FE3 · `/panel/cortes`: la cola de cortes vencidos arriba, los cortes del barrio elegido debajo y, a un lado, el detalle de uno o el
 * alta de otro. Leer exige `VER_PANEL`; registrar, cerrar, confirmar y anular, `GESTIONAR_CORTES`.
 */
export function Cortes() {
  usePaletaGrafito()
  const permisos = usePermisos()
  const puedeGestionar = permisos.has('GESTIONAR_CORTES')
  const buscar = useSearch({ from: '/panel/cortes' })
  const navegar = useNavigate()
  const ahora = useAhora()
  const barrios = useBarriosPanel()
  const vencidos = useVencidos()
  const cortes = useCortesDelBarrio(buscar.sector)
  const [creando, setCreando] = useState(false)
  const tituloDetalle = useRef<HTMLHeadingElement>(null)
  const lateral = useRef<HTMLDivElement>(null)

  const porId = new Map((barrios.data ?? []).map((sector) => [sector.id ?? '', sector]))
  const nombreDe = (id: string) => nombreLegible(porId.get(id)?.nombre ?? id)

  const irA = (sector: string | undefined, corte?: string) => {
    setCreando(false)
    void navegar({ to: '/panel/cortes', search: { ...(sector ? { sector } : {}), ...(corte ? { corte } : {}) } })
  }

  // En el celular el detalle queda debajo de las listas: al abrir un corte se lleva a la vista y el foco al detalle.
  useEffect(() => {
    if (!buscar.corte) return
    lateral.current?.scrollIntoView?.({ block: 'start' })
    tituloDetalle.current?.focus({ preventScroll: true })
  }, [buscar.corte])

  function abrirVencido(corte: Corte) {
    const provisional = cierresProvisionales(corte)[0]?.sectorId
    const barrio = provisional ?? barriosPendientes(corte)[0] ?? corte.sectoresAfectados?.[0]
    irA(barrio, corte.id)
  }

  const colaVencidos = vencidos.data ?? []

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Cortes oficiales</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>{titularDe(vencidos.isPending, vencidos.isError, colaVencidos.length)}</h1>
      </header>
      {!puedeGestionar && (
        <p className={estilos.aviso}>Tu cuenta puede ver los cortes, pero no registrarlos, cerrarlos ni anularlos: faltan permisos de gestión.</p>
      )}
      <div className={estilos.barra}>
        <div className={estilos.selector}>
          <SelectorBarrio
            sectores={barrios.data ?? []}
            valor={buscar.sector}
            alCambiar={(id) => irA(id)}
            etiqueta="Barrio de los cortes"
            marcador="Elige un barrio"
            forma="pastilla"
          />
        </div>
        {puedeGestionar && (
          <Button className={botones.principal} onPress={() => setCreando(true)} isDisabled={creando}>
            Registrar un corte <span className={botones.flecha} aria-hidden="true">→</span>
          </Button>
        )}
      </div>
      {barrios.isError && (
        <p className={estilos.aviso} role="alert">
          No pudimos cargar la lista de barrios.{' '}
          <button type="button" className={estilos.reintentar} onClick={() => void barrios.refetch()}>Reintentar</button>
        </p>
      )}

      <div className={estilos.columnas} data-ancho="ancho">
        <div className={estilos.principal}>
          <section className={`${bloques.bloque} ${bloques.compacto}`} aria-labelledby="titulo-vencidos">
            <h2 id="titulo-vencidos" className={`${bloques.titulo} ${estilos.encabezado}`}>Vencidos</h2>
            <p className={bloques.bajada}>Cortes cuya promesa venció sin cierre y cortes con un cierre de los vecinos por confirmar, del más antiguo al más reciente.</p>
            {vencidos.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /></div>}
            {vencidos.isError && (
              <p role="alert" className={estilos.vacioBloque}>
                No pudimos consultar los cortes vencidos.{' '}
                <button type="button" className={estilos.reintentar} onClick={() => void vencidos.refetch()}>Reintentar</button>
              </p>
            )}
            {vencidos.data && colaVencidos.length === 0 && <p className={`${estilos.vacio} ${estilos.vacioBloque}`}>No hay cortes vencidos.</p>}
            {colaVencidos.length > 0 && (
              <ul className={estilos.lista}>
                {colaVencidos.map((corte) => {
                  const razon = razonDeVencido(corte)
                  const barriosTexto = barriosEnPalabras(corte.sectoresAfectados, nombreDe)
                  return (
                    <li key={corte.id}>
                      <button type="button" className={estilos.fila} aria-current={buscar.corte === corte.id ? 'true' : undefined} aria-label={`Abrir el corte de ${barriosTexto}: ${corte.causa ?? 'sin causa'}`} onClick={() => abrirVencido(corte)}>
                        <span className={estilos.quePaso}>{barriosTexto} · {corte.causa ?? 'Sin causa registrada'}</span>
                        <span className={estilos.flecha}><Icono nombre="avanzar" tamano={16} /></span>
                        <span className={estilos.detalleFila}>
                          {razon === 'cierre-provisional'
                            ? 'Los vecinos dieron por restablecido el servicio: falta tu confirmación.'
                            : corte.finPrometido ? `La promesa venció ${haceCuanto(corte.finPrometido, ahora)} y nadie lo cerró.` : 'La promesa venció y nadie lo cerró.'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={`${bloques.bloque} ${bloques.compacto}`} aria-labelledby="titulo-barrio">
            <h2 id="titulo-barrio" className={`${bloques.titulo} ${estilos.encabezado}`}>
              {buscar.sector ? `Cortes de ${nombreDe(buscar.sector)}` : 'Cortes de un barrio'}
            </h2>
            {!buscar.sector && <p className={`${estilos.vacio} ${estilos.vacioBloque}`}>Elige un barrio para ver sus cortes. El contrato no lista los cortes de toda la ciudad a la vez.</p>}
            {buscar.sector && cortes.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /></div>}
            {buscar.sector && cortes.isError && (
              <p role="alert" className={estilos.vacioBloque}>
                No pudimos consultar los cortes de este barrio.{' '}
                <button type="button" className={estilos.reintentar} onClick={() => void cortes.refetch()}>Reintentar</button>
              </p>
            )}
            {cortes.data && cortes.data.length === 0 && <p className={`${estilos.vacio} ${estilos.vacioBloque}`}>No hay cortes registrados para este barrio.</p>}
            {cortes.data && cortes.data.length > 0 && (
              <ul className={estilos.lista}>
                {masRecientesPrimero(cortes.data).map((corte) => (
                  <li key={corte.id}>
                    <button type="button" className={estilos.fila} aria-current={buscar.corte === corte.id ? 'true' : undefined} onClick={() => irA(buscar.sector, corte.id)}>
                      <span className={estilos.quePaso}>{corte.causa ?? 'Sin causa registrada'}</span>
                      <span className={estilos.flecha}><Icono nombre="avanzar" tamano={16} /></span>
                      <span className={estilos.detalleFila}>
                        {estadoDeCorteEnPalabras(corte.estado)} · {ventanaEnPalabras(corte.inicio, corte.finPrometido, ahora)}
                        {(corte.sectoresAfectados?.length ?? 0) > 1 ? ` · ${corte.sectoresAfectados?.length} barrios` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={estilos.lateral} data-fija ref={lateral}>
          {creando ? (
            <FormularioAlta
              barrios={barrios.data ?? []}
              alCancelar={() => setCreando(false)}
              alCreado={(corte) => irA(corte.sectoresAfectados?.[0] ?? buscar.sector, corte.id)}
            />
          ) : buscar.corte ? (
            <DetalleCorte key={buscar.corte} id={buscar.corte} nombreDe={nombreDe} puedeGestionar={puedeGestionar} ahora={ahora} ref={tituloDetalle} />
          ) : (
            <section className={bloques.bloque} aria-label="Detalle del corte">
              <p className={bloques.titulo}>Abre un corte</p>
              <p className={bloques.bajada}>Elige uno de los vencidos o de la lista del barrio para ver sus barrios, cerrarlos uno por uno, confirmar un cierre de los vecinos o anularlo.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
