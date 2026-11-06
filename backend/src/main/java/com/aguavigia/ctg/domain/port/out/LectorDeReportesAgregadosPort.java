package com.aguavigia.ctg.domain.port.out;

import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;

import java.util.List;

/**
 * Lee de Mongo los reportes ya contados por barrio, día, tipo y estado de moderación, para la copia analítica (ADR-100). Solo lectura: el
 * conteo lo hace la propia base, así que 60 000 reportes no viajan a memoria.
 */
public interface LectorDeReportesAgregadosPort {

    List<FilaReporteDiaAnalitica> agregarPorDia();
}
