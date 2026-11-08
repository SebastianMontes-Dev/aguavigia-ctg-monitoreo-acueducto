import { useEffect, useState } from 'react'
import { Button } from 'react-aria-components'
import type { ErrorApi } from '../../api/cliente'
import { useAhora } from '../../app/ahora'
import { useAuditoria } from '../../app/datos-panel'
import { usePaletaGrafito } from '../../app/paleta'
import { usePermisos } from '../../app/panel'
import bloques from '../../componentes/Bloques.module.css'
import botones from '../../componentes/Botones.module.css'
import { accionEnPalabras, autorEnPalabras, sujetoEnPalabras, type EventoAuditoria } from '../../dominio/auditoria'
import { formatearNumero } from '../../dominio/formato'
import { fechaCorta, formatearHora, haceCuanto } from '../../dominio/tiempo'
import pagina from '../publico/Pagina.module.css'
import tablas from './Cuentas.module.css'
import estilos from './Gestion.module.css'
import propios from './Auditoria.module.css'
import { useQueryClient } from '@tanstack/react-query'

function titularDe(cargando: boolean, error: ErrorApi | null, eventos: EventoAuditoria[], numero: number, ahora: Date): string {
  if (cargando) return 'Consultando la auditoría…'
  if (error?.estado === 403) return 'Tu cuenta no puede ver la auditoría'
  if (error) return 'No pudimos consultar la auditoría'
  if (eventos.length === 0) return numero === 0 ? 'Todavía no hay acciones registradas' : 'No hay más acciones registradas'
  const primero = eventos[0]
  if (numero === 0 && primero?.ocurrioEn) return `Última acción: ${accionEnPalabras(primero.accion).toLowerCase()}, ${haceCuanto(primero.ocurrioEn, ahora)}`
  return `${formatearNumero(eventos.length)} ${eventos.length === 1 ? 'acción' : 'acciones'} en esta página`
}

function Asiento({ evento, ahora }: { evento: EventoAuditoria; ahora: Date }) {
  const cuando = evento.ocurrioEn
  return (
    <tr className={tablas.fila}>
      <td className={propios.cuando}>
        {cuando
          ? <time dateTime={cuando}>{fechaCorta(cuando, ahora)} · {formatearHora(cuando)}</time>
          : 'Sin fecha'}
      </td>
      <td className={propios.que}>{accionEnPalabras(evento.accion)}</td>
      <td data-etiqueta="Quién actuó" className={propios.actor}>{autorEnPalabras(evento)}</td>
      <td data-etiqueta="Sobre quién" className={propios.sujeto}>{sujetoEnPalabras(evento)}</td>
      <td className={propios.detalle}>{evento.detalle?.trim() || 'Sin detalle'}</td>
      <td className={propios.ip}>{evento.ip?.trim() || 'Sin IP'}</td>
    </tr>
  )
}

/** FE5 · `/panel/auditoria`: solo lectura, de lo más reciente a lo más antiguo. Exige `VER_AUDITORIA`. */
export function Auditoria() {
  usePaletaGrafito()
  const puedeVer = usePermisos().has('VER_AUDITORIA')
  const ahora = useAhora()
  const cliente = useQueryClient()
  const [numero, setNumero] = useState(0)
  const consulta = useAuditoria(numero, puedeVer)
  const error = consulta.isError ? (consulta.error as unknown as ErrorApi) : null
  const sinPermiso = !puedeVer || error?.estado === 403
  const eventos = consulta.data?.eventos ?? []
  const paginacion = consulta.data?.paginacion
  const hayMas = paginacion?.hayMas ?? false

  useEffect(() => {
    if (error?.estado === 403) void cliente.invalidateQueries({ queryKey: ['panel', 'yo'] })
  }, [error?.estado, cliente])

  if (sinPermiso) {
    return (
      <div className={`${pagina.pagina} ${pagina.vista}`}>
        <header className={pagina.cabeceraVista}>
          <p className={bloques.rotulo}>Auditoría · quién hizo qué</p>
          <h1 className={`${pagina.titular} ${pagina.titularVista}`}>Tu cuenta no puede ver la auditoría</h1>
        </header>
        <section className={bloques.bloque} aria-label="Acceso denegado">
          <p className={bloques.titulo}>Esta sección es de los administradores</p>
          <p className={bloques.bajada}>Hace falta el permiso para ver la auditoría. Si lo acabas de recibir, cierra sesión y vuelve a entrar.</p>
        </section>
      </div>
    )
  }

  const desde = paginacion?.pagina ?? numero
  const paginas = paginacion?.paginas

  return (
    <div className={`${pagina.pagina} ${pagina.vista}`}>
      <header className={pagina.cabeceraVista}>
        <p className={bloques.rotulo}>Auditoría · quién hizo qué</p>
        <h1 className={`${pagina.titular} ${pagina.titularVista}`}>{titularDe(consulta.isPending, error, eventos, numero, ahora)}</h1>
      </header>
      <section className={`${bloques.bloque} ${tablas.bloqueTabla}`} aria-labelledby="titulo-auditoria">
        <h2 id="titulo-auditoria" className={estilos.tituloLateral}>Acciones sobre cuentas y sesiones</h2>
        {consulta.isPending && <div className={estilos.esqueleto} aria-hidden="true"><span /><span /><span /></div>}
        {consulta.isPending && <output className={estilos.oculto}>Consultando la auditoría…</output>}
        {error && (
          <p role="alert" className={estilos.vacio}>
            No pudimos consultar la auditoría. Revisa tu conexión e inténtalo otra vez.{' '}
            <button type="button" className={estilos.reintentar} onClick={() => void consulta.refetch()}>Reintentar</button>
          </p>
        )}
        {consulta.data && eventos.length === 0 && (
          <div className={estilos.vacioBloque}>
            <p className={bloques.titulo}>{numero === 0 ? 'Todavía no hay acciones registradas' : 'Esta página no tiene acciones'}</p>
            <p className={bloques.bajada}>
              {numero === 0
                ? 'Cada vez que alguien cambie una cuenta, entre al panel o toque un corte o una propuesta, quedará aquí con su autor y su hora.'
                : 'Ya llegaste al final del registro.'}
            </p>
          </div>
        )}
        {eventos.length > 0 && (
          <div className={tablas.contenedorTabla}>
            <table className={tablas.tabla}>
              <caption className={estilos.oculto}>Auditoría, de las acciones más recientes a las más antiguas</caption>
              <thead>
                <tr>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Qué pasó</th>
                  <th scope="col">Quién actuó</th>
                  <th scope="col">Sobre quién</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evento, indice) => <Asiento key={evento.id ?? `${evento.ocurrioEn}-${indice}`} evento={evento} ahora={ahora} />)}
              </tbody>
            </table>
          </div>
        )}
        {consulta.data && (
          <div className={tablas.pie}>
            <p className={tablas.nota}>Página {formatearNumero(desde + 1)}{paginas ? ` de ${formatearNumero(paginas)}` : ''}</p>
            <div className={estilos.acciones}>
              <Button className={botones.secundario} isDisabled={desde === 0 || consulta.isFetching} onPress={() => setNumero(Math.max(0, desde - 1))}>Anterior</Button>
              <Button className={botones.secundario} isDisabled={!hayMas || consulta.isFetching} onPress={() => setNumero(desde + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
        <p className={tablas.nota}>Solo se lee: el registro solo se anexa y no hay forma de editar ni borrar un asiento. Las horas son de Cartagena.</p>
      </section>
    </div>
  )
}
