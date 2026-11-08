package com.aguavigia.ctg.domain;

import java.time.LocalDate;

/**
 * Los reportes de un barrio en un día (hora de Cartagena), de un tipo y con un estado de moderación: lo único que la copia
 * analítica guarda de los reportes. Es un conteo; no lleva coordenadas, ni huella de dispositivo, ni red, ni foto (ADR-100: ningún dato
 * personal en PostgreSQL).
 */
public record FilaReporteDiaAnalitica(String sectorId, LocalDate dia, String tipo, String estadoModeracion, int cantidad) {

    public FilaReporteDiaAnalitica {
        if (sectorId == null || sectorId.isBlank() || dia == null || tipo == null || estadoModeracion == null) {
            throw new IllegalArgumentException("La fila de reportes del día necesita barrio, día, tipo y estado de moderación");
        }
        if (cantidad < 1) {
            throw new IllegalArgumentException("Una fila de reportes del día cuenta al menos uno");
        }
    }
}
