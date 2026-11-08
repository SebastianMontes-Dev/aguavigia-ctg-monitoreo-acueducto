package com.aguavigia.ctg.api.dto;

import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Cuántos documentos sintéticos se generaron, o hay hoy en la simulación (ADR-111)")
public record DatosSinteticosRespuesta(
        long dispositivos, long reportes, long cortes, long eventosBitacora,
        @Schema(description = "Semilla de la corrida; nula cuando solo se cuenta lo que ya hay", nullable = true)
        Long semilla) {

    public static DatosSinteticosRespuesta de(ResumenDeDatosSinteticos resumen) {
        return new DatosSinteticosRespuesta(resumen.dispositivos(), resumen.reportes(), resumen.cortes(),
                resumen.eventos(), resumen.semilla());
    }
}
