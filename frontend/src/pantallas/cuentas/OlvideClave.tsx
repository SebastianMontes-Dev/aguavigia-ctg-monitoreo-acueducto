import { pedirRestablecimiento } from '../../api/cuentas'
import { NEUTRO } from '../../dominio/mensajes-cuenta'
import type { Paso } from './PaginaCuenta'
import { EnviarPorCorreo } from './EnviarPorCorreo'

const PASOS: readonly Paso[] = [
  { icono: 'correo', titulo: 'Escribes tu correo', detalle: 'El de tu cuenta del panel o el de tu cuenta de vecino.' },
  { icono: 'documento', titulo: 'Abres el enlace del correo', detalle: 'Vence en 30 minutos y sirve una sola vez. Pedir otro deja sin efecto el anterior.' },
  { icono: 'personas', titulo: 'Eliges una clave nueva', detalle: 'Se cierran todas las sesiones abiertas de la cuenta y entras con la clave nueva.' },
]

/** cuentas-y-sesion.md: `POST /api/cuentas/restablecimiento` responde `202` exista o no la cuenta, y la pantalla dice lo mismo en los dos casos. */
export function OlvideClave() {
  return (
    <EnviarPorCorreo
      rotulo="Recuperar la clave"
      titular="¿Olvidaste tu clave?"
      bajada="Escribe tu correo y te enviamos un enlace para elegir una clave nueva."
      tituloPasos="Así funciona"
      pasos={PASOS}
      etiqueta="Recuperar la clave"
      boton="Enviar enlace"
      neutro={NEUTRO.restablecer}
      tituloRecibido="Revisa tu correo"
      enviar={pedirRestablecimiento}
    />
  )
}
