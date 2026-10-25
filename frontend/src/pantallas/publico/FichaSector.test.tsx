import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { LecturaCanal } from '../../api/canal-en-vivo'
import { FichaSector } from './FichaSector'

const SECTOR = { id: 'manga', nombre: 'MANGA', poblacion: 10754, estado: 'SIN_SERVICIO', actualizadoEn: '2026-09-25T19:30:00Z', verificadoEn: '2026-09-25T19:30:00Z' }

const prueba = vi.hoisted(() => ({
  estado: 'en-vivo' as string,
  error: false,
  aviso: null as null | { urlOriginal?: string; fuente?: string; timestamp?: string },
}))

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: 'manga' }),
  Link: ({ children, className, to, search }: { children: unknown; className?: string; to?: string; search?: object }) => (
    <a href={to ?? '/'} className={className} data-search={JSON.stringify(search ?? {})}>{children as never}</a>
  ),
}))
// 15:00 en Cartagena.
vi.mock('../../app/ahora', () => ({ useAhora: () => new Date('2026-09-25T20:00:00Z') }))
vi.mock('./Reporte', () => ({ Reporte: () => <button type="button">Reportar</button> }))
vi.mock('../../app/datos', () => ({
  useListado: () => ({
    lectura: { listado: { generadoEn: '2026-09-25T19:55:00Z', sectores: [SECTOR] }, estado: prueba.estado, error: prueba.error } as unknown as LecturaCanal,
    porId: new Map([['manga', SECTOR]]),
    reintentar: vi.fn<() => void>(),
  }),
  useCortes: () => ({ isPending: false, isError: false, data: { pages: [{ cortes: [] }] }, hasNextPage: false }),
  useUltimoAviso: () => ({ data: prueba.aviso ? { id: 'a1', tipo: 'CORTE_DETECTADO_POR_INGESTA', ...prueba.aviso } : null }),
}))

describe('FichaSector: frescura y fuente', () => {
  afterEach(() => { prueba.estado = 'en-vivo'; prueba.error = false; prueba.aviso = null })

  it('debeDarUnaSolaLineaDeFrescuraConElPuntoEnVivo', () => {
    render(<FichaSector />)
    const registro = screen.getByRole('region', { name: 'Registro del dato' })
    expect(registro).toHaveTextContent('Actualizado hace 30 min')
    expect(registro).toHaveTextContent('En vivo')
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

  it('debeLlevarALaBitacoraDelBarrioFiltradaAlosAvisosYDecirCuandoFueElUltimo', () => {
    prueba.aviso = { urlOriginal: 'https://www.acuacar.com/boletin/1', fuente: 'ACUACAR', timestamp: '2026-09-25T15:00:00Z' }
    render(<FichaSector />)
    const enlace = screen.getByRole('link', { name: /Ver los avisos de Acuacar/ })
    expect(enlace).toHaveAttribute('href', '/bitacora')
    expect(JSON.parse(enlace.getAttribute('data-search') ?? '{}')).toEqual({ sector: 'manga', tipo: 'CORTE_DETECTADO_POR_INGESTA' })
    expect(screen.getByText(/Último aviso sobre este barrio/)).toBeInTheDocument()
    // La ficha no abre ninguna fuente externa por sí sola: eso se elige en la bitácora.
    expect(screen.queryByRole('link', { name: /boletín original/ })).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="http"]')).toBeNull()
  })

  it('debeNombrarLaPrensaCuandoElUltimoAvisoVienedeUnaNota', () => {
    prueba.aviso = { fuente: 'PRENSA', timestamp: '2026-09-25T15:00:00Z' }
    render(<FichaSector />)
    expect(screen.getByRole('link', { name: /Ver los avisos de prensa/ })).toBeInTheDocument()
  })

  it('noDebeOfrecerElBotonSiNoHayAvisos', () => {
    render(<FichaSector />)
    expect(screen.queryByRole('link', { name: /Ver los avisos/ })).not.toBeInTheDocument()
  })
})
