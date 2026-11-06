package com.aguavigia.ctg.api;

import com.aguavigia.ctg.api.dto.CopiaAnaliticaRespuesta;
import com.aguavigia.ctg.api.dto.CumplimientoAnaliticoRespuesta;
import com.aguavigia.ctg.api.dto.RankingReportesAnaliticoRespuesta;
import com.aguavigia.ctg.api.dto.TendenciaReportesAnaliticaRespuesta;
import com.aguavigia.ctg.api.dto.SerieMensualAnaliticaRespuesta;
import com.aguavigia.ctg.api.error.RecursoNoEncontradoException;
import com.aguavigia.ctg.api.mapper.AnaliticaApiMapper;
import com.aguavigia.ctg.domain.CumplimientoAnalitico;
import com.aguavigia.ctg.domain.port.out.ConsultaAnaliticaPort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * El Índice de Cumplimiento según la copia analítica en PostgreSQL (ADR-100). Solo lectura y sin regla de negocio, así que depende del
 * puerto de consulta directamente (ADR-015). Los endpoints de siempre (`/api/cumplimiento`) siguen leyendo de MongoDB: estos son rutas
 * nuevas y opcionales. Con la copia apagada o PostgreSQL caído responden 503, y nunca suplen la consulta leyendo de MongoDB.
 */
@Tag(name = "Analítica", description = "Índice de Cumplimiento desde la copia analítica en PostgreSQL (ADR-100)")
@RestController
@RequestMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
public class AnaliticaController {

    private final ConsultaAnaliticaPort consulta;
    private final AnaliticaApiMapper mapper;

    public AnaliticaController(ConsultaAnaliticaPort consulta, AnaliticaApiMapper mapper) {
        this.consulta = consulta;
        this.mapper = mapper;
    }

    @Operation(operationId = "cumplimientoAnalitico", summary = "Índice de Cumplimiento desde la copia SQL",
            description = "El índice global de la ciudad, o el de un barrio con `sectorId`. Misma fórmula que "
                    + "`GET /api/cumplimiento`, calculada por una vista de PostgreSQL sobre la copia, que va hasta 5 minutos por "
                    + "detrás de MongoDB.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Índice calculado"),
            @ApiResponse(responseCode = "404", description = "El barrio no existe en la copia",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/analitica/cumplimiento")
    public CumplimientoAnaliticoRespuesta cumplimiento(@RequestParam(required = false) String sectorId) {
        CumplimientoAnalitico indice = sectorId == null
                ? consulta.cumplimientoGlobal()
                : consulta.cumplimientoDe(sectorId)
                        .orElseThrow(() -> new RecursoNoEncontradoException("No existe el barrio '" + sectorId + "' en la copia analítica"));
        return mapper.aRespuesta(indice, consulta.ultimaCopiaOk().orElse(null));
    }

    @Operation(operationId = "cumplimientoAnaliticoMensual", summary = "Serie mensual del Índice desde la copia SQL",
            description = "El índice agrupado por mes en hora de Cartagena, de más antiguo a más reciente.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Serie calculada"),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/analitica/cumplimiento/mensual")
    public SerieMensualAnaliticaRespuesta cumplimientoMensual() {
        Instant copiadoEn = consulta.ultimaCopiaOk().orElse(null);
        return new SerieMensualAnaliticaRespuesta(copiadoEn, mapper.aRespuestas(consulta.cumplimientoMensual()));
    }

    @Operation(operationId = "rankingDeReportesAnalitico", summary = "Barrios con más reportes, desde la copia SQL",
            description = "El ranking de los últimos 30 días con datos (se cuenta hacia atrás desde el último día copiado), sin contar los reportes "
                    + "descartados. Lo calcula una vista de PostgreSQL con `RANK()`: los empates comparten posición. `limite` va de 1 a 50.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ranking calculado"),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/analitica/reportes/ranking")
    public RankingReportesAnaliticoRespuesta rankingDeReportes(@RequestParam(defaultValue = "10") int limite) {
        Instant copiadoEn = consulta.ultimaCopiaOk().orElse(null);
        return new RankingReportesAnaliticoRespuesta(copiadoEn, consulta.rankingDeBarrios(Math.max(1, Math.min(50, limite))).stream()
                .map(RankingReportesAnaliticoRespuesta.Barrio::de).toList());
    }

    @Operation(operationId = "tendenciaDeReportesAnalitica", summary = "Reportes por día con media móvil, desde la copia SQL",
            description = "Los últimos `dias` días con datos (de 1 a 365), de más antiguo a más reciente, sin huecos y sin contar los reportes descartados. "
                    + "La media móvil de 7 días la calcula PostgreSQL con una función de ventana.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Serie calculada"),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/analitica/reportes/tendencia")
    public TendenciaReportesAnaliticaRespuesta tendenciaDeReportes(@RequestParam(defaultValue = "30") int dias) {
        Instant copiadoEn = consulta.ultimaCopiaOk().orElse(null);
        return new TendenciaReportesAnaliticaRespuesta(copiadoEn, consulta.tendenciaDeReportes(Math.max(1, Math.min(365, dias))).stream()
                .map(TendenciaReportesAnaliticaRespuesta.Punto::de).toList());
    }

    @Operation(operationId = "integridadDeLaBitacora", summary = "Integridad de la bitácora inmutable (cadena de hashes)",
            description = "La bitácora pública se copia a PostgreSQL en una tabla que solo admite agregar y en la que cada evento guarda el hash del "
                    + "anterior. Esto comprueba la cadena: `cadenaValida` es falso si alguien alteró o borró un evento, aunque haya esquivado el bloqueo.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado de la cadena"),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/analitica/bitacora/integridad")
    public com.aguavigia.ctg.api.dto.IntegridadBitacoraRespuesta integridadDeLaBitacora() {
        return com.aguavigia.ctg.api.dto.IntegridadBitacoraRespuesta.de(consulta.integridadDeBitacora());
    }

    @Operation(operationId = "ultimasVigilanciasAnaliticas", summary = "Últimas revisiones del vigilante de la copia analítica",
            description = "Cada revisión compara Mongo con PostgreSQL barrio por barrio (pares, cierres, segundos de cierre y reportes), cuenta las "
                    + "referencias colgantes y comprueba la cadena de la bitácora inmutable. `detalle` dice qué descuadra. Avisa; no corrige.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Las revisiones, de la más reciente a la más antigua"),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada o PostgreSQL no responde",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PreAuthorize("hasAuthority('PERM_VER_PANEL')")
    @GetMapping("/veedor/analitica/vigilancia")
    public List<com.aguavigia.ctg.api.dto.VigilanciaAnaliticaRespuesta> ultimasVigilancias(@RequestParam(defaultValue = "20") int limite) {
        return consulta.ultimasVigilancias(Math.max(1, Math.min(200, limite))).stream()
                .map(com.aguavigia.ctg.api.dto.VigilanciaAnaliticaRespuesta::de).toList();
    }

    @Operation(operationId = "ultimasCopiasAnaliticas", summary = "Últimas copias de MongoDB a la base analítica",
            description = "Cuándo corrió cada copia, cuánto copió y si los conteos de las dos bases cuadraron. Es donde se ve el estado "
                    + "de la copia: `/actuator/health` no la incluye a propósito.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Las copias, de la más reciente a la más antigua"),
            @ApiResponse(responseCode = "503", description = "La copia analítica está apagada o PostgreSQL no responde",
                    content = @Content(mediaType = "application/problem+json",
                            schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PreAuthorize("hasAuthority('PERM_VER_PANEL')")
    @GetMapping("/veedor/analitica/copia")
    public List<CopiaAnaliticaRespuesta> ultimasCopias(@RequestParam(defaultValue = "20") int limite) {
        return mapper.aRespuestasDeCopias(consulta.ultimasCopias(Math.max(1, Math.min(200, limite))));
    }
}
