package com.aguavigia.ctg.domain;

import java.time.LocalDate;

/**
 * Los reportes de un día (sin contar los descartados), con su media móvil de siete días y el cambio frente al día anterior. Los días
 * sin reportes aparecen con 0: la serie no tiene huecos. {@code cambioRespectoAlDiaAnterior} es nulo en el primer día.
 */
public record PuntoTendenciaAnalitico(LocalDate dia, long reportes, double media7Dias, Long cambioRespectoAlDiaAnterior) {
}
