package com.aguavigia.ctg.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@Schema(description = "Cuánto generar al azar para llenar la simulación (ADR-111). Lo que falte toma el valor por defecto.")
public record SolicitudDatosSinteticos(
        @Schema(description = "Reportes ciudadanos a generar (0 a 200 000); por defecto 0")
        @Min(0) @Max(200_000) Integer reportes,

        @Schema(description = "Cortes a generar, cada uno con sus barrios, cierres y bitácora (0 a 5 000); por defecto 0")
        @Min(0) @Max(5_000) Integer cortes,

        @Schema(description = "Dispositivos distintos entre los que se reparten los reportes (1 a 50 000); por defecto 9 000")
        @Min(1) @Max(50_000) Integer dispositivos,

        @Schema(description = "Cuántos días hacia atrás se reparten los datos (1 a 330, por el TTL de 365 días de los reportes); por defecto 300")
        @Min(1) @Max(330) Integer dias,

        @Schema(description = "Semilla: la misma da la misma corrida. Si falta, se sortea y se devuelve")
        Long semilla) {
}
