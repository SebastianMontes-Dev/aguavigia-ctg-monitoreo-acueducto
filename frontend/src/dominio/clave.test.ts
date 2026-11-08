import { validarClaveNueva } from './clave'

describe('validarClaveNueva', () => {
  it('debePedirAlMenosDoceCaracteres', () => {
    expect(validarClaveNueva('corta')).toMatch(/12 caracteres/)
    expect(validarClaveNueva('doce-letras!')).toBeNull()
  })

  it('debeRechazarMasDeSetentaYDosBytesAunqueTengaMenosDeCientoVeinteOchoCaracteres', () => {
    expect(validarClaveNueva('a'.repeat(72))).toBeNull()
    expect(validarClaveNueva('a'.repeat(73))).toMatch(/demasiado larga/)
    expect(validarClaveNueva('ñ'.repeat(37))).toMatch(/demasiado larga/)
  })

  it('debeRechazarMasDeCientoVeinteOchoCaracteres', () => {
    expect(validarClaveNueva('a'.repeat(129))).toMatch(/128/)
  })

  it('debeExigirUnaClaveDistintaDeLaActual', () => {
    expect(validarClaveNueva('la misma clave larga', 'la misma clave larga')).toMatch(/distinta/)
    expect(validarClaveNueva('otra clave bien larga', 'la misma clave larga')).toBeNull()
  })
})
