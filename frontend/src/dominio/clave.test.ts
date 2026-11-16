import { validarClaveNueva } from './clave'

describe('validarClaveNueva', () => {
  it('debePedirAlMenosNueveCaracteres', () => {
    expect(validarClaveNueva('Corta-1')).toMatch(/9 caracteres/)
    expect(validarClaveNueva('Cartagena!')).toBeNull()
    expect(validarClaveNueva('Aaaaaaaa#')).toBeNull()
  })

  it('debePedirUnaMayuscula', () => {
    expect(validarClaveNueva('cartagena#2026')).toMatch(/mayúscula/)
    expect(validarClaveNueva('Ñandú¿qué')).toBeNull()
  })

  it('debePedirUnSignoQueNoSeaUnEspacio', () => {
    expect(validarClaveNueva('Cartagena2026')).toMatch(/signo/)
    expect(validarClaveNueva('Mi clave larga')).toMatch(/signo/)
  })

  it('debeRechazarEspaciosAlPrincipioOAlFinal', () => {
    expect(validarClaveNueva(' Cartagena#1')).toMatch(/espacios/)
  })

  it('debeRechazarMasDeSetentaYDosBytesAunqueTengaMenosDeCientoVeinteOchoCaracteres', () => {
    expect(validarClaveNueva('A#' + 'a'.repeat(70))).toBeNull()
    expect(validarClaveNueva('A#' + 'a'.repeat(71))).toMatch(/demasiado larga/)
    expect(validarClaveNueva('A#' + 'ñ'.repeat(36))).toMatch(/demasiado larga/)
  })

  it('debeRechazarMasDeCientoVeinteOchoCaracteres', () => {
    expect(validarClaveNueva('a'.repeat(129))).toMatch(/128/)
  })

  it('debeExigirUnaClaveDistintaDeLaActual', () => {
    expect(validarClaveNueva('La-misma-clave', 'La-misma-clave')).toMatch(/distinta/)
    expect(validarClaveNueva('Otra-clave-nueva', 'La-misma-clave')).toBeNull()
  })
})
