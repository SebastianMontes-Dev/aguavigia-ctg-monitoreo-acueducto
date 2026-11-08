package com.aguavigia.ctg.domain.port.in;

import com.aguavigia.ctg.domain.RegistroDeVigilancia;

/**
 * El vigilante de integridad de la copia analítica (ADR-113): agrega a la bitácora inmutable lo que falta, comprueba su cadena de hashes
 * y compara Mongo con PostgreSQL barrio por barrio. Avisa; no corrige nada. Nunca lanza: una revisión que no pudo hacerse queda anotada
 * como fallida (si hay donde anotarla).
 */
public interface VigilarAnaliticaUseCase {

    RegistroDeVigilancia vigilar();
}
