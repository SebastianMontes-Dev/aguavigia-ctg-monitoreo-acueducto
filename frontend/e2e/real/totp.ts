import { createHmac } from 'node:crypto'

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** RFC 6238 (HMAC-SHA1, 6 dígitos, franjas de 30 s): el mismo cálculo que `scripts/codigo-totp.mjs`, solo para pruebas locales. */
export function codigoTotp(secreto: string, epochSegundos = Math.floor(Date.now() / 1000)): string {
  let bits = ''
  for (const letra of secreto.replace(/[\s-]/g, '').toUpperCase()) bits += ALFABETO.indexOf(letra).toString(2).padStart(5, '0')
  const clave = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)))
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(epochSegundos / 30)))
  const huella = createHmac('sha1', clave).update(contador).digest()
  const desplazamiento = huella[huella.length - 1]! & 0x0f
  const valor = (huella.readUInt32BE(desplazamiento) & 0x7fffffff) % 1_000_000
  return String(valor).padStart(6, '0')
}

export const segundosHastaLaSiguienteFranja = (ahora = Date.now()) => 30 - (Math.floor(ahora / 1000) % 30)
