import { useId, useRef, useState } from 'react'
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { recordarPropio } from '../../api/memoria-reportes'
import { enviarFoto, enviarReporte, TIPOS_FOTO, type ResultadoEnvio, type ResultadoFoto, type TipoReporte } from '../../api/reportes'
import { useListado } from '../../app/datos'
import { ubicacionPara } from '../../app/ubicacion'
import { useHaySesionVecino, usePerfilVecino } from '../../app/vecino'
import { Icono } from '../../componentes/Icono'
import { MarcaRecibido } from '../../componentes/MarcaRecibido'
import { nombreLegible, type Sector } from '../../dominio/sectores'
import botones from '../../componentes/Botones.module.css'
import estilos from './Reporte.module.css'

const OPCIONES: { tipo: TipoReporte; texto: string }[] = [
  { tipo: 'SIN_AGUA', texto: 'No tengo agua' },
  { tipo: 'PRESION_BAJA', texto: 'Llega poca agua' },
  { tipo: 'SERVICIO_RESTABLECIDO', texto: 'Ya volvió el agua' },
]

const PARA_COMPARTIR: Record<TipoReporte, (barrio: string) => string> = {
  SIN_AGUA: (barrio) => `En ${barrio} no llega agua a mi casa. Si a la tuya tampoco, confirma mi reporte en AguaVigía:`,
  PRESION_BAJA: (barrio) => `En ${barrio} llega poca agua a mi casa. Si a la tuya también, confirma mi reporte en AguaVigía:`,
  SERVICIO_RESTABLECIDO: (barrio) => `En ${barrio} ya volvió el agua a mi casa. Si a la tuya también, confirma mi reporte en AguaVigía:`,
}

/** El cupo por barrio es de 3 reportes cada 30 minutos para un dispositivo y de 5 para un vecino registrado (docs/api/reportes.md). */
function mensajeEnvio(resultado: Exclude<ResultadoEnvio, { tipo: 'recibido' }>, conCuenta: boolean): string {
  switch (resultado.tipo) {
    case 'sin-red': return 'No pudimos enviar tu reporte. Cuando recuperes la conexión, inténtalo otra vez.'
    case 'incierto': return 'No pudimos confirmar si se recibió tu reporte. Revisa tu conexión antes de enviarlo otra vez.'
    case 'cupo-agotado': return `Ya enviaste ${conCuenta ? 'cinco' : 'tres'} reportes de este barrio en la última media hora. Los que enviaste siguen contando.`
    case 'esperar': return resultado.segundos
      ? `Espera antes de volver a intentarlo. Podrás hacerlo en unos ${resultado.segundos} segundos.`
      : 'Espera antes de volver a intentarlo.'
    case 'rechazado': return resultado.mensaje
    case 'fallo': return 'No pudimos registrar tu reporte. Inténtalo otra vez en un momento.'
  }
}

/** `fotoEstado` de docs/api/reportes.md: lo que le pasa a la foto después de subirla se dice tal cual. */
function mensajeFotoRecibida(estado: Extract<ResultadoFoto, { tipo: 'recibida' }>['estado']): string {
  switch (estado) {
    case 'EN_REVISION': return 'Foto recibida. Un moderador la revisa antes de que se publique.'
    case 'PUBLICA': return 'Foto añadida y publicada con tu reporte.'
    case 'DESCARTADA': return 'La foto no se publicará.'
    default: return 'Foto añadida a tu reporte.'
  }
}

function mensajeFoto(resultado: ResultadoFoto): string {
  switch (resultado.tipo) {
    case 'recibida': return mensajeFotoRecibida(resultado.estado)
    case 'muy-grande': return 'La foto pesa más de 10 MB. Elige una más liviana.'
    case 'formato-no-permitido': return 'Esa imagen no sirve; usa una foto JPEG o PNG.'
    case 'sin-permiso': return 'Ya no se puede añadir una foto a este reporte. El permiso dura 10 minutos.'
    case 'ya-tiene-foto': return 'Este reporte ya tiene una foto.'
    case 'no-valida': return resultado.mensaje
    case 'fallo': return 'No pudimos enviar la foto. Tu reporte ya quedó registrado; puedes intentarlo otra vez.'
  }
}

function Foto({ reporteId, subidaToken }: { reporteId: string; subidaToken: string }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoFoto | null>(null)

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    setEnviando(true)
    setResultado(await enviarFoto(reporteId, archivo, subidaToken))
    setEnviando(false)
    if (entrada.current) entrada.current.value = ''
  }

  if (resultado?.tipo === 'recibida') return <output className={estilos.estado}>{mensajeFoto(resultado)}</output>

  return (
    <div className={estilos.anexo}>
      <input
        ref={entrada}
        id={`foto-${reporteId}`}
        type="file"
        accept={TIPOS_FOTO.join(',')}
        className={estilos.archivo}
        disabled={enviando}
        onChange={(evento) => void elegir(evento.target.files?.[0])}
      />
      <label htmlFor={`foto-${reporteId}`} className={botones.secundario} aria-disabled={enviando}>
        {enviando ? 'Enviando foto…' : 'Añadir una foto'}
      </label>
      <p className={estilos.ayuda}>Opcional. JPEG o PNG de hasta 10 MB; se le quita la ubicación antes de guardarla.</p>
      {resultado && <p className={estilos.error} role="alert">{mensajeFoto(resultado)}</p>}
    </div>
  )
}

/** RF038: no hay listado público de reportes; el único que un vecino puede confirmar es el que le comparten. */
function Compartir({ reporteId, texto }: { reporteId: string; texto: string }) {
  const [copia, setCopia] = useState<'copiado' | 'manual' | null>(null)
  const idEnlace = useId()
  const enlace = `${window.location.origin}/confirmar/${encodeURIComponent(reporteId)}`

  async function compartir() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Confirma mi reporte', text: texto, url: enlace })
        return
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${enlace}`)
      setCopia('copiado')
    } catch {
      setCopia('manual')
    }
  }

  return (
    <div className={estilos.anexo}>
      <Button className={botones.secundario} onPress={() => void compartir()}>Pedir a un vecino que lo confirme</Button>
      <p className={estilos.ayuda}>Quien reciba el enlace puede confirmar tu reporte con un toque, sin cuenta.</p>
      {copia === 'copiado' && <output className={estilos.estado}>Enlace copiado. Pégalo en el mensaje para tu vecino.</output>}
      {copia === 'manual' && (
        <div className={estilos.enlaceManual}>
          <label htmlFor={idEnlace} className={estilos.ayuda}>Copia este enlace y envíaselo:</label>
          <input id={idEnlace} className={estilos.enlace} readOnly value={enlace} onFocus={(evento) => evento.target.select()} />
        </div>
      )}
    </div>
  )
}

/**
 * RF008: desde la ficha, abrir y elegir es enviar; dos toques. El resultado se dice tal como llegó y el mapa no se
 * toca: el estado cambia solo cuando coinciden los vecinos (docs/api/reportes.md).
 */
export function Reporte({ sector }: { sector: Sector }) {
  const [enviando, setEnviando] = useState<TipoReporte | null>(null)
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null)
  const [enviado, setEnviado] = useState<TipoReporte>('SIN_AGUA')
  const nombre = nombreLegible(sector.nombre)
  const ubicacion = ubicacionPara(sector.id ?? '')
  const conCuenta = useHaySesionVecino()
  const perfil = usePerfilVecino().data
  const { porId } = useListado()
  const barrioDelVecino = perfil?.barrioId ? porId.get(perfil.barrioId) : undefined

  async function enviar(tipo: TipoReporte) {
    if (enviando) return
    setEnviando(tipo)
    setResultado(null)
    const respuesta = await enviarReporte(sector.id ?? '', tipo, ubicacion)
    if (respuesta.tipo === 'recibido' && respuesta.reporte.id) recordarPropio(respuesta.reporte.id)
    setEnviado(tipo)
    setResultado(respuesta)
    setEnviando(null)
  }

  return (
    <DialogTrigger onOpenChange={(abierto) => { if (!abierto) setResultado(null) }}>
      <Button className={`${botones.principal} ${botones.ancho}`}>
        <span className={botones.etiqueta}><Icono nombre="megafono" />Reportar lo que pasa en mi casa</span>
        <span className={botones.flecha} aria-hidden="true">→</span>
      </Button>
      <ModalOverlay className={estilos.fondo} isDismissable>
        <Modal className={estilos.cajon}>
          <Dialog className={estilos.dialogo}>
            {({ close }) => resultado?.tipo === 'recibido' ? (
              <div className={estilos.recibido}>
                <MarcaRecibido />
                <Heading slot="title" className={estilos.titulo}>Reporte recibido</Heading>
                <output>Tu reporte cuenta junto con los de tus vecinos. El mapa cambia cuando varios coinciden.</output>
                <Compartir
                  reporteId={resultado.reporte.id ?? ''}
                  texto={PARA_COMPARTIR[enviado](nombre)}
                />
                {resultado.reporte.subidaToken && (
                  <Foto reporteId={resultado.reporte.id ?? ''} subidaToken={resultado.reporte.subidaToken} />
                )}
                <Button className={botones.secundario} onPress={close}>Volver a {nombre}</Button>
              </div>
            ) : (
              <>
                <Heading slot="title" className={estilos.titulo}>¿Qué pasa con el agua en tu casa?</Heading>
                <p className={estilos.contexto}>
                  Reportas en <strong>{nombre}</strong>{ubicacion && ', con la ubicación que compartiste'}.
                  {!(conCuenta && perfil?.nombre) && ' No hace falta cuenta.'}
                </p>
                {conCuenta && perfil?.nombre && (
                  <p className={estilos.contexto}>
                    Reportas como <strong>{perfil.nombre}</strong>{barrioDelVecino ? <>, vecino de <strong>{nombreLegible(barrioDelVecino.nombre)}</strong></> : null}.
                  </p>
                )}
                <div className={estilos.opciones} aria-busy={enviando !== null}>
                  {OPCIONES.map((opcion) => (
                    <Button
                      key={opcion.tipo}
                      className={estilos.opcion}
                      isDisabled={enviando !== null}
                      onPress={() => void enviar(opcion.tipo)}
                    >
                      {enviando === opcion.tipo ? 'Enviando…' : opcion.texto}
                    </Button>
                  ))}
                </div>
                {resultado && <p className={estilos.error} role="alert">{mensajeEnvio(resultado, conCuenta)}</p>}
                <Button className={estilos.cancelar} onPress={close}>Cancelar</Button>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
