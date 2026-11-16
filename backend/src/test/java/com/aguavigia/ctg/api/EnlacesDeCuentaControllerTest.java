package com.aguavigia.ctg.api;

import com.aguavigia.ctg.api.error.ManejadorGlobalDeErrores;
import com.aguavigia.ctg.domain.ClaveEnClaro;
import com.aguavigia.ctg.domain.ClaveHash;
import com.aguavigia.ctg.domain.ContextoDeAccion;
import com.aguavigia.ctg.domain.CorreoElectronico;
import com.aguavigia.ctg.domain.Usuario;
import com.aguavigia.ctg.domain.UsuarioId;
import com.aguavigia.ctg.domain.port.in.AceptarInvitacionUseCase;
import com.aguavigia.ctg.domain.port.in.RestablecerClaveUseCase;
import com.aguavigia.ctg.domain.port.in.VerificarCorreoUseCase;
import com.aguavigia.ctg.domain.port.out.RevocacionSesionPort;
import com.aguavigia.ctg.infrastructure.config.SecurityConfig;
import com.aguavigia.ctg.infrastructure.security.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EnlacesDeCuentaController.class)
@Import({ManejadorGlobalDeErrores.class, SecurityConfig.class})
@TestPropertySource(properties = "aguavigia.rate-limit.reglas=")
class EnlacesDeCuentaControllerTest {

    private static final String TOKEN = "tok-123_abc";
    private static final String CLAVE_VALIDA = "ClaveSegura123#!";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private VerificarCorreoUseCase verificar;

    @MockitoBean
    private AceptarInvitacionUseCase aceptarInvitacion;

    @MockitoBean
    private RestablecerClaveUseCase restablecer;

    // SecurityConfig los necesita aunque estas rutas sean públicas (ver CuentaPublicaControllerTest).
    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private RevocacionSesionPort revocacion;

    @MockitoBean(name = "redisTemplate")
    private RedisTemplate<String, String> redisTemplateMock;

    @Test
    void abrirElEnlaceDeVerificacionDebeMostrarElFormularioSinConsumirElToken() throws Exception {
        mockMvc.perform(get("/api/cuentas/enlaces/verificar").param("token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "action=\"/api/cuentas/enlaces/verificar\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "name=\"token\" value=\"" + TOKEN + "\"")));

        // Los antivirus de correo precargan los enlaces: abrirlo no puede gastar un token de un solo uso.
        verifyNoInteractions(verificar);
    }

    private static final Instant AHORA = Instant.parse("2026-10-01T15:00:00Z");
    private static final ClaveHash HASH =
            new ClaveHash("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");

    private static Usuario cuentaDelPanelVerificada() {
        return Usuario.registrado(new UsuarioId("u-1"), new CorreoElectronico("ana@ejemplo.org"), "Ana", HASH, AHORA)
                .verificarCorreo(AHORA);
    }

    @Test
    void enviarElFormularioDeVerificacionDebeConfirmarElCorreo() throws Exception {
        given(verificar.verificar(eq(TOKEN), any(ContextoDeAccion.class))).willReturn(cuentaDelPanelVerificada());

        mockMvc.perform(post("/api/cuentas/enlaces/verificar")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Correo confirmado")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Un administrador revisará")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("href=\"http://localhost:5173/\"")));

        verify(verificar).verificar(eq(TOKEN), any(ContextoDeAccion.class));
    }

    @Test
    void unTokenDeVerificacionInvalidoDebeResponder400ConUnaPaginaClara() throws Exception {
        willThrow(new IllegalArgumentException("El enlace no es válido o ya venció"))
                .given(verificar).verificar(eq("malo"), any(ContextoDeAccion.class));

        mockMvc.perform(post("/api/cuentas/enlaces/verificar")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", "malo"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "El enlace no es válido o ya venció")));
    }

    @Test
    void abrirElEnlaceDeInvitacionDebeMostrarElCampoDeClaveSinAceptarNada() throws Exception {
        mockMvc.perform(get("/api/cuentas/enlaces/invitacion").param("token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("type=\"password\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "action=\"/api/cuentas/enlaces/invitacion\"")));

        verifyNoInteractions(aceptarInvitacion);
    }

    @Test
    void enviarLaInvitacionConUnaClaveValidaDebeActivarLaCuenta() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", CLAVE_VALIDA))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Tu cuenta quedó activa")))
                // Una cuenta de vecino sigue en el ingreso de vecinos.
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "href=\"http://localhost:5173/vecino/ingreso\"")));

        verify(aceptarInvitacion).aceptar(eq(TOKEN), eq(new ClaveEnClaro(CLAVE_VALIDA)), any(ContextoDeAccion.class));
    }

    @Test
    void unaClaveDebilEnLaInvitacionDebeVolverAMostrarElFormularioConElMotivo() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("type=\"password\"")))
                // El token viaja de nuevo para que reintentar no obligue a pedir otro correo.
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "name=\"token\" value=\"" + TOKEN + "\"")));

        verifyNoInteractions(aceptarInvitacion);
    }

    @Test
    void abrirElEnlaceDeRestablecimientoDebeMostrarElFormularioSinCambiarLaClave() throws Exception {
        mockMvc.perform(get("/api/cuentas/enlaces/restablecer").param("token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "action=\"/api/cuentas/enlaces/restablecer\"")));

        verifyNoInteractions(restablecer);
    }

    @Test
    void enviarElRestablecimientoConUnaClaveValidaDebeCambiarLaClave() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/restablecer")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", CLAVE_VALIDA))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Tu clave quedó cambiada")));

        verify(restablecer).restablecer(eq(TOKEN), eq(new ClaveEnClaro(CLAVE_VALIDA)), any(ContextoDeAccion.class));
    }

    @Test
    void unTokenDeRestablecimientoVencidoDebeResponder400() throws Exception {
        willThrow(new IllegalArgumentException("El enlace no es válido o ya venció"))
                .given(restablecer).restablecer(eq("viejo"), any(ClaveEnClaro.class), any(ContextoDeAccion.class));

        mockMvc.perform(post("/api/cuentas/enlaces/restablecer")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", "viejo")
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", CLAVE_VALIDA))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "El enlace no es válido o ya venció")));
    }

    @Test
    void unTokenConHtmlNoDebeInyectarseSinEscaparEnLaPagina() throws Exception {
        String malicioso = "\"><script>alert(1)</script>";

        mockMvc.perform(get("/api/cuentas/enlaces/restablecer").param("token", malicioso))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("<script>alert(1)"))))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("&lt;script&gt;")));
    }

    // Hotfix 1.0.1: con `no-referrer` el navegador manda `Origin: null` en el POST del formulario y la cadena de CORS
    // responde 403 «Invalid CORS request». La cabecera y la etiqueta deben decir lo mismo, y la cadena de seguridad
    // (importada en este test) no debe pisar la cabecera con su `no-referrer` global.
    @Test
    void lasPaginasDeEnlacesDebenUsarLaPoliticaDeReferenciaSameOriginParaQueElFormularioPaseCors() throws Exception {
        for (String ruta : new String[] {"verificar", "invitacion", "restablecer"}) {
            mockMvc.perform(get("/api/cuentas/enlaces/" + ruta).param("token", TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Referrer-Policy", "same-origin"))
                    .andExpect(content().string(org.hamcrest.Matchers.containsString(
                            "<meta name=\"referrer\" content=\"same-origin\">")))
                    .andExpect(content().string(org.hamcrest.Matchers.not(
                            org.hamcrest.Matchers.containsString("no-referrer"))));
        }
    }

    // ADR-115: el ojo necesita un script. La CSP final (con la cadena de seguridad importada) debe autorizar ese script
    // exacto por su hash, sin `unsafe-inline` para scripts, y conservar el resto de directivas cerradas.
    @Test
    void lasPaginasQuePidenClaveDebenAutorizarSoloElScriptDelOjoPorSuHash() throws Exception {
        String hash = PaginaDeCortesia.hashCsp(PaginaDeCortesia.SCRIPT_VER_CLAVE);
        for (String ruta : new String[] {"invitacion", "restablecer"}) {
            String html = mockMvc.perform(get("/api/cuentas/enlaces/" + ruta).param("token", TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(header().stringValues("Content-Security-Policy",
                            "default-src 'none'; style-src 'unsafe-inline'; script-src '" + hash + "'; "
                                    + "form-action 'self'; base-uri 'none'; frame-ancestors 'none'"))
                    .andReturn().getResponse().getContentAsString();

            // El hash se calcula sobre el texto que de verdad va entre <script> y </script>.
            java.util.regex.Matcher script = java.util.regex.Pattern.compile("<script>(.*?)</script>",
                    java.util.regex.Pattern.DOTALL).matcher(html);
            org.assertj.core.api.Assertions.assertThat(script.find()).isTrue();
            org.assertj.core.api.Assertions.assertThat(PaginaDeCortesia.hashCsp(script.group(1))).isEqualTo(hash);
            org.assertj.core.api.Assertions.assertThat(script.find()).as("un solo script").isFalse();
        }
    }

    @Test
    void elOjoDebeIrDentroDeCadaCampoDeClaveYSalirOcultoHastaQueCorraElScript() throws Exception {
        String html = mockMvc.perform(get("/api/cuentas/enlaces/invitacion").param("token", TOKEN))
                .andReturn().getResponse().getContentAsString();

        for (String campo : new String[] {"clave", "confirmacion"}) {
            org.assertj.core.api.Assertions.assertThat(html).contains(
                    "<button class=\"ver\" type=\"button\" aria-controls=\"" + campo + "\" aria-pressed=\"false\""
                            + " aria-label=\"Mostrar la clave\" hidden>");
        }
        org.assertj.core.api.Assertions.assertThat(html).contains("minlength=\"9\"");
    }

    @Test
    void lasPaginasSinCampoDeClaveNoDebenLlevarScriptNiCambiarLaCspDeLaApi() throws Exception {
        mockMvc.perform(get("/api/cuentas/enlaces/verificar").param("token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("script-src"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("<script"))));
    }

    @Test
    void unaClaveSinMayusculaDebeVolverAlFormularioConElMotivo() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", "cartagena#1")
                        .param("confirmacion", "cartagena#1"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "Añade al menos una letra mayúscula a la clave")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<div class=\"caja\" data-invalido>")));

        verifyNoInteractions(aceptarInvitacion);
    }

    @Test
    void elFormularioDeInvitacionDebePedirLaClaveDosVeces() throws Exception {
        mockMvc.perform(get("/api/cuentas/enlaces/invitacion").param("token", TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("id=\"clave\" name=\"clave\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "id=\"confirmacion\" name=\"confirmacion\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Repite la clave")));
    }

    @Test
    void dosClavesDistintasEnLaInvitacionDebenVolverAlFormularioSinConsumirElToken() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", "OtraClaveSegura456#"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        EnlacesDeCuentaController.CLAVES_DISTINTAS)))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("aria-invalid=\"true\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "name=\"token\" value=\"" + TOKEN + "\"")))
                // Las claves nunca vuelven escritas en la página.
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(CLAVE_VALIDA))))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("OtraClaveSegura456#"))));

        verifyNoInteractions(aceptarInvitacion);
    }

    @Test
    void laTareaEntraAnimadaAlAbrirElEnlacePeroNoAlVolverConUnError() throws Exception {
        mockMvc.perform(get("/api/cuentas/enlaces/invitacion").param("token", TOKEN))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<main class=\"pantalla\" data-entrada>")));

        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", "distinta-de-la-clave"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("<main class=\"pantalla\">")));
    }

    @Test
    void unaInvitacionSinConfirmacionDebePedirQueSeRepitaLaClave() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        EnlacesDeCuentaController.FALTA_CONFIRMACION)));

        verifyNoInteractions(aceptarInvitacion);
    }

    @Test
    void unaCuentaDelPanelActivadaDebeIrAlIngresoDelPanel() throws Exception {
        given(aceptarInvitacion.aceptar(eq(TOKEN), any(ClaveEnClaro.class), any(ContextoDeAccion.class)))
                .willReturn(cuentaDelPanelVerificada());

        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", CLAVE_VALIDA))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "href=\"http://localhost:5173/panel/ingreso\"")));
    }

    @Test
    void unEnlaceDeInvitacionVencidoDebeExplicarComoPedirOtro() throws Exception {
        willThrow(new IllegalArgumentException("El enlace no es válido"))
                .given(aceptarInvitacion).aceptar(eq("viejo"), any(ClaveEnClaro.class), any(ContextoDeAccion.class));

        mockMvc.perform(post("/api/cuentas/enlaces/invitacion")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", "viejo")
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", CLAVE_VALIDA))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("El enlace no es válido")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "href=\"http://localhost:5173/cuenta/reenviar\"")))
                // Con un enlace que ya no sirve no hay nada que reintentar: la página no vuelve a pedir la clave.
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("type=\"password\""))));
    }

    @Test
    void dosClavesDistintasEnElRestablecimientoNoDebenCambiarLaClave() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/restablecer")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", CLAVE_VALIDA)
                        .param("confirmacion", CLAVE_VALIDA + "x"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        EnlacesDeCuentaController.CLAVES_DISTINTAS)));

        verifyNoInteractions(restablecer);
    }

    @Test
    void unaClaveDebilDebeMarcarseEnElPrimerCampoAntesQueLaConfirmacion() throws Exception {
        mockMvc.perform(post("/api/cuentas/enlaces/restablecer")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", TOKEN)
                        .param("clave", "corta")
                        .param("confirmacion", "otra"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("al menos 9 caracteres")))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(EnlacesDeCuentaController.CLAVES_DISTINTAS))));

        verifyNoInteractions(restablecer);
    }

    @Test
    void elMensajeDeUnaExcepcionNoDebeInyectarseSinEscaparEnLaPagina() throws Exception {
        willThrow(new IllegalArgumentException("<img src=x onerror=alert(1)>"))
                .given(verificar).verificar(eq("t"), any(ContextoDeAccion.class));

        mockMvc.perform(post("/api/cuentas/enlaces/verificar")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", "t"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("<img src=x"))));
    }
}
