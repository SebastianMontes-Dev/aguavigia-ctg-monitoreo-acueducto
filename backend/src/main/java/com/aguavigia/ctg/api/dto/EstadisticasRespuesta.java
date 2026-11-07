package com.aguavigia.ctg.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

@Schema(description = "Estadísticas públicas globales (M7, RF023)")
public record EstadisticasRespuesta(
        List<EstadisticaSectorRespuesta> sectoresMasAfectados,
        Map<String, Integer> cortesPorDiaDeSemana,
        @Schema(nullable = true, description = "Media en horas de los cortes cerrados; nula si no hay ninguno")
        Double duracionPromedioHoras) {

    @Schema(description = "Sector con las veces que aparece en avisos de corte de Acuacar aprobados (no son cortes con duración medida)")
    public record EstadisticaSectorRespuesta(String sectorId, String nombre, int cantidadCortes) {}
}
