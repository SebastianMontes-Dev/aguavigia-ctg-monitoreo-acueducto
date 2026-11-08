package com.aguavigia.ctg.domain.port.in;

import com.aguavigia.ctg.domain.PlanDeDatosSinteticos;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;

/**
 * Genera al azar reportes, dispositivos, cortes y bitácora para llenar la simulación (ADR-111). Todo lo que crea queda
 * marcado como sintético en la base y no se hace pasar por un aviso de Acuacar ni por una persona.
 */
public interface GenerarDatosSinteticosUseCase {

    /** Genera lo que pide el plan y devuelve lo que se creó, con la semilla usada. */
    ResumenDeDatosSinteticos generar(PlanDeDatosSinteticos plan);

    /**
     * Genera solo lo que falta para llegar al plan: si ya hay al menos esa cantidad de reportes y de cortes sintéticos, no
     * crea nada. Es lo que se usa al arrancar, para que reiniciar no duplique.
     */
    ResumenDeDatosSinteticos completar(PlanDeDatosSinteticos plan);

    /** Cuántos documentos sintéticos hay hoy en cada colección. */
    ResumenDeDatosSinteticos contar();
}
