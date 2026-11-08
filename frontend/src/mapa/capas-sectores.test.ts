import type { GeometriaSectores } from '../api/geometria'
import type { Sector } from '../dominio/sectores'
import { CAPA_MARCA, capasSectores, unirSectores, type ColoresMapa } from './capas-sectores'

const cuadro = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
const GEOMETRIA = {
  type: 'FeatureCollection',
  features: ['a', 'b', 'c', 'd'].map((id) => ({ type: 'Feature', id, properties: { nombre: id }, geometry: { type: 'Polygon', coordinates: cuadro } })),
} as unknown as GeometriaSectores

const COLORES: ColoresMapa = {
  oscuro: false, conServicio: '#1', sinServicio: '#2', presionBaja: '#3', corteProgramado: '#4',
  superficie: '#5', tinta: '#6', tinta2: '#7', laton: '#8',
}

describe('capas de sectores', () => {
  it('debeMarcarLosBarriosEnDisputaOPorConfirmarSinCambiarSuEstado', () => {
    const sectores = new Map<string, Sector>([
      ['a', { id: 'a', nombre: 'A', estado: 'CON_SERVICIO', enDisputa: true, reportesEnContra: 4 }],
      ['b', { id: 'b', nombre: 'B', estado: 'SIN_SERVICIO', restablecimientoPorConfirmar: true }],
      ['c', { id: 'c', nombre: 'C', estado: 'SIN_SERVICIO', enDisputa: false, restablecimientoPorConfirmar: false }],
      ['d', { id: 'd', nombre: 'D', estado: null }],
    ])
    const propiedades = unirSectores(GEOMETRIA, sectores).features.map((feature) => feature.properties)
    expect(propiedades.map(({ id, estado, marcado }) => ({ id, estado, marcado }))).toEqual([
      { id: 'a', estado: 'CON_SERVICIO', marcado: true },
      { id: 'b', estado: 'SIN_SERVICIO', marcado: true },
      { id: 'c', estado: 'SIN_SERVICIO', marcado: false },
      { id: 'd', estado: 'SIN_DATOS', marcado: false },
    ])
  })

  it('debeDibujarLaMarcaConBordePunteadoDeTintaYNoConUnColorNuevo', () => {
    const marca = capasSectores(COLORES, null).find((capa) => capa.id === CAPA_MARCA)
    expect(marca).toMatchObject({ type: 'line', filter: ['==', ['get', 'marcado'], true] })
    expect(marca && 'paint' in marca ? marca.paint : null).toMatchObject({ 'line-color': COLORES.tinta, 'line-dasharray': [2, 1.5] })
  })
})
