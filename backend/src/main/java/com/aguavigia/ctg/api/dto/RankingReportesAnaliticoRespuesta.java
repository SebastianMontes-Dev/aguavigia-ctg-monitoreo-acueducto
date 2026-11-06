package com.aguavigia.ctg.api.dto;

import com.aguavigia.ctg.domain.RankingDeBarrioAnalitico;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

@Schema(description = "Barrios con más reportes en los últimos 30 días con datos, desde la copia analítica (ADR-112)")
public record RankingReportesAnaliticoRespuesta(
        @Schema(description = "Cuándo terminó la última copia que cuadró con MongoDB; nulo si todavía no hay ninguna", nullable = true)
        Instant copiadoEn,
        List<Barrio> barrios) {

    @Schema(description = "Un barrio del ranking. `posicion` se repite entre empates; los reportes descartados no cuentan")
    public record Barrio(int posicion, String sectorId, String nombre, long reportes, long sinAgua, long presionBaja,
                         double porcentajeDeLaCiudad) {
        public static Barrio de(RankingDeBarrioAnalitico barrio) {
            return new Barrio(barrio.posicion(), barrio.sectorId(), barrio.nombre(), barrio.reportes(), barrio.sinAgua(),
                    barrio.presionBaja(), barrio.porcentajeDeLaCiudad());
        }
    }
}
