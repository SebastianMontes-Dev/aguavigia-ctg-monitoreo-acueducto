import { useQueryClient } from '@tanstack/react-query'
import { forwardRef, useState } from 'react'
import { Button } from 'react-aria-components'
import type { ResultadoAccion } from '../../api/acciones-panel'
import { anularCorte, cerrarBarrio, cerrarCorte, confirmarCierre } from '../../api/cortes-veedor'
import { useAccion, useCorteDelPanel } from '../../app/datos-panel'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { cierreDe, estaAbierto, fuenteEnPalabras, origenEnPalabras, sinHoraRealEnPalabras, type Corte } from '../../dominio/cortes'
import { admiteAnulacion, admiteCierres, barriosPendientes, estadoDeCorteEnPalabras } from '../../dominio/cortes-panel'
import { mensajeAccion, type ContextoAccion } from '../../dominio/mensajes-panel'
import { fechaCorta, formatearHora, momento } from '../../dominio/tiempo'
import { FormularioAnulacion, FormularioHora } from './FormulariosCorte'
import estilos from './Gestion.module.css'

type Abierta =
  | { tipo: 'cerrar-todos' }
  | { tipo: 'cerrar-barrio'; sectorId: string }
  | { tipo: 'confirmar'; sectorId: string }
  | { tipo: 'anular' }

interface Props {
  id: string
  nombreDe: (id: string) => string
  puedeGestionar: boolean
  ahora: Date
}

function estadoDelBarrio(corte: Corte, sectorId: string, ahora: Date): string {
  const cierre = cierreDe(corte, sectorId)
  if (cierre?.hora) {
    const cuando = momento(cierre.hora, ahora)
    const fuente = fuenteEnPalabras(cierre.fuente)
    return cierre.provisional
      ? `Cierre provisional ${cuando}: lo sostienen reportes de vecinos y falta tu confirmación.`
      : `Cerrado ${cuando}${fuente ? ` · ${fuente}` : ''}.`
  }
  return estaAbierto(corte) ? 'Sigue pendiente de cierre.' : 'Sin cierre registrado.'
}

/** El detalle de un corte: sus datos, un renglón por barrio con su cierre y las acciones que su estado admite. */
export const DetalleCorte = forwardRef<HTMLHeadingElement, Props>(function DetalleCorte({ id, nombreDe, puedeGestionar, ahora }, titulo) {
  const consulta = useCorteDelPanel(id)
  const cliente = useQueryClient()
  const { enviando, ejecutar } = useAccion()
  const [abierta, setAbierta] = useState<Abierta | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (consulta.isPending) return <output className={`${bloques.bloque} ${estilos.vacio}`}>Consultando el corte…</output>
  if (consulta.isError || !consulta.data) {
    return (
      <section className={bloques.bloque}>
        <p role="alert">
          No pudimos consultar este corte.{' '}
          <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
        </p>
      </section>
    )
  }

  const corte = consulta.data
  const pendientes = barriosPendientes(corte)
  const motivoSinHora = sinHoraRealEnPalabras(corte)

  /** Devuelve `true` si la acción ya no tiene sentido repetirla (se hizo o el servidor dice que el corte cambió). */
  async function aplicar(contexto: ContextoAccion, llamada: () => Promise<ResultadoAccion<Corte>>) {
    const resultado = await ejecutar(llamada)
    if (!resultado) return
    if (resultado.tipo === 'hecho') {
      cliente.setQueryData(['panel', 'cortes', 'detalle', id], resultado.dato)
      void cliente.invalidateQueries({ queryKey: ['panel', 'cortes'] })
      setMensaje(null)
      setAbierta(null)
      return
    }
    if (resultado.tipo === 'conflicto' || resultado.tipo === 'no-existe') void cliente.invalidateQueries({ queryKey: ['panel', 'cortes'] })
    if (resultado.tipo === 'sin-permiso') void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
    setMensaje(mensajeAccion(resultado, contexto))
    if (resultado.tipo === 'conflicto' || resultado.tipo === 'no-existe' || resultado.tipo === 'sin-permiso') setAbierta(null)
  }

  function abrir(accion: Abierta) {
    setMensaje(null)
    setAbierta(accion)
  }

  const ocupado = enviando || abierta !== null

  return (
    <section className={bloques.bloque} aria-labelledby="titulo-detalle">
      <p className={bloques.rotulo}>{estadoDeCorteEnPalabras(corte.estado)}</p>
      <h2 id="titulo-detalle" className={bloques.titulo} tabIndex={-1} ref={titulo}>{corte.causa || 'Corte sin causa registrada'}</h2>
      <dl className={bloques.cifras}>
        <div><dt>{corte.inicio ? `Empezó · ${fechaCorta(corte.inicio, ahora)}` : 'Empezó'}</dt><dd>{corte.inicio ? formatearHora(corte.inicio) : 'Sin dato'}</dd></div>
        <div><dt>{corte.finPrometido ? `Prometido hasta · ${fechaCorta(corte.finPrometido, ahora)}` : 'Prometido hasta'}</dt><dd>{corte.finPrometido ? formatearHora(corte.finPrometido) : 'Sin dato'}</dd></div>
      </dl>
      <p className={bloques.bajada}>
        {origenEnPalabras(corte.origen) ?? 'Origen no registrado'}
        {corte.caducaEn ? ` · deja de afirmar ${momento(corte.caducaEn, ahora)}` : ''}
      </p>
      {motivoSinHora && <p className={estilos.aviso}>{motivoSinHora}</p>}
      {mensaje && <p className={estilos.aviso} role="alert">{mensaje}</p>}

      <div>
        {(corte.sectoresAfectados ?? []).map((sectorId) => {
          const cierre = cierreDe(corte, sectorId)
          const nombre = nombreDe(sectorId)
          const pendiente = !cierre && estaAbierto(corte)
          const provisional = cierre?.provisional === true
          const formulario = abierta && 'sectorId' in abierta && abierta.sectorId === sectorId ? abierta : null
          return (
            <div className={estilos.barrio} key={sectorId}>
              <div className={estilos.barrioCabeza}>
                <span className={estilos.barrioNombre}>{nombre}</span>
                <span className={estilos.barrioEstado}>{estadoDelBarrio(corte, sectorId, ahora)}</span>
              </div>
              {puedeGestionar && !formulario && (pendiente || provisional) && (
                <div className={estilos.acciones}>
                  {pendiente && (
                    <Button className={`${botones.secundario} ${estilos.accion}`} aria-label={`Cerrar este barrio ${nombre}`} isDisabled={ocupado} onPress={() => abrir({ tipo: 'cerrar-barrio', sectorId })}>
                      Cerrar este barrio
                    </Button>
                  )}
                  {provisional && (
                    <Button className={`${botones.secundario} ${estilos.accion}`} aria-label={`Confirmar el cierre de ${nombre}`} isDisabled={ocupado} onPress={() => abrir({ tipo: 'confirmar', sectorId })}>
                      Confirmar el cierre
                    </Button>
                  )}
                </div>
              )}
              {formulario?.tipo === 'cerrar-barrio' && (
                <FormularioHora
                  titulo={`Cerrar ${nombre}`}
                  boton="Cerrar el barrio"
                  enviandoTexto="Cerrando…"
                  inicial={ahora.toISOString()}
                  corte={corte}
                  ahora={ahora}
                  enviando={enviando}
                  alEnviar={(instante) => void aplicar('cierre-barrio', () => cerrarBarrio(id, sectorId, instante))}
                  alCancelar={() => setAbierta(null)}
                />
              )}
              {formulario?.tipo === 'confirmar' && (
                <FormularioHora
                  titulo={`Confirmar el cierre de ${nombre}`}
                  boton="Confirmar el cierre"
                  enviandoTexto="Confirmando…"
                  inicial={cierre?.hora ?? ahora.toISOString()}
                  corte={corte}
                  ahora={ahora}
                  enviando={enviando}
                  nota="Si la hora de los vecinos no es la correcta, corrígela antes de confirmar."
                  alEnviar={(instante) => void aplicar('confirmacion', () => confirmarCierre(id, sectorId, instante))}
                  alCancelar={() => setAbierta(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {puedeGestionar && (admiteCierres(corte) || admiteAnulacion(corte)) && (
        <div className={estilos.pie}>
          {abierta?.tipo === 'cerrar-todos' ? (
            <FormularioHora
                titulo="Cerrar los barrios pendientes"
                boton={`Cerrar los ${pendientes.length} barrios`}
                enviandoTexto="Cerrando…"
                inicial={ahora.toISOString()}
                corte={corte}
                ahora={ahora}
                enviando={enviando}
                nota="Los barrios que ya cerraron se respetan. Cuando todos están cerrados, el corte pasa a restablecido y cuenta para el Índice."
                alEnviar={(instante) => void aplicar('cierre', () => cerrarCorte(id, instante))}
                alCancelar={() => setAbierta(null)}
              />
          ) : abierta?.tipo === 'anular' ? (
            <FormularioAnulacion enviando={enviando} alEnviar={(motivo) => void aplicar('anulacion', () => anularCorte(id, motivo))} alCancelar={() => setAbierta(null)} />
          ) : (
            <>
              {admiteCierres(corte) && pendientes.length > 1 && (
                <Button className={`${botones.secundario} ${estilos.accion}`} isDisabled={ocupado} onPress={() => abrir({ tipo: 'cerrar-todos' })}>
                  Cerrar los {pendientes.length} barrios pendientes
                </Button>
              )}
              {admiteAnulacion(corte) && (
                <Button className={`${botones.secundario} ${estilos.accion}`} isDisabled={ocupado} onPress={() => abrir({ tipo: 'anular' })}>
                  Anular el corte
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {!puedeGestionar && <p className={bloques.bajada}>Tu cuenta puede ver los cortes, pero no cerrarlos ni anularlos: faltan permisos de gestión.</p>}
    </section>
  )
})
