import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { actualizarPerfil, cerrarSesionVecino, verificarBarrio, type PerfilVecino as Perfil, type ResultadoPerfil, type ResultadoVerificacion } from '../../api/vecino'
import { useBarrios } from '../../app/datos'
import { Redirigir } from '../../app/Redirigir'
import { pedirUbicacion, type ResultadoUbicacion } from '../../app/ubicacion'
import { useHaySesionVecino, usePerfilVecino } from '../../app/vecino'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import { Casilla } from '../../componentes/Casilla'
import { Icono } from '../../componentes/Icono'
import { SelectorBarrio } from '../../componentes/SelectorBarrio'
import blo from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { mensajePerfil, mensajeVerificacion } from '../../dominio/mensajes-cuenta'
import { nombreLegible, type Sector } from '../../dominio/sectores'
import { fechaYHora } from '../../dominio/tiempo'
import avisos from '../publico/Avisos.module.css'
import pagina from '../publico/Pagina.module.css'
import estilos from './Cuenta.module.css'

const CONSENTIMIENTOS: Record<string, string> = { PRIVACIDAD: 'Aviso de privacidad aceptado', AVISOS: 'Avisos de cortes de tu barrio aceptados' }

type Fallo = Exclude<ResultadoUbicacion, { tipo: 'ubicada' }> | Exclude<ResultadoVerificacion, { tipo: 'verificado' }>

/** Arriba va la respuesta: de qué barrio eres y si lo verificaste. El botón para verificarlo, ahí mismo (guía §5.5). */
function Respuesta({ perfil, barrio, alVerificar, alConflicto }: { perfil: Perfil; barrio: string; alVerificar: (perfil: Perfil) => void; alConflicto: () => void }) {
  const [buscando, setBuscando] = useState(false)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const verificado = perfil.barrioVerificado === true
  // La lectura del GPS puede tardar 15 s: si mientras tanto se salió de la pantalla, la respuesta tardía no toca nada.
  const vigente = useRef(true)
  useEffect(() => {
    vigente.current = true
    return () => { vigente.current = false }
  }, [])

  async function verificar() {
    if (buscando) return
    setBuscando(true)
    setFallo(null)
    try {
      // La ubicación se pide en este momento y no se guarda en ninguna parte: ni aquí (no pasa por `recordarUbicacion`) ni en el servidor.
      const ubicacion = await pedirUbicacion()
      if (!vigente.current) return
      if (ubicacion.tipo !== 'ubicada') {
        setFallo(ubicacion)
        return
      }
      const resultado = await verificarBarrio(ubicacion)
      if (!vigente.current) return
      if (resultado.tipo === 'verificado') alVerificar(resultado.perfil)
      else setFallo(resultado)
      if (resultado.tipo === 'conflicto') alConflicto()
    } finally {
      if (vigente.current) setBuscando(false)
    }
  }

  const mensaje = fallo ? mensajeVerificacion(fallo, barrio) : null

  return (
    <section className={`${blo.bloque} ${blo.tenido} ${estilos.respuesta}`} aria-label="Estado de tu barrio">
      <div className={estilos.respuestaTexto}>
        <p className={blo.rotulo}>Tu barrio</p>
        <p className={estilos.verificacion}>
          <Icono nombre="ubicacion" tamano={24} />
          {verificado ? `${barrio}: verificado` : `${barrio}: sin verificar`}
        </p>
        <p className={estilos.detalle}>
          {verificado && perfil.barrioVerificadoEn
            // «a. m.» ya termina en punto: no se le suma otro.
            ? `Lo verificaste el ${fechaYHora(perfil.barrioVerificadoEn).replace(/\.?$/, '.')} Tus reportes en ${barrio} llegan marcados como de cuenta verificada.`
            : 'Verifícalo con tu ubicación de ahora: así tus reportes en tu barrio llegan marcados como de cuenta verificada.'}
        </p>
      </div>
      {!verificado && (
        <div className={estilos.accionVerificar}>
          <Button className={botones.principal} onPress={() => void verificar()} isDisabled={buscando}>
            {buscando ? 'Buscando tu ubicación…' : <>Verificar con mi ubicación <span className={botones.flecha} aria-hidden="true">→</span></>}
          </Button>
          <p className={estilos.detalle}>No se guarda tu ubicación. Tienes 3 intentos al día.</p>
          {mensaje && <p className={campos.error} role="alert">{mensaje}</p>}
        </div>
      )}
    </section>
  )
}

function Datos({ perfil, barrios, alGuardar, alConflicto }: {
  perfil: Perfil
  barrios: readonly Sector[]
  alGuardar: (perfil: Perfil) => void
  alConflicto: () => void
}) {
  const [nombre, setNombre] = useState(perfil.nombre ?? '')
  const [barrioId, setBarrioId] = useState(perfil.barrioId)
  const [recibeAvisos, setRecibeAvisos] = useState(perfil.recibeAvisos === true)
  const [errores, setErrores] = useState<{ nombre?: string; barrio?: string }>({})
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoPerfil | null>(null)
  const [guardado, setGuardado] = useState(false)
  const campoNombre = useRef<HTMLInputElement>(null)
  const confirmar = useRef<HTMLButtonElement>(null)
  // Tras un conflicto el perfil se vuelve a pedir y el formulario toma sus valores (nada de lo que se editó pisa lo que cambió afuera).
  const esperandoPerfil = useRef(false)

  useEffect(() => {
    if (!esperandoPerfil.current) return
    esperandoPerfil.current = false
    setNombre(perfil.nombre ?? '')
    setBarrioId(perfil.barrioId)
    setRecibeAvisos(perfil.recibeAvisos === true)
  }, [perfil])

  const cambios = {
    ...(nombre.trim() !== (perfil.nombre ?? '') ? { nombre: nombre.trim() } : {}),
    ...(barrioId !== perfil.barrioId ? { barrioId } : {}),
    ...(recibeAvisos !== (perfil.recibeAvisos === true) ? { recibirAvisos: recibeAvisos } : {}),
  }
  const hayCambios = Object.keys(cambios).length > 0
  // Cambiar de barrio anula la verificación (cuentas-y-sesion.md): se avisa antes y se confirma aparte.
  const anulariaVerificacion = perfil.barrioVerificado === true && cambios.barrioId !== undefined

  useEffect(() => {
    if (confirmando) confirmar.current?.focus()
  }, [confirmando])

  async function guardar() {
    setGuardando(true)
    setResultado(null)
    setGuardado(false)
    const respuesta = await actualizarPerfil(cambios)
    setGuardando(false)
    setConfirmando(false)
    if (respuesta.tipo === 'guardado') {
      setGuardado(true)
      alGuardar(respuesta.perfil)
      return
    }
    if (respuesta.tipo === 'conflicto') {
      esperandoPerfil.current = true
      alConflicto()
    }
    if (respuesta.tipo === 'rechazado') {
      setErrores({ ...(respuesta.campos.nombre ? { nombre: respuesta.campos.nombre } : {}), ...(respuesta.campos.barrioId ? { barrio: respuesta.campos.barrioId } : {}) })
    }
    setResultado(respuesta)
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !hayCambios) return
    if (!nombre.trim()) {
      setErrores({ nombre: 'Escribe tu nombre.' })
      campoNombre.current?.focus()
      return
    }
    setErrores({})
    if (anulariaVerificacion) {
      setConfirmando(true)
      return
    }
    void guardar()
  }

  const mensaje = resultado ? mensajePerfil(resultado) : null

  return (
    <form className={`${blo.bloque} ${estilos.formulario}`} onSubmit={enviar} noValidate aria-labelledby="titulo-datos">
      <h2 id="titulo-datos" className={blo.titulo}>Tus datos</h2>
      <Campo etiqueta="Nombre" autoComplete="name" value={nombre} onChange={(evento) => { setNombre(evento.target.value); setGuardado(false) }} error={errores.nombre} ref={campoNombre} />
      <div className={estilos.fila2}>
        <SelectorBarrio
          forma="campo"
          etiquetaVisible
          sinQuitar
          sectores={barrios}
          valor={barrioId}
          etiqueta="Tu barrio"
          marcador="Busca tu barrio"
          alCambiar={(id) => { if (id) { setBarrioId(id); setGuardado(false); setConfirmando(false) } }}
        />
        {errores.barrio && <p className={campos.error} role="alert">{errores.barrio}</p>}
      </div>
      <Casilla
        checked={recibeAvisos}
        onChange={(evento) => { setRecibeAvisos(evento.target.checked); setGuardado(false) }}
        etiqueta="Quiero recibir por correo los avisos de cortes de mi barrio."
      />
      {confirmando && (
        <div className={estilos.advertencia} role="alertdialog" aria-labelledby="titulo-cambio">
          <strong id="titulo-cambio">¿Cambiar de barrio?</strong>
          <p>Cambiar de barrio borra la verificación de tu barrio actual. Tendrás que verificar el nuevo con tu ubicación.</p>
          <div className={estilos.botones}>
            <button ref={confirmar} type="button" className={botones.secundario} onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Cambiar y borrar la verificación'}
            </button>
            <button type="button" className={avisos.enlace} onClick={() => setConfirmando(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {mensaje && <p className={campos.error} role="alert">{mensaje}</p>}
      {guardado && <output className={estilos.nota}>Guardamos tus cambios.</output>}
      {!confirmando && (
        <Button type="submit" className={`${botones.principal} ${botones.ancho}`} isDisabled={guardando || !hayCambios}>
          {guardando ? 'Guardando…' : <>Guardar cambios <span className={botones.flecha} aria-hidden="true">→</span></>}
        </Button>
      )}
    </form>
  )
}

function Cuenta({ perfil }: { perfil: Perfil }) {
  const navegar = useNavigate()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await cerrarSesionVecino()
    void navegar({ to: '/vecino/ingreso', search: { motivo: 'cerrada' }, replace: true })
  }

  return (
    <section className={`${blo.bloque}`} aria-labelledby="titulo-cuenta">
      <h2 id="titulo-cuenta" className={blo.titulo}>Tu cuenta</h2>
      <dl className={estilos.datos}>
        <div><dt>Correo</dt><dd>{perfil.correo}</dd></div>
        {(perfil.consentimientos ?? []).map((consentimiento) => (
          <div key={consentimiento.tipo}>
            <dt>{CONSENTIMIENTOS[consentimiento.tipo ?? ''] ?? consentimiento.tipo}</dt>
            <dd>{consentimiento.fecha ? fechaYHora(consentimiento.fecha) : 'Sin fecha de registro'}</dd>
          </div>
        ))}
      </dl>
      <p className={estilos.nota}>Cerrar la sesión la cierra también en los demás equipos donde la tengas abierta.</p>
      <div className={estilos.botones}>
        <Button className={botones.secundario} onPress={() => void salir()} isDisabled={saliendo}>
          {saliendo ? 'Cerrando…' : 'Cerrar todas mis sesiones'}
        </Button>
        <Link to="/" className={avisos.enlace}>Ver el mapa</Link>
      </div>
    </section>
  )
}

/** `GET /api/vecino/yo` y `PATCH /api/vecino/perfil`. Sin sesión, o con una que murió, lleva al ingreso (`401` ya la borró). */
export function PerfilVecino() {
  const haySesion = useHaySesionVecino()
  const [tuvoSesion, setTuvoSesion] = useState(haySesion)
  const perfil = usePerfilVecino()
  const barrios = useBarrios()
  const cliente = useQueryClient()

  if (haySesion && !tuvoSesion) setTuvoSesion(true)
  if (!haySesion) return <Redirigir destino={{ to: '/vecino/ingreso', search: tuvoSesion ? { motivo: 'vencida' } : {} }} />

  const guardarPerfil = (nuevo: Perfil) => cliente.setQueryData(['vecino', 'yo'], nuevo)
  const refrescar = () => void cliente.invalidateQueries({ queryKey: ['vecino', 'yo'] })
  const sector = barrios.data?.find((barrio) => barrio.id === perfil.data?.barrioId)
  const nombreBarrio = sector ? nombreLegible(sector.nombre) : 'tu barrio'

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={avisos.rotulo}>Tu cuenta de vecino</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>
          {perfil.data?.nombre ? `${perfil.data.nombre}, vecino de ${nombreBarrio}` : 'Tu cuenta de vecino'}
        </h1>
      </header>
      {perfil.isPending ? (
        <output className={avisos.nota}>Consultando tu perfil…</output>
      ) : perfil.isError || !perfil.data ? (
        <p role="alert">
          No pudimos cargar tu perfil.{' '}
          <button type="button" className={avisos.enlace} onClick={() => void perfil.refetch()}>Volver a intentar</button>
        </p>
      ) : (
        <>
          <Respuesta key={perfil.data.barrioId} perfil={perfil.data} barrio={nombreBarrio} alVerificar={guardarPerfil} alConflicto={refrescar} />
          <div className={estilos.dos}>
            <Datos
              perfil={perfil.data}
              barrios={barrios.data ?? []}
              alGuardar={guardarPerfil}
              alConflicto={refrescar}
            />
            <Cuenta perfil={perfil.data} />
          </div>
        </>
      )}
    </div>
  )
}
