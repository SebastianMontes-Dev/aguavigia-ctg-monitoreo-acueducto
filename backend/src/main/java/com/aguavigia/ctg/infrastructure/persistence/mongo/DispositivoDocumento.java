package com.aguavigia.ctg.infrastructure.persistence.mongo;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Getter
@Setter
@Document(collection = "dispositivos")
public class DispositivoDocumento {

    @Id
    private String id;
    private Instant creadoEn;
    private Instant ultimoVisto;

    /** ADR-111 — generado al azar para la simulación. Nulo (no se escribe) en los que emite el servidor. */
    private Boolean sintetico;
}
