package com.aguavigia.ctg.domain;

import java.time.Instant;

/**
 * Un evento de la bitácora pública tal como la copia analítica lo guarda (ADR-113). La bitácora es pública y no tiene datos personales;
 * se omiten los ids de los reportes que sustentan un cambio, que no hacen falta para comprobar la integridad.
 */
public record FilaEventoAnalitico(String id, String tipo, String sectorId, String corteId, Instant ocurrioEn, String descripcion,
                                  String estado, String fuente) {

    public FilaEventoAnalitico {
        if (id == null || id.isBlank() || tipo == null || ocurrioEn == null || descripcion == null) {
            throw new IllegalArgumentException("Un evento de la copia analítica necesita id, tipo, fecha y descripción");
        }
    }
}
