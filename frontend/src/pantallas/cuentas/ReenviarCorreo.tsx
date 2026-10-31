import { reenviarVerificacion } from '../../api/cuentas'
import { NEUTRO } from '../../dominio/mensajes-cuenta'
import type { Paso } from './PaginaCuenta'
import { EnviarPorCorreo } from './EnviarPorCorreo'

const PASOS: readonly Paso[] = [
  { icono: 'correo', titulo: 'Escribes el correo con el que te registraste', detalle: 'No hace falta registrarte otra vez.' },
  { icono: 'documento', titulo: 'Recibes un enlace nuevo', detalle: 'El anterior deja de servir. Se reenvía como mucho una vez cada 2 minutos.' },
  { icono: 'personas', titulo: 'Lo abres y sigues', detalle: 'Si eres vecino, ahí eliges tu clave. Si pediste acceso al panel, ahí confirmas tu correo.' },
]

/** cuentas-y-sesion.md: responde `202` siempre, exista o no la cuenta y esté o no verificada; el mensaje es el mismo. */
export function ReenviarCorreo() {
  return (
    <EnviarPorCorreo
      rotulo="Cuenta"
      titular="¿No te llegó el correo?"
      bajada="Te lo reenviamos: el enlace anterior deja de servir. Sirve para confirmar el correo o, si eres vecino, para elegir tu clave."
      tituloPasos="Así funciona"
      pasos={PASOS}
      etiqueta="Reenviar la verificación"
      boton="Reenviar el correo"
      neutro={NEUTRO.reenvio}
      tituloRecibido="Revisa tu correo"
      enviar={reenviarVerificacion}
    />
  )
}
