package com.aguavigia.ctg.api.dto;

import com.aguavigia.ctg.domain.VerificacionDeBitacora;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "El estado de la cadena de hashes de la bitácora inmutable (ADR-113): cada evento guarda el hash del anterior, así que alterar uno rompe la cadena")
public record IntegridadBitacoraRespuesta(
        @Schema(description = "Eventos que tiene la bitácora inmutable")
        long eventos,
        @Schema(description = "Eslabones que no cuadran; 0 en una cadena sana")
        long eslabonesRotos,
        boolean cadenaValida,
        @Schema(description = "Hash del último evento: resume toda la historia hasta ahí. Nulo si la bitácora está vacía", nullable = true)
        String ultimoHash) {

    public static IntegridadBitacoraRespuesta de(VerificacionDeBitacora v) {
        return new IntegridadBitacoraRespuesta(v.eventos(), v.eslabonesRotos(), v.cadenaValida(), v.ultimoHash());
    }
}
