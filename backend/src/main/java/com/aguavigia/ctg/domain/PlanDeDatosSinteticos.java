package com.aguavigia.ctg.domain;

/**
 * Cuánto se genera en una corrida de datos sintéticos (ADR-111) y con qué semilla.
 *
 * La semilla es opcional: con ella la corrida es repetible (mismo reloj y mismos barrios ⇒ mismos documentos); sin ella
 * el servicio sortea una y la devuelve en el resumen, para poder repetirla después.
 *
 * @param reportes     reportes ciudadanos a generar
 * @param cortes       cortes a generar (cada uno con sus barrios, cierres y eventos de bitácora)
 * @param dispositivos identidades de dispositivo distintas entre las que se reparten los reportes
 * @param dias         cuántos días hacia atrás se reparten los datos; no pasa de 330 para que el TTL de 365 días de los
 *                     reportes no se los lleve
 * @param semilla      nula para sortear una
 */
public record PlanDeDatosSinteticos(int reportes, int cortes, int dispositivos, int dias, Long semilla) {

    /** El TTL de `reportes` es de 365 días: se deja holgura para que nada recién generado caduque. */
    public static final int MAXIMO_DE_DIAS = 330;

    public PlanDeDatosSinteticos {
        if (reportes < 0 || cortes < 0 || dispositivos < 0) {
            throw new IllegalArgumentException("Las cantidades a generar no pueden ser negativas");
        }
        if (dias < 1 || dias > MAXIMO_DE_DIAS) {
            throw new IllegalArgumentException("Los días deben estar entre 1 y " + MAXIMO_DE_DIAS
                    + " (el TTL de los reportes es de 365 días)");
        }
        if (reportes > 0 && dispositivos < 1) {
            throw new IllegalArgumentException("Para generar reportes hace falta al menos un dispositivo");
        }
    }

    public boolean estaVacio() {
        return reportes == 0 && cortes == 0;
    }

    /** El mismo plan con una semilla fija. */
    public PlanDeDatosSinteticos conSemilla(long semillaFija) {
        return new PlanDeDatosSinteticos(reportes, cortes, dispositivos, dias, semillaFija);
    }
}
