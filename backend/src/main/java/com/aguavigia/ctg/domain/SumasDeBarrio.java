package com.aguavigia.ctg.domain;

/**
 * Lo que el vigilante compara de un barrio entre Mongo y PostgreSQL (ADR-113): cuántos pares corte-barrio tiene, cuántos de ellos están
 * cerrados, la suma de las horas de cierre en segundos desde 1970 (cualquier cierre movido o cambiado de fuente descuadra la suma) y
 * cuántos reportes tiene en total. Cuatro números por barrio bastan para delatar casi cualquier diferencia sin mover los documentos.
 */
public record SumasDeBarrio(long pares, long cierres, long segundosDeCierre, long reportes) {

    public static final SumasDeBarrio VACIAS = new SumasDeBarrio(0, 0, 0, 0);

    public SumasDeBarrio conPar(Long segundosDelCierre) {
        return new SumasDeBarrio(pares + 1, cierres + (segundosDelCierre == null ? 0 : 1),
                segundosDeCierre + (segundosDelCierre == null ? 0 : segundosDelCierre), reportes);
    }

    public SumasDeBarrio conReportes(long mas) {
        return new SumasDeBarrio(pares, cierres, segundosDeCierre, reportes + mas);
    }
}
