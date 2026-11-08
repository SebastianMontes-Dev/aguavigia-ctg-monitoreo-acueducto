package com.aguavigia.ctg.api.dto;

import com.aguavigia.ctg.domain.PuntoTendenciaAnalitico;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Reportes por día con su media móvil de 7 días, desde la copia analítica (ADR-112)")
public record TendenciaReportesAnaliticaRespuesta(
        @Schema(description = "Cuándo terminó la última copia que cuadró con MongoDB; nulo si todavía no hay ninguna", nullable = true)
        Instant copiadoEn,
        List<Punto> puntos) {

    @Schema(description = "Un día (hora de Cartagena). Los días sin reportes valen 0; los descartados no cuentan")
    public record Punto(LocalDate dia, long reportes, double media7Dias,
                        @Schema(description = "Frente al día anterior; nulo en el primer día de la serie", nullable = true)
                        Long cambioRespectoAlDiaAnterior) {
        public static Punto de(PuntoTendenciaAnalitico punto) {
            return new Punto(punto.dia(), punto.reportes(), punto.media7Dias(), punto.cambioRespectoAlDiaAnterior());
        }
    }
}
