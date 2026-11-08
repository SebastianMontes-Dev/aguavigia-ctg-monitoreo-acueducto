package com.aguavigia.ctg.domain;

import java.time.Instant;

/**
 * Una revisión del vigilante (ADR-113). {@code id} es 0 mientras no se guarda. El vigilante avisa; no corrige nada.
 *
 * @param barriosRevisados  barrios cuyas sumas se compararon
 * @param diferencias       cuántos barrios descuadran entre Mongo y PostgreSQL, más las referencias colgantes
 * @param eventosEnBitacora eventos que hay en la bitácora inmutable tras la revisión
 * @param eslabonesRotos    eslabones de la cadena que no cuadran (0 si está sana)
 * @param detalle           qué descuadra, o por qué falló la revisión; nulo si todo cuadra
 */
public record RegistroDeVigilancia(long id, Instant ejecutadaEn, ResultadoDeCopia resultado, int barriosRevisados, int diferencias,
                                   long eventosEnBitacora, long eslabonesRotos, String detalle) {
}
