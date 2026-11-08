import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from 'react-aria-components'
import { invitarCuenta, SALTOS_SEGUIDOS } from '../../api/administracion'
import type { ErrorApi } from '../../api/cliente'
import { useCuentas, useColaDeCuentas, useAccion, useBarriosPanel } from '../../app/datos-panel'
import { usePaletaGrafito } from '../../app/paleta'
import { useCuentaActual, usePermisos } from '../../app/panel'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { Campo } from '../../componentes/Campo'
import campos from '../../componentes/Campo.module.css'
import { Seleccion } from '../../componentes/Seleccion'
import {
  contarReales, estadoCuentaEnPalabras, ESTADOS_CUENTA, esRolPanel, FRASE_SINTETICAS, nombreDeCuenta, permisoEnPalabras, permisosEnPalabras,
  PERMISOS_DEL_ROL, rolEnPalabras, ROLES_PANEL, separarSinteticas, type CuentaPanel, type RolPanel,
} from '../../dominio/cuentas'
import { formatearNumero } from '../../dominio/formato'
import { mensajeAccion } from '../../dominio/mensajes-panel'
import { nombreLegible } from '../../dominio/sectores'
import { fechaCorta } from '../../dominio/tiempo'
import { useAhora } from '../../app/ahora'
import pagina from '../publico/Pagina.module.css'
import propios from './Cuentas.module.css'
import estilos from './Gestion.module.css'
import { PanelCuenta } from './PanelCuenta'

const OPCIONES_ESTADO = [{ valor: '', texto: 'Todos los estados' }, ...ESTADOS_CUENTA.map((estado) => ({ valor: estado, texto: estadoCuentaEnPalabras(estado) }))]
const OPCIONES_ROL = ROLES_PANEL.map((rol) => ({ valor: rol, texto: rolEnPalabras(rol) }))

interface ErroresInvitacion {
  nombre?: string
  correo?: string
}

function FormularioInvitacion({ alTerminar, alCancelar }: { alTerminar: (aviso: string) => void; alCancelar: () => void }) {
  const cliente = useQueryClient()
  const { enviando, ejecutar } = useAccion()
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState<RolPanel>('OBSERVADOR')
  const [errores, setErrores] = useState<ErroresInvitacion>({})
  const [general, setGeneral] = useState<string | null>(null)
  const campoNombre = useRef<HTMLInputElement>(null)
  const campoCorreo = useRef<HTMLInputElement>(null)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const nuevos: ErroresInvitacion = {}
    if (!nombre.trim()) nuevos.nombre = 'Escribe el nombre de la persona.'
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) nuevos.correo = 'Escribe un correo con esta forma: nombre@dominio.org.'
    setErrores(nuevos)
    setGeneral(null)
    if (nuevos.nombre || nuevos.correo) {
      ;(nuevos.nombre ? campoNombre : campoCorreo).current?.focus()
      return
    }
    const resultado = await ejecutar(() => invitarCuenta({ correo: correo.trim(), nombre: nombre.trim(), rol }))
    if (!resultado) return
    if (resultado.tipo === 'hecho') {
      void cliente.invalidateQueries({ queryKey: ['panel', 'cuentas'] })
      alTerminar(`Invitamos a ${nombre.trim()} (${correo.trim()}) como ${rolEnPalabras(rol).toLowerCase()}. Le llegó un correo para elegir su clave; el enlace vale 7 días.`)
      return
    }
    const texto = mensajeAccion(resultado, 'invitar')
    if (resultado.tipo === 'conflicto') {
      setErrores({ correo: texto ?? undefined })
      campoCorreo.current?.focus()
      return
    }
    if (resultado.tipo === 'sin-permiso') void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
    setGeneral(texto)
  }

  const permisos = PERMISOS_DEL_ROL[rol].map(permisoEnPalabras).join(', ')

  return (
    <form className={propios.invitar} onSubmit={(evento) => void enviar(evento)} noValidate aria-labelledby="titulo-invitar">
      <h2 id="titulo-invitar" className={estilos.tituloLateral}>Invitar a una persona al panel</h2>
      <div className={propios.camposInvitacion}>
        <Campo etiqueta="Nombre" autoComplete="off" value={nombre} onChange={(evento) => setNombre(evento.target.value)} error={errores.nombre} ref={campoNombre} />
        <Campo etiqueta="Correo" tipo="correo" autoComplete="off" value={correo} onChange={(evento) => setCorreo(evento.target.value)} error={errores.correo} ref={campoCorreo} />
        <Seleccion
          etiqueta="Rol"
          value={rol}
          opciones={OPCIONES_ROL}
          onChange={(evento) => { if (esRolPanel(evento.target.value)) setRol(evento.target.value) }}
          ayuda={`Puede: ${permisos}.`}
        />
      </div>
      {general && <p className={campos.error} role="alert">{general}</p>}
      <div className={estilos.acciones}>
        <Button type="submit" className={botones.principal} isDisabled={enviando}>{enviando ? 'Enviando…' : 'Enviar la invitación'}</Button>
        <Button className={botones.secundario} isDisabled={enviando} onPress={alCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

function textoDeEstadoVacio(filtrado: boolean): string {
  return filtrado ? 'Ninguna cuenta coincide con esos filtros.' : 'Todavía no hay cuentas en el panel.'
}

interface PropiedadesFila {
  cuenta: CuentaPanel
  idPropio: string | undefined
  puedeGestionar: boolean
  abierta: boolean
  barrio: string | null
  ahora: Date
  alAlternar: () => void
  alResolver: (aviso: string | null, hecho: boolean) => void
}

function FilaCuenta({ cuenta, idPropio, puedeGestionar, abierta, barrio, ahora, alAlternar, alResolver }: PropiedadesFila) {
  const nombre = nombreDeCuenta(cuenta)
  const propia = idPropio !== undefined && cuenta.id === idPropio
  return (
    <>
      <tr className={propios.fila} data-abierta={abierta ? true : undefined}>
        <td data-etiqueta="Cuenta" className={propios.celdaCuenta}>
          <div className={propios.datosCuenta}>
            <span className={propios.nombre}>{nombre}{propia && <span className={propios.tuya}> · tu cuenta</span>}</span>
            {cuenta.nombre && cuenta.correo && <span className={propios.correo}>{cuenta.correo}</span>}
            {barrio && <span className={propios.correo}>Vive en {barrio}</span>}
          </div>
        </td>
        <td data-etiqueta="Rol">{rolEnPalabras(cuenta.rol)}</td>
        <td data-etiqueta="Estado"><span className={propios.estado}>{estadoCuentaEnPalabras(cuenta.estado)}</span></td>
        <td data-etiqueta="Permisos">{permisosEnPalabras(cuenta)}</td>
        <td data-etiqueta="Alta">{cuenta.creadoEn ? <time dateTime={cuenta.creadoEn}>{fechaCorta(cuenta.creadoEn, ahora)}</time> : 'Sin fecha'}</td>
        <td className={propios.celdaAccion}>
          <Button className={`${botones.secundario} ${estilos.accion}`} aria-expanded={abierta} aria-label={`${abierta ? 'Cerrar' : 'Abrir'} el detalle de ${nombre}`} onPress={alAlternar}>
            {abierta ? 'Cerrar' : 'Detalle'}
          </Button>
        </td>
      </tr>
      {abierta && (
        <tr className={propios.filaDetalle}>
          <td colSpan={6}>
            <PanelCuenta cuenta={cuenta} idPropio={idPropio} puedeGestionar={puedeGestionar} alResolver={alResolver} />
          </td>
        </tr>
      )}
    </>
  )
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return <div><dt>{etiqueta}</dt><dd>{valor}</dd></div>
}

function useResumen(habilitada: boolean) {
  const consultas = useColaDeCuentas(habilitada)
  const [aprobar, invitadas, suspendidas] = consultas
  const contar = (consulta: typeof aprobar) => {
    if (!consulta?.data) return null
    const cantidad = contarReales(consulta.data.cuentas)
    return { cantidad, masDe: consulta.data.paginacion.hayMas }
  }
  return {
    cargando: consultas.some((consulta) => consulta.isPending),
    fallo: consultas.every((consulta) => consulta.isError),
    porAprobar: contar(aprobar),
    invitadas: contar(invitadas),
    suspendidas: contar(suspendidas),
  }
}

function enCifras(valor: { cantidad: number; masDe: boolean } | null): string {
  return valor === null ? '—' : `${formatearNumero(valor.cantidad)}${valor.masDe ? ' o más' : ''}`
}

function titularDe(resumen: ReturnType<typeof useResumen>): string {
  if (resumen.cargando) return 'Consultando las cuentas…'
  if (resumen.fallo) return 'No pudimos consultar las cuentas'
  const pendientes = resumen.porAprobar
  if (!pendientes || pendientes.cantidad === 0) return 'Ninguna cuenta espera tu aprobación'
  const cuantas = `${formatearNumero(pendientes.cantidad)}${pendientes.masDe ? ' o más' : ''}`
  return pendientes.cantidad === 1 && !pendientes.masDe ? '1 cuenta espera tu aprobación' : `${cuantas} cuentas esperan tu aprobación`
}

/** FE5 · `/panel/cuentas`: quién entra al panel. Exige `GESTIONAR_USUARIOS`; sin él, la sección ni aparece y la ruta lo dice. */
export function Cuentas() {
  usePaletaGrafito()
  const permisos = usePermisos()
  const puedeGestionar = permisos.has('GESTIONAR_USUARIOS')
  const cuentaActual = useCuentaActual(true).data
  const ahora = useAhora()
  const cliente = useQueryClient()
  const barrios = useBarriosPanel()
  const [estado, setEstado] = useState('')
  const [barrioId, setBarrioId] = useState('')
  const [mostrarSinteticas, setMostrarSinteticas] = useState(false)
  // Desde qué página se pidió cada pantalla que se ha visto: «Anterior» vuelve a la de antes, aunque una búsqueda haya saltado páginas.
  const [inicios, setInicios] = useState<number[]>([0])
  const [invitando, setInvitando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const avisoRef = useRef<HTMLOutputElement>(null)
  const resumen = useResumen(puedeGestionar)
  const inicio = inicios.at(-1) ?? 0
  const consulta = useCuentas({ estado, barrioId }, inicio, !mostrarSinteticas, puedeGestionar)
  const error = consulta.isError ? (consulta.error as unknown as ErrorApi) : null
  const sinPermisoEnServidor = error?.estado === 403
  const sectores = new Map((barrios.data ?? []).map((sector) => [sector.id ?? '', sector.nombre]))
  const { visibles, ocultas } = separarSinteticas(consulta.data?.cuentas ?? [], mostrarSinteticas)
  const paginacion = consulta.data?.paginacion
  const hayMas = paginacion?.hayMas ?? false
  const agotado = consulta.data?.agotado === true && visibles.length === 0
  const saltadas = consulta.data?.saltadas ?? 0
  const filtrado = estado !== '' || barrioId !== ''

  useEffect(() => {
    if (sinPermisoEnServidor) void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
  }, [sinPermisoEnServidor, cliente])

  useEffect(() => {
    if (aviso) avisoRef.current?.focus()
  }, [aviso])

  function cambiarFiltro(poner: () => void) {
    poner()
    setInicios([0])
    setAbierta(null)
  }

  function siguiente() {
    if (paginacion) setInicios((actuales) => [...actuales, paginacion.pagina + 1])
    setAbierta(null)
  }

  function anterior() {
    setInicios((actuales) => (actuales.length > 1 ? actuales.slice(0, -1) : actuales))
    setAbierta(null)
  }

  function alResolver(texto: string | null, hecho: boolean) {
    setAviso(texto)
    if (hecho) setAbierta(null)
  }

  if (!puedeGestionar || sinPermisoEnServidor) {
    return (
      <div className={`${pagina.pagina} ${pagina.vista}`}>
        <header className={pagina.cabeceraVista}>
          <p className={bloques.rotulo}>Cuentas · quién entra al panel</p>
          <h1 className={`${pagina.titular} ${pagina.titularVista}`}>Tu cuenta no puede gestionar cuentas</h1>
        </header>
        <section className={bloques.bloque} aria-label="Acceso denegado">
          <p className={bloques.titulo}>Esta sección es de los administradores</p>
          <p className={bloques.bajada}>Hace falta el permiso para gestionar cuentas. Si lo acabas de recibir, cierra sesión y vuelve a entrar.</p>
        </section>
      </div>
    )
  }

  const idPropio = cuentaActual?.id
  const desde = paginacion ? paginacion.pagina : inicio
  const paginas = paginacion?.paginas

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Cuentas · quién entra al panel</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>{titularDe(resumen)}</h1>
      </header>
      <section className={`${bloques.bloque} ${bloques.tenido}`} aria-label="Resumen de las cuentas">
        <dl className={`${bloques.cifras} ${propios.cifrasResumen}`}>
          <Cifra etiqueta="Esperan aprobación" valor={enCifras(resumen.porAprobar)} />
          <Cifra etiqueta="Invitaciones sin aceptar" valor={enCifras(resumen.invitadas)} />
          <Cifra etiqueta="Suspendidas" valor={enCifras(resumen.suspendidas)} />
        </dl>
        <p className={propios.nota}>
          Sin contar las {FRASE_SINTETICAS}: no son personas y no se cuentan como adopción.
        </p>
      </section>
      {aviso && <output className={`${estilos.aviso} ${propios.aviso}`} tabIndex={-1} ref={avisoRef}>{aviso}</output>}
      <section className={`${bloques.bloque} ${propios.bloqueTabla}`} aria-labelledby="titulo-cuentas">
        <div className={propios.cabecera}>
          <h2 id="titulo-cuentas" className={estilos.tituloLateral}>Cuentas del panel y de los vecinos</h2>
          {!invitando && (
            <Button className={botones.principal} onPress={() => { setAviso(null); setInvitando(true) }}>Invitar a una persona</Button>
          )}
        </div>
        {invitando && (
          <FormularioInvitacion
            alTerminar={(texto) => { setInvitando(false); setAviso(texto) }}
            alCancelar={() => setInvitando(false)}
          />
        )}
        <div className={propios.filtros}>
          <Seleccion etiqueta="Estado" value={estado} opciones={OPCIONES_ESTADO} onChange={(evento) => cambiarFiltro(() => setEstado(evento.target.value))} />
          <Seleccion
            etiqueta="Barrio donde vive"
            value={barrioId}
            opciones={[{ valor: '', texto: 'Todos los barrios' }, ...[...sectores].map(([id, nombre]) => ({ valor: id, texto: nombreLegible(nombre) })).sort((a, b) => a.texto.localeCompare(b.texto, 'es'))]}
            onChange={(evento) => cambiarFiltro(() => setBarrioId(evento.target.value))}
          />
          <label className={propios.interruptor}>
            <input type="checkbox" checked={mostrarSinteticas} onChange={(evento) => cambiarFiltro(() => setMostrarSinteticas(evento.target.checked))} />
            <span>
              Mostrar cuentas sintéticas
              <span className={propios.origen}>{FRASE_SINTETICAS}; no son personas</span>
            </span>
          </label>
        </div>

        {consulta.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /><span /></div>}
        {consulta.isPending && <output className={estilos.oculto}>Consultando las cuentas…</output>}
        {error && !sinPermisoEnServidor && (
          <p role="alert" className={estilos.vacio}>
            No pudimos consultar las cuentas. Revisa tu conexión e inténtalo otra vez.{' '}
            <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
          </p>
        )}
        {consulta.data && visibles.length === 0 && !agotado && (
          <div className={estilos.vacioBloque}>
            <p className={bloques.titulo}>{textoDeEstadoVacio(filtrado)}</p>
            {ocultas > 0 && <p className={bloques.bajada}>Ocultamos {formatearNumero(ocultas)} de las {FRASE_SINTETICAS}.</p>}
          </div>
        )}
        {agotado && (
          <div className={estilos.vacioBloque}>
            <p className={bloques.titulo}>Las últimas cuentas de la lista son sintéticas</p>
            <p className={bloques.bajada}>
              Buscamos en las últimas {formatearNumero(SALTOS_SEGUIDOS * 50)} cuentas y todas son {FRASE_SINTETICAS}. El servidor no permite filtrarlas, así que se sigue página por página.
            </p>
            <Button className={botones.secundario} onPress={siguiente}>Seguir buscando</Button>
          </div>
        )}
        {visibles.length > 0 && (
          <div className={propios.contenedorTabla}>
            <table className={propios.tabla}>
              <caption className={estilos.oculto}>Cuentas, de las más recientes a las más antiguas</caption>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Permisos</th>
                  <th scope="col">Alta</th>
                  <th scope="col"><span className={estilos.oculto}>Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((cuenta) => (
                  <FilaCuenta
                    key={cuenta.id}
                    cuenta={cuenta}
                    idPropio={idPropio}
                    puedeGestionar={puedeGestionar}
                    abierta={abierta === cuenta.id}
                    barrio={cuenta.barrioId ? nombreLegible(sectores.get(cuenta.barrioId) ?? cuenta.barrioId) : null}
                    ahora={ahora}
                    alAlternar={() => setAbierta(abierta === cuenta.id ? null : cuenta.id ?? null)}
                    alResolver={alResolver}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {consulta.data && (
          <div className={propios.pie}>
            <p className={propios.nota}>
              Página {formatearNumero(desde + 1)}{paginas ? ` de ${formatearNumero(paginas)}` : ''}
              {ocultas > 0 ? ` · ${formatearNumero(ocultas)} ${ocultas === 1 ? 'cuenta sintética oculta' : 'cuentas sintéticas ocultas'}` : ''}
              {saltadas > 0 ? ` · se dejaron atrás ${formatearNumero(saltadas)} ${saltadas === 1 ? 'página hecha' : 'páginas hechas'} solo de ellas` : ''}
            </p>
            <div className={estilos.acciones}>
              <Button className={botones.secundario} isDisabled={inicios.length === 1 || consulta.isFetching} onPress={anterior}>Anterior</Button>
              <Button className={botones.secundario} isDisabled={!hayMas || consulta.isFetching} onPress={siguiente}>Siguiente</Button>
            </div>
          </div>
        )}
        {consulta.data && (
          <p className={propios.nota}>
            Suspender una cuenta o cambiar su rol o permisos cierra sus sesiones abiertas. No puedes cambiar tu propio acceso.
          </p>
        )}
      </section>
    </div>
  )
}
