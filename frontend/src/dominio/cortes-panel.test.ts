import type { Corte } from './cortes'
import { admiteAnulacion, admiteCierres, barriosEnPalabras, barriosPendientes, cierresProvisionales, estadoDeCorteEnPalabras, razonDeVencido, validarAlta, validarHoraCierre, ventanaEnPalabras } from './cortes-panel'

const AHORA = new Date('2026-10-30T20:00:00Z') // 3:00 p. m. en Cartagena

function corte(extra: Partial<Corte> = {}): Corte {
  return {
    id: 'c1',
    sectoresAfectados: ['manga', 'bocagrande'],
    inicio: '2026-10-30T13:00:00Z',
    finPrometido: '2026-10-30T18:00:00Z',
    causa: 'Mantenimiento',
    origen: 'VEEDOR',
    estado: 'ANUNCIADO',
    cierres: [],
    ...extra,
  }
}

describe('validarAlta', () => {
  const valido = { barrios: ['manga'], inicio: '2026-10-30T08:00', fin: '2026-10-30T13:00', causa: ' Mantenimiento ' }

  it('debeConstruirLaSolicitudEnUtcDesdeLaHoraDeCartagena', () => {
    const { errores, solicitud } = validarAlta(valido)
    expect(errores).toEqual({})
    expect(solicitud).toEqual({
      sectoresAfectados: ['manga'],
      inicio: '2026-10-30T13:00:00.000Z',
      finPrometido: '2026-10-30T18:00:00.000Z',
      causa: 'Mantenimiento',
    })
  })

  it('debePedirBarrioFechasYCausaJuntoACadaCampo', () => {
    const { errores, solicitud } = validarAlta({ barrios: [], inicio: '', fin: '', causa: '  ' })
    expect(solicitud).toBeNull()
    expect(Object.keys(errores).sort()).toEqual(['barrios', 'causa', 'fin', 'inicio'])
  })

  it('debeRechazarUnFinAnteriorOIgualAlInicio', () => {
    expect(validarAlta({ ...valido, fin: '2026-10-30T07:59' }).errores.fin).toMatch(/posterior al inicio/)
    expect(validarAlta({ ...valido, fin: valido.inicio }).errores.fin).toMatch(/posterior al inicio/)
  })

  it('debeRechazarUnaFechaQueNoExiste', () => {
    expect(validarAlta({ ...valido, inicio: '2026-02-30T08:00' }).errores.inicio).toMatch(/existan/)
  })

  it('debePermitirUnInicioQueYaOcurrio', () => {
    expect(validarAlta({ ...valido, inicio: '2020-01-01T08:00', fin: '2020-01-01T10:00' }).solicitud).not.toBeNull()
  })
})

describe('validarHoraCierre', () => {
  it('debeDevolverElInstanteUtcDeUnaHoraValida', () => {
    expect(validarHoraCierre('2026-10-30T14:00', corte(), AHORA)).toEqual({ instante: '2026-10-30T19:00:00.000Z' })
  })

  it('noDebeAceptarUnaHoraAnteriorAlInicioDelCorte', () => {
    expect(validarHoraCierre('2026-10-30T07:59', corte(), AHORA).error).toMatch(/anterior al inicio/)
  })

  it('noDebeAceptarUnaHoraEnElFuturo', () => {
    expect(validarHoraCierre('2026-10-30T16:00', corte(), AHORA).error).toMatch(/futuro/)
  })

  it('debeTolerarUnMinutoDeAdelantoDelReloj', () => {
    expect(validarHoraCierre('2026-10-30T15:00', corte(), AHORA).instante).toBeDefined()
  })

  it('debePedirLaHoraSiEstaVaciaODecirSiNoExiste', () => {
    expect(validarHoraCierre('', corte(), AHORA).error).toMatch(/Escribe a qué hora/)
    expect(validarHoraCierre('2026-02-30T10:00', corte(), AHORA).error).toMatch(/existan/)
  })
})

describe('estado de un corte para el panel', () => {
  it('debeListarLosBarriosSinCierreComoPendientes', () => {
    const c = corte({ cierres: [{ sectorId: 'manga', hora: '2026-10-30T17:00:00Z', fuente: 'VEEDOR', provisional: false }] })
    expect(barriosPendientes(c)).toEqual(['bocagrande'])
  })

  it('soloDebeAdmitirCierresUnCorteAbiertoConBarriosPendientes', () => {
    expect(admiteCierres(corte())).toBe(true)
    expect(admiteCierres(corte({ estado: 'CONFIRMADO' }))).toBe(true)
    for (const estado of ['RESTABLECIDO', 'EXPIRADO', 'ANULADO']) expect(admiteCierres(corte({ estado }))).toBe(false)
    const todosCerrados = corte({ cierres: [
      { sectorId: 'manga', hora: '2026-10-30T17:00:00Z', fuente: 'VEEDOR', provisional: false },
      { sectorId: 'bocagrande', hora: '2026-10-30T17:30:00Z', fuente: 'VEEDOR', provisional: false },
    ] })
    expect(admiteCierres(todosCerrados)).toBe(false)
  })

  it('noDebeOfrecerAnularLoYaAnulado', () => {
    expect(admiteAnulacion(corte())).toBe(true)
    expect(admiteAnulacion(corte({ estado: 'RESTABLECIDO' }))).toBe(true)
    expect(admiteAnulacion(corte({ estado: 'ANULADO' }))).toBe(false)
  })

  it('debeLeerPrimeroLoProvisionalEnLaColaDeVencidos', () => {
    const provisional = corte({ cierres: [{ sectorId: 'manga', hora: '2026-10-30T17:00:00Z', fuente: 'VECINOS', provisional: true }] })
    expect(cierresProvisionales(provisional)).toHaveLength(1)
    expect(razonDeVencido(provisional)).toBe('cierre-provisional')
    expect(razonDeVencido(corte())).toBe('promesa-vencida')
  })

  it('debeDecirElEstadoSinColorYNoInventarUnoDesconocido', () => {
    expect(estadoDeCorteEnPalabras('ANUNCIADO')).toBe('Anunciado')
    expect(estadoDeCorteEnPalabras('RESTABLECIDO')).toBe('Restablecido')
    expect(estadoDeCorteEnPalabras('OTRO')).toBe('Sin estado')
    expect(estadoDeCorteEnPalabras(undefined)).toBe('Sin estado')
  })
})

describe('textos de la lista de cortes', () => {
  const nombre = (id: string) => ({ manga: 'Manga', bocagrande: 'Bocagrande', crespo: 'Crespo', getsemani: 'Getsemaní' }[id] ?? id)

  it('debeDecirLaVentanaDeUnDiaConLaHoraDeCartagena', () => {
    expect(ventanaEnPalabras('2026-10-30T13:00:00Z', '2026-10-30T18:00:00Z', AHORA)).toBe('vie 30 oct · 8:00 a. m. a 1:00 p. m.')
  })

  it('debeDecirElDiaDeCadaExtremoSiElCorteCruzaLaMedianoche', () => {
    expect(ventanaEnPalabras('2026-10-31T03:00:00Z', '2026-10-31T11:00:00Z', AHORA)).toBe('vie 30 oct 10:00 p. m. a sáb 31 oct 6:00 a. m.')
  })

  it('noDebeInventarUnHorarioSiFaltaUnExtremo', () => {
    expect(ventanaEnPalabras(undefined, '2026-10-30T18:00:00Z', AHORA)).toBe('Sin horario registrado')
  })

  it('debeNombrarLosPrimerosBarriosYContarElResto', () => {
    expect(barriosEnPalabras(['manga'], nombre)).toBe('Manga')
    expect(barriosEnPalabras(['manga', 'bocagrande'], nombre)).toBe('Manga y Bocagrande')
    expect(barriosEnPalabras(['manga', 'bocagrande', 'crespo', 'getsemani'], nombre)).toBe('Manga, Bocagrande y 2 más')
    expect(barriosEnPalabras([], nombre)).toBe('Sin barrios')
  })
})
