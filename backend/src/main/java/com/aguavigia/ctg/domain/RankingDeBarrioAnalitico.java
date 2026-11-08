package com.aguavigia.ctg.domain;

/**
 * Un barrio en el ranking de reportes de los últimos 30 días con datos (sin contar los descartados). {@code posicion} comparte
 * número entre empates, como {@code RANK()}.
 */
public record RankingDeBarrioAnalitico(int posicion, String sectorId, String nombre, long reportes, long sinAgua, long presionBaja,
                                       double porcentajeDeLaCiudad) {
}
