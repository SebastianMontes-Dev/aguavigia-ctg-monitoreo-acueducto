package com.aguavigia.ctg.domain;

public enum OrigenCorte {
    OFICIAL_ACUACAR,
    INGESTA_IA,
    VEEDOR,
    /** ADR-111: lo genera el sistema al azar para llenar la simulación. Nunca sale de un boletín ni de una persona. */
    SINTETICO
}
