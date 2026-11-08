package com.aguavigia.ctg.infrastructure.persistence.sql;

import com.aguavigia.ctg.domain.port.in.CopiarAnaliticaUseCase;
import com.aguavigia.ctg.domain.port.in.VigilarAnaliticaUseCase;
import com.aguavigia.ctg.infrastructure.scheduling.EjecucionUnica;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;

/**
 * Revisa la copia analítica cada 15 minutos (ADR-113). Antes de comparar hace una copia fresca: comparar contra una copia de hace cuatro
 * minutos delataría como «diferencia» cualquier reporte que haya llegado desde entonces. Pasa por {@link EjecucionUnica}, como la copia:
 * con varias réplicas solo una revisión por ciclo.
 */
public class VigilanciaAnaliticaJob {

    private static final Logger log = LoggerFactory.getLogger(VigilanciaAnaliticaJob.class);
    private static final String TAREA = "vigilancia-analitica";

    private final CopiarAnaliticaUseCase copiar;
    private final VigilarAnaliticaUseCase vigilar;
    private final EjecucionUnica ejecucionUnica;
    private final Duration bloqueoMinimo;

    public VigilanciaAnaliticaJob(CopiarAnaliticaUseCase copiar, VigilarAnaliticaUseCase vigilar, EjecucionUnica ejecucionUnica,
                                  long intervaloMs) {
        this.copiar = copiar;
        this.vigilar = vigilar;
        this.ejecucionUnica = ejecucionUnica;
        this.bloqueoMinimo = Duration.ofMillis(Math.max(1, Math.min(60_000, intervaloMs)));
    }

    @Scheduled(initialDelayString = "${aguavigia.sql.vigilancia-retraso-inicial-ms:150000}",
            fixedDelayString = "${aguavigia.sql.vigilancia-intervalo-ms:900000}")
    public void vigilarEnUnaReplica() {
        ejecucionUnica.ejecutar(TAREA, Duration.ofMinutes(15), bloqueoMinimo, this::vigilarSinPropagar);
    }

    void vigilarSinPropagar() {
        try {
            copiar.copiar();
            vigilar.vigilar();
        } catch (RuntimeException fallo) {
            // Los casos de uso no lanzan, pero sin este catch Spring dejaría de reprogramar la tarea hasta el reinicio.
            log.warn("La vigilancia analítica falló, se reintenta en el próximo ciclo: {}", fallo.toString());
        }
    }
}
