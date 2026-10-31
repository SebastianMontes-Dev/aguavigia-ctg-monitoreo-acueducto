// Cartagena no tiene horario de verano: UTC-5 todo el año (guía §5.4). Un `datetime-local` no lleva zona, así que se le pone la
// de Cartagena de forma explícita; nunca la del navegador de quien esté usando el panel.
const DESFASE = '-05:00'
const MS_DESFASE = 5 * 60 * 60 * 1000
const CAMPO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Lo que escribió la persona («2026-10-30T14:30», hora de Cartagena) como instante UTC en ISO; `null` si no es una fecha real. */
export function instanteDesdeCartagena(valor: string): string | null {
  const partes = CAMPO.exec(valor.trim())
  if (!partes) return null
  const [, anio, mes, dia, hora, minuto, segundo = '00'] = partes
  const instante = new Date(`${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}${DESFASE}`)
  if (Number.isNaN(instante.getTime())) return null
  // `new Date` corrige un 31 de febrero al 3 de marzo: si el día cambió, la fecha escrita no existía.
  const vuelta = campoDesdeInstante(instante)
  return vuelta.slice(0, 10) === `${anio}-${mes}-${dia}` ? instante.toISOString() : null
}

/** El valor de un `datetime-local` («2026-10-30T14:30») que corresponde a ese instante en la hora de Cartagena. */
export function campoDesdeInstante(instante: string | Date): string {
  const ms = (typeof instante === 'string' ? new Date(instante) : instante).getTime()
  return new Date(ms - MS_DESFASE).toISOString().slice(0, 16)
}
