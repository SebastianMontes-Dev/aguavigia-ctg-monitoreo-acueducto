package com.aguavigia.ctg.domain;

/**
 * Lo que hay (o lo que se generó) de datos sintéticos, por colección. {@code semilla} es la de la corrida; nula cuando el
 * resumen es solo un conteo de lo que ya hay en la base.
 */
public record ResumenDeDatosSinteticos(long dispositivos, long reportes, long cortes, long eventos, Long semilla) {

    public static ResumenDeDatosSinteticos vacio() {
        return new ResumenDeDatosSinteticos(0, 0, 0, 0, null);
    }

    public ResumenDeDatosSinteticos conSemilla(long semillaDeLaCorrida) {
        return new ResumenDeDatosSinteticos(dispositivos, reportes, cortes, eventos, semillaDeLaCorrida);
    }
}
