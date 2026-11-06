package com.aguavigia.ctg.domain.port.in;

import com.aguavigia.ctg.domain.SectorId;

import java.util.List;
import java.util.Map;

public interface CalcularEstadisticasUseCase {

    EstadisticasGlobales calcularGlobales();

    record EstadisticaSector(SectorId sectorId, String nombre, int cantidadCortes) {}

    record EstadisticasGlobales(
            List<EstadisticaSector> sectoresMasAfectados,
            Map<String, Integer> cortesPorDiaDeSemana,
            /** Media en horas de los cortes cerrados. Nula si no hay ninguno: «sin dato» no es «cero horas» (ADR-036). */
            Double duracionPromedioHoras
    ) {}
}
