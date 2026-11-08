import { useState } from 'react'
import { useIndiceCorte } from '../app/datos'
import { indiceCompleto, significadoIndice, solidezIndice } from '../dominio/cumplimiento'
import { formatearNumero, formatearPorcentaje } from '../dominio/formato'
import type { Corte } from '../dominio/cortes'
import estilos from './CortesCerrados.module.css'

function Contenido({ corte }: { corte: Corte }) {
  const consulta = useIndiceCorte(corte.id ?? '', true)
  const estado = (consulta.error as { estado?: number } | null)?.estado
  if (consulta.isPending) return <p className={estilos.detalle}>Consultando el índice del corte…</p>
  if (estado === 409) return <p className={estilos.detalle}>Todavía no se puede medir: falta el cierre de algún barrio.</p>
  if (consulta.isError || !indiceCompleto(consulta.data)) {
    return (
      <p className={estilos.detalle} role="alert">
        No pudimos consultar el índice de este corte.{' '}
        <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
      </p>
    )
  }
  const indice = consulta.data
  return (
    <>
      <p className={estilos.detalle}>
        <strong>Índice {formatearPorcentaje(indice.porcentajeCumplimiento)}</strong>: {significadoIndice(indice.porcentajeCumplimiento)}.
      </p>
      {solidezIndice(indice).map((frase) => <p key={frase} className={estilos.detalle}>{frase}</p>)}
    </>
  )
}

/**
 * Guía §5.2: el índice del corte entero, detrás de una acción y pedido al abrir. Solo para un corte de varios barrios:
 * con uno solo repetiría lo que la fila ya dice (`identidad.md` §4.1).
 */
export function IndiceCorte({ corte }: { corte: Corte }) {
  const [abierto, setAbierto] = useState(false)
  const barrios = corte.sectoresAfectados?.length ?? 0
  if (barrios < 2 || !corte.id) return null
  return (
    <details className={estilos.todoElCorte} onToggle={(evento) => setAbierto(evento.currentTarget.open)}>
      <summary>Todo el corte ({formatearNumero(barrios)} barrios)</summary>
      {abierto && <Contenido corte={corte} />}
    </details>
  )
}
