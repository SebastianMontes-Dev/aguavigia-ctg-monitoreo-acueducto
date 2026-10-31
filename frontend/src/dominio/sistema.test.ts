import { accionEnPalabras, autorEnPalabras, sujetoEnPalabras } from './auditoria'
import {
  cambioEnPalabras, conteosDeCopia, duracionDeCopia, entradasDe, resultadoDeCopia, resultadoEnPalabras, tiempoHastaElCambio, totalDe,
} from './sistema'

describe('métricas del sistema', () => {
  it('debeSumarYOrdenarContadoresSinSuponerClavesNiFallarConMapasAusentes', () => {
    expect(totalDe(undefined)).toBe(0)
    expect(totalDe({})).toBe(0)
    expect(totalDe({ a: 2, b: 5 })).toBe(7)
    expect(entradasDe({ b: 1, a: 3, c: 3 }).map((entrada) => entrada.clave)).toEqual(['a', 'c', 'b'])
    expect(entradasDe(undefined)).toEqual([])
  })

  it('debeDecirElCambioDeEstadoConSuOrigenSinInventarOrigenes', () => {
    expect(cambioEnPalabras('SIN_SERVICIO/VECINOS')).toBe('Sin servicio por vecinos')
    expect(cambioEnPalabras('SIN_DATOS/SIN_ORIGEN')).toBe('Vuelve a «sin datos»')
    expect(cambioEnPalabras('CON_SERVICIO/OTRO_NUEVO')).toBe('Con servicio OTRO_NUEVO')
  })

  it('debeNoConcluirNadaConMenosDeCincoCambiosMedidos', () => {
    expect(tiempoHastaElCambio(undefined)).toEqual({ cambios: 0, suficiente: false, promedio: null, maximo: null })
    expect(tiempoHastaElCambio({ tiempoHastaElCambioDeEstado: { cambios: 4, promedioSegundos: 600, maximoSegundos: 1200 } })).toEqual({ cambios: 4, suficiente: false, promedio: null, maximo: null })
  })

  it('debeDarPromedioYMaximoEnPalabrasCuandoLaMuestraAlcanza', () => {
    const tiempo = tiempoHastaElCambio({ tiempoHastaElCambioDeEstado: { cambios: 5, promedioSegundos: 1800, maximoSegundos: 7200 } })
    expect(tiempo).toEqual({ cambios: 5, suficiente: true, promedio: '30 minutos', maximo: '2 horas' })
  })
})

describe('copia analítica', () => {
  const copia = { id: 7, iniciadaEn: '2026-10-31T13:00:00Z', terminadaEn: '2026-10-31T13:00:04Z', resultado: 'CON_DIFERENCIAS', enMongo: { sectores: 211, cortes: 40, pares: 90 }, enSql: { sectores: 211, cortes: 40, pares: 88 }, detalle: 'Faltan 2 pares' }

  it('debeTraducirCadaResultadoYNoFingirUnoDesconocido', () => {
    expect(resultadoEnPalabras(resultadoDeCopia({ resultado: 'OK' }))).toBe('Copia correcta')
    expect(resultadoEnPalabras(resultadoDeCopia({ resultado: 'FALLIDA' }))).toBe('La copia falló')
    expect(resultadoEnPalabras(resultadoDeCopia({ resultado: 'EN_CURSO' }))).toBe('Copiando ahora')
    expect(resultadoDeCopia({ resultado: 'RARO' })).toBe('desconocido')
  })

  it('debeMarcarQueConteoNoCuadraComparandoMongoConSql', () => {
    expect(conteosDeCopia(copia)).toEqual([
      { nombre: 'Barrios', mongo: 211, sql: 211, cuadra: true },
      { nombre: 'Cortes', mongo: 40, sql: 40, cuadra: true },
      { nombre: 'Pares corte-barrio', mongo: 90, sql: 88, cuadra: false },
    ])
  })

  it('debeNoDarPorCuadradoUnConteoQueFalta', () => {
    expect(conteosDeCopia({ resultado: 'EN_CURSO' }).every((fila) => !fila.cuadra && fila.mongo === null)).toBe(true)
  })

  it('debeCalcularLaDuracionSoloSiLaCopiaTermino', () => {
    expect(duracionDeCopia(copia)).toBe('4 s')
    expect(duracionDeCopia({ iniciadaEn: copia.iniciadaEn })).toBeNull()
  })
})

describe('auditoría', () => {
  it('debeTraducirLasAccionesConocidasYMostrarTalCualLasDesconocidas', () => {
    expect(accionEnPalabras('CUENTA_SUSPENDIDA')).toBe('Se suspendió una cuenta')
    expect(accionEnPalabras('ACCION_NUEVA')).toBe('ACCION_NUEVA')
    expect(accionEnPalabras(undefined)).toBe('Acción sin nombre')
  })

  it('debeDecirQueActuoElSistemaCuandoNoHayAutorSinInventarUno', () => {
    expect(autorEnPalabras({})).toBe('El sistema o alguien sin sesión')
    expect(autorEnPalabras({ autorCorreo: 'ana@example.com' })).toBe('ana@example.com')
    expect(sujetoEnPalabras({})).toBe('Sin cuenta afectada')
  })
})
