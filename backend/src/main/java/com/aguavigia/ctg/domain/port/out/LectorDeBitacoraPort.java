package com.aguavigia.ctg.domain.port.out;

import com.aguavigia.ctg.domain.FilaEventoAnalitico;

import java.util.List;

/**
 * Lee de Mongo los eventos de la bitácora pública para la copia analítica (ADR-113), del más antiguo al más reciente y, a igual instante,
 * por id, para que dos lecturas seguidas den el mismo orden. Solo lectura.
 */
public interface LectorDeBitacoraPort {

    List<FilaEventoAnalitico> todosEnOrden();
}
