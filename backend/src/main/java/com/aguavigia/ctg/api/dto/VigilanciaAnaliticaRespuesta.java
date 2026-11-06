package com.aguavigia.ctg.api.dto;

import com.aguavigia.ctg.domain.RegistroDeVigilancia;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Una revisión del vigilante de la copia analítica (ADR-113): compara Mongo con PostgreSQL barrio por barrio y comprueba la cadena de la bitácora inmutable. Avisa; no corrige")
public record VigilanciaAnaliticaRespuesta(
        long id,
        Instant ejecutadaEn,
        @Schema(description = "OK, CON_DIFERENCIAS o FALLIDA")
        String resultado,
        int barriosRevisados,
        @Schema(description = "Barrios que descuadran más referencias colgantes")
        int diferencias,
        long eventosEnBitacora,
        @Schema(description = "Eslabones de la cadena de hashes que no cuadran; 0 si está sana")
        long eslabonesRotos,
        @Schema(description = "Qué descuadra o por qué falló; nulo si todo cuadra", nullable = true)
        String detalle) {

    public static VigilanciaAnaliticaRespuesta de(RegistroDeVigilancia r) {
        return new VigilanciaAnaliticaRespuesta(r.id(), r.ejecutadaEn(), r.resultado().name(), r.barriosRevisados(), r.diferencias(),
                r.eventosEnBitacora(), r.eslabonesRotos(), r.detalle());
    }
}
