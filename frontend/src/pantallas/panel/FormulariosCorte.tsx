import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { registrarCorte } from '../../api/cortes-veedor'
import { useAccion } from '../../app/datos-panel'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import type { Corte } from '../../dominio/cortes'
import { validarAlta, validarHoraCierre, type ErroresAlta } from '../../dominio/cortes-panel'
import { campoDesdeInstante } from '../../dominio/hora-cartagena'
import { mensajeAccion } from '../../dominio/mensajes-panel'
import { nombreLegible, type Sector } from '../../dominio/sectores'
import estilos from './Gestion.module.css'

interface PropiedadesHora {
  titulo: string
  boton: string
  enviandoTexto: string
  /** Un instante UTC; el campo lo muestra en la hora de Cartagena. */
  inicial: string
  corte: Corte
  ahora: Date
  enviando: boolean
  nota?: string
  alEnviar: (instante: string) => void
  alCancelar: () => void
}

/** La hora real de un cierre: un campo `datetime-local` en la hora de Cartagena, validado antes de enviar. */
export function FormularioHora({ titulo, boton, enviandoTexto, inicial, corte, ahora, enviando, nota, alEnviar, alCancelar }: PropiedadesHora) {
  const [valor, setValor] = useState(() => campoDesdeInstante(inicial))
  const [error, setError] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  // Quien pulsó «Cerrar» o «Anular» sigue en esa acción: el foco pasa al campo recién aparecido.
  useEffect(() => campo.current?.focus(), [])

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const resultado = validarHoraCierre(valor, corte, ahora)
    if (resultado.error !== undefined) {
      setError(resultado.error)
      campo.current?.focus()
      return
    }
    setError(null)
    alEnviar(resultado.instante)
  }

  return (
    <form className={estilos.formulario} onSubmit={enviar} noValidate aria-label={titulo}>
      <Campo
        etiqueta="Hora real (Hora de Cartagena)"
        tipo="fechaHora"
        value={valor}
        onChange={(evento) => setValor(evento.target.value)}
        error={error}
        ayuda="La hora en que el agua volvió, no la de ahora."
        ref={campo}
      />
      {nota && <p className={bloques.bajada}>{nota}</p>}
      <div className={estilos.acciones}>
        <Button type="submit" className={botones.principal} isDisabled={enviando}>{enviando ? enviandoTexto : boton}</Button>
        <Button className={botones.secundario} isDisabled={enviando} onPress={alCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

/** Anular un corte publicado por error: el motivo es obligatorio y queda en la bitácora pública y en la auditoría. */
export function FormularioAnulacion({ enviando, alEnviar, alCancelar }: { enviando: boolean; alEnviar: (motivo: string) => void; alCancelar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => campo.current?.focus(), [])

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    if (!motivo.trim()) {
      setError('Escribe por qué se anula el corte.')
      campo.current?.focus()
      return
    }
    setError(null)
    alEnviar(motivo.trim())
  }

  return (
    <form className={estilos.formulario} onSubmit={enviar} noValidate aria-label="Anular el corte">
      <Campo
        etiqueta="Motivo de la anulación"
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
        error={error}
        ayuda="Queda a la vista del público en la bitácora y en la auditoría. El corte sale del Índice de Cumplimiento."
        ref={campo}
      />
      <div className={estilos.acciones}>
        <Button type="submit" className={botones.principal} isDisabled={enviando}>{enviando ? 'Anulando…' : 'Sí, anular el corte'}</Button>
        <Button className={botones.secundario} isDisabled={enviando} onPress={alCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

interface PropiedadesAlta {
  barrios: readonly Sector[]
  alCreado: (corte: Corte) => void
  alCancelar: () => void
}

/** `POST /api/veedor/cortes`: barrios, inicio, fin prometido y causa; las fechas se escriben en la hora de Cartagena. */
export function FormularioAlta({ barrios, alCreado, alCancelar }: PropiedadesAlta) {
  const [elegidos, setElegidos] = useState<string[]>([])
  // Al añadir un barrio el selector se vuelve a montar, para que su lista se cierre y no tape los campos de abajo.
  const [vuelta, setVuelta] = useState(0)
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [causa, setCausa] = useState('')
  const [errores, setErrores] = useState<ErroresAlta>({})
  const [mensaje, setMensaje] = useState<string | null>(null)
  const { enviando, ejecutar } = useAccion()
  const cliente = useQueryClient()
  const campoInicio = useRef<HTMLInputElement>(null)
  const campoFin = useRef<HTMLInputElement>(null)
  const campoCausa = useRef<HTMLInputElement>(null)
  const selector = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (vuelta > 0) selector.current?.querySelector('input')?.focus()
  }, [vuelta])

  const nombreDe = (id: string) => nombreLegible(barrios.find((barrio) => barrio.id === id)?.nombre ?? id)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const { errores: nuevos, solicitud } = validarAlta({ barrios: elegidos, inicio, fin, causa })
    setErrores(nuevos)
    setMensaje(null)
    if (!solicitud) {
      if (nuevos.barrios) selector.current?.querySelector('input')?.focus()
      else if (nuevos.inicio) campoInicio.current?.focus()
      else if (nuevos.fin) campoFin.current?.focus()
      else campoCausa.current?.focus()
      return
    }
    const resultado = await ejecutar(() => registrarCorte(solicitud))
    if (!resultado) return
    if (resultado.tipo === 'hecho') {
      void cliente.invalidateQueries({ queryKey: ['panel', 'cortes'] })
      alCreado(resultado.dato)
      return
    }
    if (resultado.tipo === 'sin-permiso') void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
    setMensaje(mensajeAccion(resultado, 'alta'))
  }

  return (
    <form className={`${bloques.bloque}`} onSubmit={(evento) => void enviar(evento)} noValidate aria-labelledby="titulo-alta">
      <p className={bloques.rotulo}>Corte nuevo</p>
      <h2 id="titulo-alta" className={bloques.titulo} tabIndex={-1}>Registrar un corte oficial</h2>
      <div className={estilos.campoGrupo} ref={selector}>
        <span className={estilos.etiquetaGrupo} aria-hidden="true">Barrios afectados</span>
        <SelectorBarrio
          key={vuelta}
          sectores={barrios}
          forma="pastilla"
          etiqueta="Barrios afectados"
          marcador="Busca un barrio para añadirlo"
          alCambiar={(id) => {
            if (id && !elegidos.includes(id)) setElegidos([...elegidos, id])
            setVuelta(vuelta + 1)
          }}
        />
        {elegidos.length > 0 && (
          <ul className={estilos.elegidos} aria-label="Barrios elegidos">
            {elegidos.map((id) => (
              <li key={id} className={estilos.elegido}>
                {nombreDe(id)}
                <button type="button" className={estilos.quitar} aria-label={`Quitar ${nombreDe(id)}`} onClick={() => setElegidos(elegidos.filter((otro) => otro !== id))}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
        {errores.barrios && <p className={campos.error} role="alert">{errores.barrios}</p>}
      </div>
      <Campo etiqueta="Inicio (Hora de Cartagena)" tipo="fechaHora" value={inicio} onChange={(evento) => setInicio(evento.target.value)} error={errores.inicio} ref={campoInicio} />
      <Campo
        etiqueta="Fin prometido (Hora de Cartagena)"
        tipo="fechaHora"
        value={fin}
        onChange={(evento) => setFin(evento.target.value)}
        error={errores.fin}
        ayuda="Si el inicio ya pasó, los barrios quedan sin servicio desde ahora; si es futuro, quedan como corte programado."
        ref={campoFin}
      />
      <Campo etiqueta="Causa" value={causa} onChange={(evento) => setCausa(evento.target.value)} error={errores.causa} ayuda="Con las palabras de la fuente: «Mantenimiento de la línea de 24 pulgadas»." ref={campoCausa} />
      {mensaje && <p className={campos.error} role="alert">{mensaje}</p>}
      <div className={estilos.acciones}>
        <Button type="submit" className={botones.principal} isDisabled={enviando}>{enviando ? 'Registrando…' : 'Registrar corte'}</Button>
        <Button className={botones.secundario} isDisabled={enviando} onPress={alCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}
