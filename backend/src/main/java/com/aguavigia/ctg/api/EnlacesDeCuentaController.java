package com.aguavigia.ctg.api;

import com.aguavigia.ctg.api.PaginaDeCortesia.Enlace;
import com.aguavigia.ctg.api.PaginaDeCortesia.Errores;
import com.aguavigia.ctg.api.PaginaDeCortesia.Formulario;
import com.aguavigia.ctg.api.PaginaDeCortesia.Paso;
import com.aguavigia.ctg.api.PaginaDeCortesia.Presentacion;
import com.aguavigia.ctg.domain.ClaveEnClaro;
import com.aguavigia.ctg.domain.Usuario;
import com.aguavigia.ctg.domain.port.in.AceptarInvitacionUseCase;
import com.aguavigia.ctg.domain.port.in.RestablecerClaveUseCase;
import com.aguavigia.ctg.domain.port.in.VerificarCorreoUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Las pantallas a las que llevan los enlaces de los correos de cuenta (verificar el correo, aceptar
 * una invitación, restablecer la clave). Existen porque el sitio que antes las pintaba se retiró
 * (ADR-048) y el correo necesita apuntar a algo que abra en un navegador.
 *
 * Es solo transporte, igual que {@link CuentaPublicaController}: cada `POST` delega en el mismo
 * caso de uso que el endpoint JSON equivalente. El `GET` únicamente muestra el formulario y no
 * consume el token — ver {@link PaginaDeCortesia#formulario}. Lo único que se comprueba aquí es que
 * la clave y su confirmación coincidan (ADR-114): es un dato del formulario, no del dominio, y los
 * endpoints JSON no lo reciben.
 */
@Tag(name = "Cuentas", description = "Páginas HTML a las que llevan los enlaces de los correos de cuenta")
@RestController
@RequestMapping(value = "/api/cuentas/enlaces", produces = MediaType.TEXT_HTML_VALUE)
public class EnlacesDeCuentaController {

    private static final String RUTA = "/api/cuentas/enlaces/";

    static final String CLAVES_DISTINTAS = "Las dos claves no coinciden. Escríbelas otra vez.";
    static final String FALTA_CONFIRMACION = "Repite la clave para confirmarla.";

    private static final List<Paso> PASOS_INVITACION = List.of(
            new Paso("Recibiste el enlace", "Llegó a tu correo: así sabemos que la dirección es tuya."),
            new Paso("Eliges tu clave", "En esta página. Se guarda cifrada y nadie más la ve."),
            new Paso("Entras con tu correo", "Y con la clave que elegiste. La cuenta ya queda activa."));
    private static final List<Paso> PASOS_VERIFICACION = List.of(
            new Paso("Te registraste", "Con tu correo y tu nombre."),
            new Paso("Confirmas tu correo", "Con el botón de esta página."),
            new Paso("Un administrador revisa", "Te avisamos por correo cuando decida."));
    private static final List<Paso> PASOS_RESTABLECIMIENTO = List.of(
            new Paso("Pediste cambiar la clave", "El enlace llegó solo a tu correo."),
            new Paso("Eliges una clave nueva", "En esta página. La anterior deja de servir."),
            new Paso("Vuelves a entrar", "Las sesiones abiertas se cierran por seguridad."));

    private static final Presentacion INVITACION = new Presentacion("Activa tu cuenta", "Crea tu clave",
            "Es el último paso. Al guardarla, tu cuenta queda activa.", PASOS_INVITACION, 1);
    private static final Presentacion INVITACION_LISTA = new Presentacion("Activa tu cuenta", "Tu cuenta quedó activa",
            "Ya puedes entrar con tu correo y la clave que elegiste.", PASOS_INVITACION, 2);
    private static final Presentacion VERIFICACION = new Presentacion("Cuenta del panel", "Confirma tu correo",
            "Un paso más para que tu solicitud llegue a revisión.", PASOS_VERIFICACION, 1);
    private static final Presentacion VERIFICACION_LISTA = new Presentacion("Cuenta del panel", "Correo confirmado",
            "Un administrador revisará tu solicitud y te avisaremos por correo cuando decida.", PASOS_VERIFICACION, 2);
    private static final Presentacion RESTABLECIMIENTO = new Presentacion("Clave olvidada", "Elige una clave nueva",
            "La anterior deja de servir en cuanto guardes esta.", PASOS_RESTABLECIMIENTO, 1);
    private static final Presentacion RESTABLECIMIENTO_LISTO = new Presentacion("Clave olvidada",
            "Tu clave quedó cambiada", "Las sesiones abiertas se cerraron. Entra de nuevo con la clave nueva.",
            PASOS_RESTABLECIMIENTO, 2);

    private static final String BAJADA_CLAVE = "La escribes dos veces para estar seguros de que es la que quieres.";

    private final VerificarCorreoUseCase verificar;
    private final AceptarInvitacionUseCase aceptarInvitacion;
    private final RestablecerClaveUseCase restablecer;
    private final String urlFrontend;

    public EnlacesDeCuentaController(VerificarCorreoUseCase verificar,
                                     AceptarInvitacionUseCase aceptarInvitacion,
                                     RestablecerClaveUseCase restablecer,
                                     @Value("${aguavigia.app.url-frontend:http://localhost:5173}") String urlFrontend) {
        this.verificar = verificar;
        this.aceptarInvitacion = aceptarInvitacion;
        this.restablecer = restablecer;
        this.urlFrontend = urlFrontend.replaceAll("/+$", "");
    }

    @Operation(summary = "Pantalla del enlace «Confirmar mi correo»",
            description = "Muestra el botón de confirmación. No consume el token: eso ocurre al enviar el formulario.")
    @GetMapping("/verificar")
    public ResponseEntity<String> pantallaVerificar(@RequestParam String token) {
        return PaginaDeCortesia.formulario(HttpStatus.OK, VERIFICACION, formularioDeVerificacion(token), Errores.NINGUNO);
    }

    @Operation(summary = "Confirmar el correo desde el formulario de la pantalla",
            description = "Mismo efecto que POST /api/cuentas/verificacion, pero recibe el formulario y responde HTML.")
    @PostMapping(value = "/verificar", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> verificarCorreo(@RequestParam String token, HttpServletRequest peticion) {
        try {
            verificar.verificar(token, ContextoHttp.de(peticion));
            return PaginaDeCortesia.listo(VERIFICACION_LISTA, "Listo",
                    "Tu correo quedó confirmado. No tienes que hacer nada más por ahora.",
                    List.of(new Enlace("Volver a AguaVigía", urlFrontend + "/")));
        } catch (IllegalArgumentException enlaceInvalido) {
            return PaginaDeCortesia.fallo(VERIFICACION, "No pudimos confirmar tu correo", enlaceInvalido.getMessage(),
                    pedirOtroCorreo());
        }
    }

    @Operation(summary = "Pantalla del enlace de invitación",
            description = "Muestra el formulario para elegir la clave, que se escribe dos veces. No consume el token.")
    @GetMapping("/invitacion")
    public ResponseEntity<String> pantallaInvitacion(@RequestParam String token) {
        return PaginaDeCortesia.formulario(HttpStatus.OK, INVITACION, formularioDeInvitacion(token), Errores.NINGUNO);
    }

    @Operation(summary = "Aceptar la invitación desde el formulario de la pantalla",
            description = """
                    Mismo efecto que POST /api/cuentas/invitacion, pero recibe el formulario y responde HTML. \
                    `confirmacion` repite la clave: si falta o no coincide, la página vuelve con el error y no se \
                    consume el token.""")
    @PostMapping(value = "/invitacion", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> aceptarInvitacion(@RequestParam String token, @RequestParam String clave,
                                                    @RequestParam(required = false) String confirmacion,
                                                    HttpServletRequest peticion) {
        Formulario formulario = formularioDeInvitacion(token);
        ClaveConfirmada claveConfirmada = confirmar(clave, confirmacion);
        if (claveConfirmada.errores() != null) {
            return PaginaDeCortesia.formulario(HttpStatus.BAD_REQUEST, INVITACION, formulario, claveConfirmada.errores());
        }
        try {
            Usuario cuenta = aceptarInvitacion.aceptar(token, claveConfirmada.clave(), ContextoHttp.de(peticion));
            Enlace ingreso = cuenta != null && !cuenta.esVecino()
                    ? new Enlace("Ir al ingreso del panel", urlFrontend + "/panel/ingreso")
                    : new Enlace("Ir al ingreso", urlFrontend + "/vecino/ingreso");
            return PaginaDeCortesia.listo(INVITACION_LISTA, "Clave guardada",
                    "Tu cuenta está activa. Este enlace ya no sirve: si olvidas la clave, pides otra desde el ingreso.",
                    List.of(ingreso));
        } catch (IllegalArgumentException rechazada) {
            return PaginaDeCortesia.fallo(INVITACION, "No pudimos activar tu cuenta", rechazada.getMessage(),
                    pedirOtroCorreo());
        }
    }

    @Operation(summary = "Pantalla del enlace para restablecer la clave",
            description = "Muestra el formulario para elegir la clave nueva, que se escribe dos veces. No consume el token.")
    @GetMapping("/restablecer")
    public ResponseEntity<String> pantallaRestablecer(@RequestParam String token) {
        return PaginaDeCortesia.formulario(HttpStatus.OK, RESTABLECIMIENTO, formularioDeRestablecimiento(token),
                Errores.NINGUNO);
    }

    @Operation(summary = "Restablecer la clave desde el formulario de la pantalla",
            description = """
                    Mismo efecto que POST /api/cuentas/clave, pero recibe el formulario y responde HTML. \
                    `confirmacion` repite la clave: si falta o no coincide, la página vuelve con el error y no se \
                    consume el token.""")
    @PostMapping(value = "/restablecer", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> restablecerClave(@RequestParam String token, @RequestParam String clave,
                                                   @RequestParam(required = false) String confirmacion,
                                                   HttpServletRequest peticion) {
        Formulario formulario = formularioDeRestablecimiento(token);
        ClaveConfirmada claveConfirmada = confirmar(clave, confirmacion);
        if (claveConfirmada.errores() != null) {
            return PaginaDeCortesia.formulario(HttpStatus.BAD_REQUEST, RESTABLECIMIENTO, formulario,
                    claveConfirmada.errores());
        }
        try {
            restablecer.restablecer(token, claveConfirmada.clave(), ContextoHttp.de(peticion));
            // El caso de uso no dice de qué tipo es la cuenta: los dos ingresos, el de vecinos primero porque son más.
            return PaginaDeCortesia.listo(RESTABLECIMIENTO_LISTO, "Clave cambiada",
                    "Tu clave nueva ya está activa y la anterior dejó de servir.",
                    List.of(new Enlace("Ir al ingreso", urlFrontend + "/vecino/ingreso"),
                            new Enlace("Ingreso al panel", urlFrontend + "/panel/ingreso")));
        } catch (IllegalArgumentException rechazada) {
            return PaginaDeCortesia.fallo(RESTABLECIMIENTO, "No pudimos cambiar tu clave", rechazada.getMessage(),
                    new Enlace("Pide un enlace nuevo", urlFrontend + "/cuenta/olvide"));
        }
    }

    /** La clave con la política del dominio y su confirmación; el primer problema que encuentre, junto a su campo. */
    private static ClaveConfirmada confirmar(String clave, String confirmacion) {
        ClaveEnClaro valida;
        try {
            valida = new ClaveEnClaro(clave);
        } catch (IllegalArgumentException debil) {
            return new ClaveConfirmada(null, Errores.deLaClave(debil.getMessage()));
        }
        if (confirmacion == null || confirmacion.isEmpty()) {
            return new ClaveConfirmada(null, Errores.deLaConfirmacion(FALTA_CONFIRMACION));
        }
        if (!clave.equals(confirmacion)) {
            return new ClaveConfirmada(null, Errores.deLaConfirmacion(CLAVES_DISTINTAS));
        }
        return new ClaveConfirmada(valida, null);
    }

    private record ClaveConfirmada(ClaveEnClaro clave, Errores errores) {
    }

    private Enlace pedirOtroCorreo() {
        return new Enlace("Pide un enlace nuevo", urlFrontend + "/cuenta/reenviar");
    }

    private static Formulario formularioDeVerificacion(String token) {
        return new Formulario(RUTA + "verificar", token, "¿Esta dirección es tuya?",
                "Al confirmarla, un administrador revisa tu solicitud y te avisamos por correo cuando decida.",
                "Confirmar mi correo", null, false);
    }

    private static Formulario formularioDeInvitacion(String token) {
        return new Formulario(RUTA + "invitacion", token, "Elige tu clave", BAJADA_CLAVE, "Crear mi clave",
                "Después entras con tu correo y esta clave.", true);
    }

    private static Formulario formularioDeRestablecimiento(String token) {
        return new Formulario(RUTA + "restablecer", token, "Tu clave nueva", BAJADA_CLAVE, "Cambiar mi clave",
                "Al cambiarla se cierran todas las sesiones abiertas de tu cuenta.", true);
    }
}
