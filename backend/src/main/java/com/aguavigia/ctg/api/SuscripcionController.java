package com.aguavigia.ctg.api;

import com.aguavigia.ctg.api.PaginaDeCortesia.Enlace;
import com.aguavigia.ctg.api.PaginaDeCortesia.Errores;
import com.aguavigia.ctg.api.PaginaDeCortesia.Formulario;
import com.aguavigia.ctg.api.PaginaDeCortesia.Paso;
import com.aguavigia.ctg.api.PaginaDeCortesia.Presentacion;
import com.aguavigia.ctg.api.dto.SolicitudSuscripcion;
import com.aguavigia.ctg.api.dto.SuscripcionRespuesta;
import com.aguavigia.ctg.api.mapper.SuscripcionApiMapper;
import com.aguavigia.ctg.domain.CorreoElectronico;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.port.in.CancelarSuscripcionUseCase;
import com.aguavigia.ctg.domain.port.in.ConfirmarSuscripcionUseCase;
import com.aguavigia.ctg.domain.port.in.SuscribirseUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * M4 — RF012-RF015: suscribirse, confirmar por doble opt-in y darse de baja en 1 clic. Los enlaces de los
 * correos son GET que solo muestran un botón; confirmar y cancelar son POST (`ADR-054`).
 */
@Tag(name = "Suscripciones", description = "Alertas por correo cuando cambia el estado de un sector")
@RestController
@RequestMapping(value = "/api/suscripciones", produces = MediaType.APPLICATION_JSON_VALUE)
public class SuscripcionController {

    private static final String RUTA = "/api/suscripciones/";

    private static final List<Paso> PASOS_CONFIRMACION = List.of(
            new Paso("Pediste los avisos", "Eligiendo tus barrios en AguaVigía."),
            new Paso("Confirmas tu correo", "Con el botón de esta página."),
            new Paso("Recibes los avisos", "Cuando cambie el estado del servicio en tus barrios."));
    private static final List<Paso> PASOS_BAJA = List.of(
            new Paso("Recibías avisos", "Del estado del servicio en tus barrios."),
            new Paso("Te das de baja", "Con el botón de esta página."),
            new Paso("No llegan más correos", "Puedes volver a pedirlos cuando quieras."));
    private static final Presentacion CONFIRMACION = new Presentacion("Avisos por correo", "Confirma tus avisos",
            "Un paso más: confirma que quieres recibir los avisos del estado del servicio.", PASOS_CONFIRMACION, 1);
    private static final Presentacion CONFIRMACION_LISTA = new Presentacion("Avisos por correo", "Suscripción confirmada",
            "Ya vas a recibir un aviso cuando cambie el estado del servicio en tu sector.", PASOS_CONFIRMACION, 2);
    private static final Presentacion BAJA = new Presentacion("Avisos por correo", "Darte de baja",
            "Si sigues, dejarás de recibir avisos de AguaVigía para ese sector.", PASOS_BAJA, 1);
    private static final Presentacion BAJA_LISTA = new Presentacion("Avisos por correo", "Baja confirmada",
            "Ya no vas a recibir más avisos de AguaVigía para ese sector.", PASOS_BAJA, 2);

    private final SuscribirseUseCase suscribirse;
    private final ConfirmarSuscripcionUseCase confirmarSuscripcion;
    private final CancelarSuscripcionUseCase cancelarSuscripcion;
    private final SuscripcionApiMapper mapper;
    private final String urlFrontend;

    public SuscripcionController(SuscribirseUseCase suscribirse,
                                  ConfirmarSuscripcionUseCase confirmarSuscripcion,
                                  CancelarSuscripcionUseCase cancelarSuscripcion,
                                  SuscripcionApiMapper mapper,
                                  @Value("${aguavigia.app.url-frontend:http://localhost:5173}") String urlFrontend) {
        this.suscribirse = suscribirse;
        this.confirmarSuscripcion = confirmarSuscripcion;
        this.cancelarSuscripcion = cancelarSuscripcion;
        this.mapper = mapper;
        this.urlFrontend = urlFrontend.replaceAll("/+$", "");
    }

    @Operation(summary = "Suscribirse a los avisos de uno o más sectores",
            description = """
                    Crea la suscripción en PENDIENTE_CONFIRMACION y envía un correo de doble
                    opt-in (Ley 1581/2012, RF013). No empieza a recibir avisos hasta confirmarla.""")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Suscripción creada, correo de confirmación en camino"),
            @ApiResponse(responseCode = "400", description = "Correo inválido o algún sector no existe",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping
    public ResponseEntity<SuscripcionRespuesta> suscribirse(@Valid @RequestBody SolicitudSuscripcion solicitud) {
        var suscripcion = suscribirse.suscribir(
                new CorreoElectronico(solicitud.correo()),
                solicitud.sectorIds().stream().map(SectorId::new).toList());

        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.aRespuesta(suscripcion));
    }

    @Operation(summary = "Pantalla del enlace «Confirmar» del correo",
            description = """
                    Página a la que lleva el enlace del correo. Solo muestra un botón: NO confirma nada, porque un
                    antivirus o una vista previa de enlaces abre los GET sin que nadie los pida (`ADR-054`). La
                    acción ocurre al enviar el formulario, que hace POST a la misma ruta.""")
    @ApiResponse(responseCode = "200", description = "Página con el botón")
    @GetMapping(value = "/confirmar", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> pantallaConfirmar(@RequestParam String token) {
        return PaginaDeCortesia.formulario(HttpStatus.OK, CONFIRMACION, new Formulario(RUTA + "confirmar", token,
                "¿Quieres recibir los avisos?", "Te escribimos solo cuando cambie el estado del servicio en tus barrios.",
                "Confirmar mi suscripción", "Cada aviso trae un enlace para darte de baja.", false), Errores.NINGUNO);
    }

    @Operation(summary = "Confirmar la suscripción (doble opt-in)",
            description = """
                    Acción del botón de la página de confirmación (o de un cliente de API). El token es de un solo enlace, no de un solo uso:
                    confirmarla dos veces no falla (RF013). Responde JSON o una página HTML de cortesía
                    según el `Accept` de quien pide: el formulario de la página responde HTML y un cliente de API
                    responde JSON. `token` va como parámetro de consulta o del formulario.""")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Suscripción confirmada"),
            @ApiResponse(responseCode = "400", description = "Token inválido, inexistente o de una suscripción ya cancelada",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping(value = "/confirmar", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_HTML_VALUE})
    public ResponseEntity<?> confirmar(@RequestParam String token,
                                        @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String accept) {
        if (prefiereHtml(accept)) {
            try {
                confirmarSuscripcion.confirmar(token);
                return PaginaDeCortesia.listo(CONFIRMACION_LISTA, "Listo",
                        "Tu correo quedó confirmado para los avisos.", List.of(new Enlace("Ver el mapa", urlFrontend + "/")));
            } catch (IllegalArgumentException e) {
                return PaginaDeCortesia.fallo(CONFIRMACION, "No pudimos confirmar tu suscripción", e.getMessage(),
                        new Enlace("Pide los avisos otra vez", urlFrontend + "/avisos"));
            }
        }
        var suscripcion = confirmarSuscripcion.confirmar(token);
        return ResponseEntity.ok(mapper.aRespuesta(suscripcion));
    }

    @Operation(summary = "Pantalla del enlace de baja de todo correo (RF015)",
            description = """
                    Página a la que lleva el enlace del correo. Solo muestra un botón: NO cancela nada, porque un
                    antivirus o una vista previa de enlaces abre los GET sin que nadie los pida (`ADR-054`). La
                    acción ocurre al enviar el formulario, que hace POST a la misma ruta.""")
    @ApiResponse(responseCode = "200", description = "Página con el botón")
    @GetMapping(value = "/cancelar", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> pantallaCancelar(@RequestParam String token) {
        return PaginaDeCortesia.formulario(HttpStatus.OK, BAJA, new Formulario(RUTA + "cancelar", token,
                "¿Dejas de recibir los avisos?", "No te llegarán más correos de AguaVigía para ese sector.",
                "Darme de baja", null, false), Errores.NINGUNO);
    }

    @Operation(summary = "Darse de baja en un clic (RF015)",
            description = """
                    Acción del botón de la página de baja (o de un cliente de API). Sin pedir credenciales: el token que llega en cada correo es suficiente. Responde
                    JSON o una página HTML de cortesía según el `Accept` de quien pide (mismo motivo
                    que en {@code /confirmar}).""")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Suscripción cancelada"),
            @ApiResponse(responseCode = "400", description = "Token inválido o inexistente",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping(value = "/cancelar", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_HTML_VALUE})
    public ResponseEntity<?> cancelar(@RequestParam String token,
                                       @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String accept) {
        if (prefiereHtml(accept)) {
            try {
                cancelarSuscripcion.cancelar(token);
                return PaginaDeCortesia.listo(BAJA_LISTA, "Listo", "Ya no vas a recibir más avisos de AguaVigía para ese sector.",
                        List.of(new Enlace("Ver el mapa", urlFrontend + "/")));
            } catch (IllegalArgumentException e) {
                return PaginaDeCortesia.fallo(BAJA, "No pudimos procesar la baja", e.getMessage(),
                        new Enlace("Gestiona tus avisos", urlFrontend + "/avisos"));
            }
        }
        var suscripcion = cancelarSuscripcion.cancelar(token);
        return ResponseEntity.ok(mapper.aRespuesta(suscripcion));
    }

    /**
     * Un navegador que abre el enlace del correo siempre manda {@code text/html} en su
     * `Accept` (con o sin `q` explícito); un cliente de API que quiere JSON no lo incluye.
     * Sin `Accept` (curl a pelo, MockMvc por defecto) se mantiene el JSON de siempre.
     */
    private static boolean prefiereHtml(String accept) {
        return accept != null && accept.contains(MediaType.TEXT_HTML_VALUE);
    }

}
