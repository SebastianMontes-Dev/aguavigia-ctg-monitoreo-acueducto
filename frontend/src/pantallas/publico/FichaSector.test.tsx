import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import type { LecturaCanal } from '../../api/canal-en-vivo'
import type { Corte } from '../../dominio/cortes'
import type { Sector } from '../../dominio/sectores'
import { FichaSector } from './FichaSector'

const BASE: Sector = { id: 'manga', nombre: 'MANGA', poblacion: 10754, estado: 'SIN_SERVICIO', actualizadoEn: '2026-09-25T19:30:00Z', verificadoEn: '2026-09-25T19:30:00Z' }

const prueba = vi.hoisted(() => ({
  estado: 'en-vivo' as string,
  error: false,
  sector: null as unknown as Sector,
  cortes: [] as Corte[],
  aviso: null as null | { urlOriginal?: string; fuente?: string; timestamp?: string },
}))

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: 'manga' }),
  Link: ({ children, className, to, search, 'aria-label': etiqueta }: { children: unknown; className?: string; to?: string; search?: object; 'aria-label'?: string }) => (
    <a href={to ?? '/'} className={className} aria-label={etiqueta} data-search={JSON.stringify(search ?? {})}>{children as never}</a>
  ),
}))
// 15:00 en Cartagena.
vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-09-25T20:00:00Z') }))
vi.mock('./Reporte', () => ({ Reporte: () => <button type="button">Reportar</button> }))
vi.mock('../../app/datos', () => ({
  useListado: () => ({
    lectura: { listado: { generadoEn: '2026-09-25T19:55:00Z', sectores: [prueba.sector] }, estado: prueba.estado, error: prueba.error } as unknown as LecturaCanal,
    porId: new Map([['manga', prueba.sector]]),
    reintentar: vi.fn<() => void>(),
  }),
  useCortes: () => ({ isPending: false, isError: false, data: { pages: [{ cortes: prueba.cortes }] }, hasNextPage: false }),
  useUltimoAviso: () => ({ data: prueba.aviso ? { id: 'a1', tipo: 'CORTE_DETECTADO_POR_INGESTA', ...prueba.aviso } : null }),
}))

const ACUACAR = { urlOriginal: 'https://www.acuacar.com/boletin/1', fuente: 'ACUACAR', timestamp: '2026-09-25T15:00:00Z' }

function abierto(inicio: string): Corte {
  return { id: `c-${inicio}`, sectoresAfectados: ['manga'], inicio, finPrometido: '2026-09-26T03:00:00Z', cierres: [], origen: 'OFICIAL_ACUACAR', estado: 'CONFIRMADO' }
}

const estadoActual = () => screen.getByRole('region', { name: 'Estado actual' })
const ultimoAviso = () => screen.getByRole('region', { name: 'Último aviso' })

beforeEach(() => { prueba.sector = { ...BASE } })
afterEach(() => { prueba.estado = 'en-vivo'; prueba.error = false; prueba.aviso = null; prueba.cortes = [] })

describe('FichaSector: encabezado y estado', () => {
  it('debeNombrarLosHabitantesUnaSolaVez', () => {
    render(<FichaSector />)
    expect(screen.getAllByText(/10\.754 habitantes/)).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Manga' })).toBeInTheDocument()
  })

  it('debeDarUnaSolaLineaDeFrescuraConElPuntoEnVivoDentroDelEstado', () => {
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Sin servicio')
    expect(estadoActual()).toHaveTextContent('Actualizado hace 30 min')
    expect(estadoActual()).toHaveTextContent('En vivo')
    expect(screen.queryByText(/Listado generado/)).not.toBeInTheDocument()
    expect(screen.queryByText(/verificado hace/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Estado registrado/)).not.toBeInTheDocument()
  })

  it('debeDecirLaHoraDelListadoSoloCuandoLaLecturaEsGuardada', () => {
    prueba.estado = 'sin-red'
    render(<FichaSector />)
    expect(screen.getByText(/Sin conexión\. Mostramos el último listado guardado, generado/)).toBeInTheDocument()
    expect(screen.queryByText(/Actualizado hace/)).not.toBeInTheDocument()
  })

  it('debeMostrarSinDatosVerificadosSinColorYConLaInvitacionAReportar', () => {
    prueba.sector = { ...BASE, estado: null, actualizadoEn: null, verificadoEn: null }
    render(<FichaSector />)
    expect(estadoActual()).toHaveAttribute('data-estado', 'SIN_DATOS')
    expect(estadoActual()).toHaveTextContent('Sin datos verificados')
    expect(estadoActual()).toHaveTextContent('Puedes reportar lo que pasa en tu casa.')
  })

  it('debeDecirQueNadieConfirmoElRestablecimientoCuandoLaPromesaVencio', () => {
    prueba.sector = { ...BASE, restablecimientoPorConfirmar: true }
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Ya pasó la hora prometida y nadie ha confirmado que volvió el agua.')
  })

  it('debeDecirQueLaHoraNoEstaInformadaSiElBarrioEstaAfectadoSinCorteAbierto', () => {
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Hora de restablecimiento no informada.')
  })

  it('debeDecirElRegresoPrometidoDelBarrioCuandoNingunCorteAbiertoLoMuestra', () => {
    prueba.sector = { ...BASE, ventanaPrometida: { inicio: '2026-09-25T17:00:00Z', fin: '2026-09-26T03:00:00Z' } }
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Regreso prometido para hoy a las 10:00 p. m.')
    expect(estadoActual()).not.toHaveTextContent('hora ya pasada')
    expect(estadoActual()).not.toHaveTextContent('Hora de restablecimiento no informada.')
  })

  it('debeAdvertirQueLaHoraPrometidaYaPasoSinRepetirloSiYaEstaPorConfirmar', () => {
    prueba.sector = { ...BASE, ventanaPrometida: { inicio: '2026-09-25T13:00:00Z', fin: '2026-09-25T18:00:00Z' } }
    const { unmount } = render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Regreso prometido para hoy a las 1:00 p. m. (hora ya pasada).')
    unmount()

    prueba.sector = { ...prueba.sector, restablecimientoPorConfirmar: true }
    render(<FichaSector />)
    expect(estadoActual()).not.toHaveTextContent('hora ya pasada')
    expect(estadoActual()).toHaveTextContent('Ya pasó la hora prometida y nadie ha confirmado que volvió el agua.')
  })

  it('noDebeRepetirElRegresoPrometidoSiLaTarjetaDelCorteYaLoMuestra', () => {
    prueba.sector = { ...BASE, ventanaPrometida: { inicio: '2026-09-25T17:00:00Z', fin: '2026-09-26T03:00:00Z' } }
    prueba.cortes = [abierto('2026-09-25T17:00:00Z')]
    render(<FichaSector />)
    expect(estadoActual()).not.toHaveTextContent('Regreso prometido')
    expect(within(ultimoAviso()).getByText('Fin prometido')).toBeInTheDocument()
  })

  it('debeDejarRecibirAvisosEnLaEsquinaDelEncabezadoYNoEntreLasAcciones', () => {
    render(<FichaSector />)
    const enlace = screen.getByRole('link', { name: 'Recibir avisos de Manga' })
    expect(enlace).toHaveTextContent('Recibir avisos')
    expect(JSON.parse(enlace.getAttribute('data-search') ?? '{}')).toEqual({ sector: 'manga' })
    expect(screen.getByRole('region', { name: 'Qué puedes hacer' })).not.toContainElement(enlace)
  })
})

describe('FichaSector: último aviso', () => {
  it('debeLlevarALaBitacoraDelBarrioFiltradaAlosAvisosYDecirCuandoFueElUltimo', () => {
    prueba.aviso = ACUACAR
    render(<FichaSector />)
    const enlace = screen.getByRole('link', { name: 'Ver todos los avisos de Manga en la bitácora' })
    expect(enlace).toHaveTextContent('Ver todos')
    expect(enlace).toHaveAttribute('href', '/bitacora')
    expect(JSON.parse(enlace.getAttribute('data-search') ?? '{}')).toEqual({ sector: 'manga', tipo: 'CORTE_DETECTADO_POR_INGESTA' })
    expect(within(ultimoAviso()).getByText('Aviso de Acuacar')).toBeInTheDocument()
    // La fecha real acompaña al día relativo: «Hoy · vie 25 sep», no solo «hoy».
    expect(within(ultimoAviso()).getByText(/Hoy · vie 25 sep, 10:00 a\. m\./)).toBeInTheDocument()
    // La ficha no abre ninguna fuente externa por sí sola: eso se elige en la bitácora.
    expect(document.querySelector('a[href^="http"]')).toBeNull()
  })

  it('debeNombrarLaPrensaCuandoElUltimoAvisoVieneDeUnaNota', () => {
    prueba.aviso = { fuente: 'PRENSA', timestamp: '2026-09-25T15:00:00Z' }
    render(<FichaSector />)
    expect(within(ultimoAviso()).getByText('Nota de prensa')).toBeInTheDocument()
  })

  it('debeDecirQueNoHayAvisosSinOfrecerVerTodosCuandoNoHayCorteNiAviso', () => {
    render(<FichaSector />)
    expect(within(ultimoAviso()).getByText('No hay avisos registrados para este barrio.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver todos/ })).not.toBeInTheDocument()
  })

  it('debeDistinguirUnCorteProgramadoDeUnoEnCursoSegunSuInicio', () => {
    prueba.cortes = [abierto('2026-09-25T22:00:00Z'), abierto('2026-09-25T18:00:00Z')]
    render(<FichaSector />)
    const tarjetas = within(ultimoAviso()).getAllByRole('article', { name: 'Corte registrado para este barrio' })
    expect(tarjetas).toHaveLength(2)
    expect(within(ultimoAviso()).getByText('Corte programado').closest('[data-tipo]')).toHaveAttribute('data-tipo', 'programado')
    expect(within(ultimoAviso()).getByText('Corte en curso').closest('[data-tipo]')).toHaveAttribute('data-tipo', 'en-curso')
    expect(estadoActual()).not.toHaveTextContent('Hora de restablecimiento no informada.')
  })

  it('debeDarElUltimoAvisoEnUnaFilaAparteDelCorteAbiertoYUnaSolaVez', () => {
    prueba.cortes = [abierto('2026-09-25T18:00:00Z')]
    prueba.aviso = ACUACAR
    render(<FichaSector />)
    // El contrato no dice qué aviso anunció el corte (ADR-102): la fila no va dentro de la tarjeta del corte.
    const corte = within(ultimoAviso()).getByRole('article', { name: 'Corte registrado para este barrio' })
    expect(corte).not.toHaveTextContent(/Hoy · vie 25 sep, 10:00/)
    expect(within(ultimoAviso()).getAllByText('Aviso de Acuacar')).toHaveLength(1)
    expect(within(ultimoAviso()).getAllByText(/Hoy · vie 25 sep, 10:00 a\. m\./)).toHaveLength(1)
  })
})

describe('FichaSector: procedencia y disputa dentro del estado', () => {
  it('debeDecirCuantosVecinosSostienenElEstadoJuntoAlEstado', () => {
    prueba.sector = { ...BASE, origen: 'VECINOS', respaldo: { vecinos: 12, umbral: 12 } }
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Reportado por 12 vecinos')
  })

  it('debeDistinguirElAvisoOficialJuntoAlEstado', () => {
    prueba.sector = { ...BASE, origen: 'ACUACAR' }
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('Aviso oficial de Acuacar')
  })

  it('noDebeRepetirElAvisoOficialSiYaLoDiceElCorteAbierto', () => {
    prueba.sector = { ...BASE, origen: 'ACUACAR' }
    prueba.cortes = [abierto('2026-09-25T18:00:00Z')]
    render(<FichaSector />)
    expect(screen.getAllByText(/Aviso oficial de Acuacar/)).toHaveLength(1)
  })

  it('noDebeRotularElEstadoQueSostieneUnRevisor', () => {
    prueba.sector = { ...BASE, origen: 'VEEDOR' }
    render(<FichaSector />)
    expect(screen.queryByText(/revisor/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fuente del estado/)).not.toBeInTheDocument()
  })

  it('debeMostrarLaDisputaDentroDelEstadoSinCambiarlo', () => {
    prueba.sector = { ...BASE, origen: 'ACUACAR', enDisputa: true, reportesEnContra: 7 }
    render(<FichaSector />)
    expect(estadoActual()).toHaveTextContent('7 vecinos reportan algo distinto. Pendiente de revisión.')
    expect(estadoActual()).toHaveAttribute('data-estado', 'SIN_SERVICIO')
    expect(estadoActual()).toHaveTextContent('Sin servicio')
  })

  it('noDebeTenerBloquesDeRellenoNiLaNotaExplicativa', () => {
    render(<FichaSector />)
    expect(screen.queryByRole('region', { name: 'Sobre el barrio' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Combinamos avisos de Acuacar/)).not.toBeInTheDocument()
  })
})
