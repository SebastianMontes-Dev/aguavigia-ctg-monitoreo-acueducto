import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from 'react-aria-components'
import type { ResultadoAccion } from '../../api/acciones-panel'
import { aprobarCuenta, cambiarAccesoDeCuenta, reactivarCuenta, rechazarCuenta, reenviarInvitacion, suspenderCuenta } from '../../api/administracion'
import { useAccion } from '../../app/datos-panel'
import botones from '../../componentes/Botones.module.css'
import { Seleccion } from '../../componentes/Seleccion'
import {
  accionesDeCuenta, ajusteDePermisos, AVISO_CIERRE_DE_SESIONES, confirmacionCuenta, esRolPanel, hayCambioDeAcceso, marcadosDelRol, marcadosIniciales,
  motivoSinAcciones, nombreDeCuenta, PERMISO_PROTEGIDO, PERMISOS_DEL_ROL, permisoEnPalabras, permisosDeCuenta, resumenDelAjuste, rolEnPalabras, ROLES_PANEL,
  type AccionCuenta, type CuentaPanel, type RolPanel,
} from '../../dominio/cuentas'
import { mensajeAccion, type ContextoAccion } from '../../dominio/mensajes-panel'
import { PERMISOS, type Permiso } from '../../dominio/permisos'
import estilos from './Gestion.module.css'
import propios from './Cuentas.module.css'

const CONTEXTOS: Record<AccionCuenta, ContextoAccion> = {
  reenviar: 'reenviar',
  aprobar: 'aprobar-cuenta',
  rechazar: 'rechazar-cuenta',
  suspender: 'suspender',
  reactivar: 'reactivar',
  permisos: 'acceso-cuenta',
}

const ETIQUETAS: Record<AccionCuenta, string> = {
  reenviar: 'Reenviar la invitación',
  aprobar: 'Aprobar con este acceso',
  rechazar: 'Rechazar',
  suspender: 'Suspender',
  reactivar: 'Reactivar',
  permisos: 'Cambiar rol y permisos',
}

const OPCIONES_ROL = ROLES_PANEL.map((rol) => ({ valor: rol, texto: rolEnPalabras(rol) }))

interface PropiedadesPanel {
  cuenta: CuentaPanel
  idPropio: string | undefined
  puedeGestionar: boolean
  /** Hecho o no, la página recibe el aviso: la fila puede desaparecer de la lista que se está viendo (otro estado). */
  alResolver: (aviso: string | null, hecho: boolean) => void
}

function Permisos({ cuenta }: { cuenta: CuentaPanel }) {
  const permisos = permisosDeCuenta(cuenta)
  return (
    <div className={propios.detalle}>
      <p className={propios.rotuloDetalle}>Permisos de panel</p>
      {permisos.length === 0
        ? <p className={estilos.vacio}>Sin permisos de panel.</p>
        : <ul className={propios.permisos}>{permisos.map((permiso) => <li key={permiso}>{permisoEnPalabras(permiso)}</li>)}</ul>}
    </div>
  )
}

interface PropiedadesEditor {
  children: ReactNode
  cuenta: CuentaPanel
  rol: RolPanel
  marcados: ReadonlySet<Permiso>
  alCambiarRol: (rol: RolPanel) => void
  alMarcar: (permiso: Permiso, marcado: boolean) => void
}

/** Las casillas son los permisos efectivos: `concedidos` y `revocados` salen de compararlas con el rol, nunca de dos listas a mano. */
function EditorDeAcceso({ children, cuenta, rol, marcados, alCambiarRol, alMarcar }: PropiedadesEditor) {
  const base = new Set<Permiso>(PERMISOS_DEL_ROL[rol])
  return (
    <div className={propios.editor}>
      <div className={propios.izquierda}>
        <Seleccion
          etiqueta={`Rol de ${nombreDeCuenta(cuenta)}`}
          value={rol}
          opciones={OPCIONES_ROL}
          onChange={(evento) => { if (esRolPanel(evento.target.value)) alCambiarRol(evento.target.value) }}
          ayuda="Al elegir otro rol, las casillas vuelven a los permisos de ese rol."
        />
        {children}
      </div>
      <fieldset className={propios.grupo}>
        <legend className={propios.rotuloDetalle}>Permisos sueltos sobre el rol</legend>
        <ul className={propios.casillas}>
          {PERMISOS.map((permiso) => {
            const protegido = permiso === PERMISO_PROTEGIDO
            const delRol = base.has(permiso)
            return (
              <li key={permiso}>
                <label className={propios.casilla}>
                  <input
                    type="checkbox"
                    checked={protegido || marcados.has(permiso)}
                    disabled={protegido}
                    onChange={(evento) => alMarcar(permiso, evento.target.checked)}
                  />
                  <span>
                    {permisoEnPalabras(permiso)}
                    <span className={propios.origen}>
                      {protegido ? ' · no se puede quitar' : delRol ? ' · lo trae el rol' : ' · suelto'}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
    </div>
  )
}

/**
 * El detalle de una cuenta y lo que se puede hacer con ella. Sobre la propia no hay acciones (autoprotección del ADMIN); cada
 * acción se confirma con el nombre de la cuenta y, si cierra sesiones, lo dice antes de pulsar.
 */
export function PanelCuenta({ cuenta, idPropio, puedeGestionar, alResolver }: PropiedadesPanel) {
  const cliente = useQueryClient()
  const { enviando, ejecutar } = useAccion()
  const [abierta, setAbierta] = useState<AccionCuenta | null>(null)
  const [fase, setFase] = useState<'editar' | 'confirmar'>('editar')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const inicial = marcadosIniciales(cuenta, 'OBSERVADOR')
  const [rol, setRol] = useState<RolPanel>(inicial.rol)
  const [marcados, setMarcados] = useState<Set<Permiso>>(inicial.marcados)
  const caja = useRef<HTMLFieldSetElement>(null)
  const acciones = useRef<HTMLDivElement>(null)
  const { propia, acciones: permitidas } = accionesDeCuenta(cuenta, idPropio)
  const ofrecidas = puedeGestionar ? permitidas : []
  const ajuste = ajusteDePermisos(rol, marcados)
  const cambia = abierta === 'permisos' ? hayCambioDeAcceso(cuenta, rol, marcados) : true
  const textos = abierta ? confirmacionCuenta(abierta, cuenta) : null
  const confirmando = abierta !== null && (fase === 'confirmar' || (abierta !== 'permisos' && abierta !== 'aprobar'))

  useEffect(() => {
    if (confirmando) caja.current?.focus()
  }, [confirmando])

  function abrir(accion: AccionCuenta) {
    setMensaje(null)
    const base = marcadosIniciales(cuenta, 'OBSERVADOR')
    setRol(base.rol)
    setMarcados(base.marcados)
    setFase('editar')
    setAbierta(accion)
  }

  function cancelar() {
    const anterior = abierta
    setAbierta(null)
    setFase('editar')
    queueMicrotask(() => {
      const controles = acciones.current?.querySelectorAll('button')
      const indice = anterior ? Math.max(0, ofrecidas.indexOf(anterior)) : 0
      controles?.[Math.min(indice, (controles?.length ?? 1) - 1)]?.focus()
    })
  }

  function cambiarRol(nuevo: RolPanel) {
    setRol(nuevo)
    setMarcados(marcadosDelRol(nuevo))
  }

  function marcar(permiso: Permiso, marcado: boolean) {
    setMarcados((actuales) => {
      const siguientes = new Set(actuales)
      if (marcado) siguientes.add(permiso)
      else siguientes.delete(permiso)
      return siguientes
    })
  }

  function llamada(accion: AccionCuenta): Promise<ResultadoAccion<unknown>> {
    const id = cuenta.id ?? ''
    switch (accion) {
      case 'reenviar': return reenviarInvitacion(id)
      case 'aprobar': return aprobarCuenta(id, ajuste)
      case 'rechazar': return rechazarCuenta(id)
      case 'suspender': return suspenderCuenta(id)
      case 'reactivar': return reactivarCuenta(id)
      case 'permisos': return cambiarAccesoDeCuenta(id, ajuste)
    }
  }

  async function confirmar(accion: AccionCuenta) {
    const resultado = await ejecutar(() => llamada(accion))
    if (!resultado) return
    const nombre = nombreDeCuenta(cuenta)
    if (resultado.tipo === 'hecho') {
      const dicho = confirmacionCuenta(accion, cuenta)
      alResolver(HECHO[accion](nombre) + (dicho.cierraSesiones ? ' Se cerraron sus sesiones abiertas.' : ''), true)
      void cliente.invalidateQueries({ queryKey: ['panel', 'cuentas'] })
      return
    }
    const texto = mensajeAccion(resultado, CONTEXTOS[accion])
    if (resultado.tipo === 'sin-permiso') void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
    if (resultado.tipo === 'conflicto' || resultado.tipo === 'no-existe') {
      // Lo que el servidor sabe de esta cuenta cambió: se vuelve a pedir la lista y lo que pasó se dice en la página.
      alResolver(texto, false)
      void cliente.invalidateQueries({ queryKey: ['panel', 'cuentas'] })
      return
    }
    setMensaje(texto)
    setAbierta(null)
    setFase('editar')
  }

  const hayAcciones = ofrecidas.length > 0
  const editando = (abierta === 'permisos' || abierta === 'aprobar') && fase === 'editar'

  return (
    <div className={propios.panel}>
      <div className={propios.cuerpoPanel}>
        {!editando && <Permisos cuenta={cuenta} />}
        <div className={propios.acciones} data-ancha={editando ? true : undefined}>
          <p className={propios.rotuloDetalle}>Qué puedes hacer</p>
          {hayAcciones && abierta === null && (
            <div className={estilos.acciones} ref={acciones}>
              {ofrecidas.map((accion) => (
                <Button
                  key={accion}
                  className={`${botones.secundario} ${estilos.accion}`}
                  isDisabled={enviando}
                  aria-label={`${ETIQUETAS[accion]}: ${nombreDeCuenta(cuenta)}`}
                  onPress={() => abrir(accion)}
                >
                  {ETIQUETAS[accion]}
                </Button>
              ))}
            </div>
          )}
          {!hayAcciones && (
            <p className={estilos.vacio}>
              {puedeGestionar ? motivoSinAcciones(cuenta, propia) : 'Tu cuenta puede ver las cuentas, pero no cambiarlas.'}
            </p>
          )}
          {(abierta === 'permisos' || abierta === 'aprobar') && fase === 'editar' && (
            <div className={propios.formularioAcceso}>
              <EditorDeAcceso cuenta={cuenta} rol={rol} marcados={marcados} alCambiarRol={cambiarRol} alMarcar={marcar}>
                {!cambia && <p className={estilos.vacio}>Todavía no cambiaste nada: este es el acceso que ya tiene.</p>}
                <div className={estilos.acciones}>
                  <Button className={botones.principal} isDisabled={!cambia} onPress={() => setFase('confirmar')}>
                    {abierta === 'aprobar' ? 'Revisar la aprobación' : 'Revisar el cambio'}
                  </Button>
                  <Button className={botones.secundario} onPress={cancelar}>Cancelar</Button>
                </div>
              </EditorDeAcceso>
            </div>
          )}
          {abierta && textos && confirmando && (
            <fieldset className={propios.confirmar} tabIndex={-1} ref={caja}>
              <legend className={estilos.oculto}>Confirmar: {ETIQUETAS[abierta]}</legend>
              <p><strong>{textos.pregunta}</strong></p>
              {(abierta === 'permisos' || abierta === 'aprobar') && (
                <ul className={propios.resumen}>{resumenDelAjuste(cuenta, ajuste).map((linea) => <li key={linea}>{linea}</li>)}</ul>
              )}
              {textos.cierraSesiones && <p>{AVISO_CIERRE_DE_SESIONES}</p>}
              <div className={estilos.acciones}>
                <Button className={botones.principal} isDisabled={enviando} onPress={() => void confirmar(abierta)}>
                  {enviando ? textos.enviando : textos.boton}
                </Button>
                <Button className={botones.secundario} isDisabled={enviando} onPress={() => (fase === 'confirmar' ? setFase('editar') : cancelar())}>
                  {fase === 'confirmar' ? 'Volver al acceso' : 'Cancelar'}
                </Button>
              </div>
            </fieldset>
          )}
          {mensaje && <p className={estilos.resultado} role="alert">{mensaje}</p>}
        </div>
      </div>
    </div>
  )
}

const HECHO: Record<AccionCuenta, (nombre: string) => string> = {
  reenviar: (nombre) => `Reenviamos la invitación a ${nombre}. El enlace anterior ya no sirve.`,
  aprobar: (nombre) => `Aprobamos la cuenta de ${nombre}.`,
  rechazar: (nombre) => `Rechazamos la solicitud de ${nombre}.`,
  suspender: (nombre) => `Suspendimos la cuenta de ${nombre}.`,
  reactivar: (nombre) => `Reactivamos la cuenta de ${nombre}.`,
  permisos: (nombre) => `Cambiamos el acceso de ${nombre}.`,
}
