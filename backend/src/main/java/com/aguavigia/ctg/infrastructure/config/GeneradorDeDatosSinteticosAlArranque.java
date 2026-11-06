package com.aguavigia.ctg.infrastructure.config;

import com.aguavigia.ctg.domain.PlanDeDatosSinteticos;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import com.aguavigia.ctg.domain.port.in.GenerarDatosSinteticosUseCase;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Llena la instancia de simulación con reportes, cortes y bitácora aleatorios al arrancar (ADR-111). Solo existe con
 * {@code aguavigia.sim.habilitada=true}: la instancia real no lleva nada inventado más allá de las pocas cuentas sintéticas.
 *
 * Espera, en un hilo aparte para no retrasar el arranque, a que existan los barrios que siembra otro proceso. Es idempotente:
 * genera solo lo que falta para llegar a la cantidad pedida, así que reiniciar no duplica. Con {@code reportes} y {@code cortes}
 * en 0 (el valor por defecto) no hace nada.
 */
@Component
@ConditionalOnProperty(prefix = "aguavigia.sim", name = "habilitada", havingValue = "true")
public class GeneradorDeDatosSinteticosAlArranque {

    private static final Logger log = LoggerFactory.getLogger(GeneradorDeDatosSinteticosAlArranque.class);

    /** Cómo se espera entre intentos; en las pruebas no duerme. */
    @FunctionalInterface
    interface Espera {
        void dormir(long milisegundos);
    }

    private final GenerarDatosSinteticosUseCase generar;
    private final SectorRepository sectores;
    private final PlanDeDatosSinteticos plan;
    private final int sectoresEsperados;
    private final int intentosMaximos;
    private final Espera espera;

    @Autowired
    public GeneradorDeDatosSinteticosAlArranque(
            GenerarDatosSinteticosUseCase generar, SectorRepository sectores,
            @Value("${aguavigia.siembra.datos-sinteticos.reportes:0}") int reportes,
            @Value("${aguavigia.siembra.datos-sinteticos.cortes:0}") int cortes,
            @Value("${aguavigia.siembra.datos-sinteticos.dispositivos:9000}") int dispositivos,
            @Value("${aguavigia.siembra.datos-sinteticos.dias:300}") int dias,
            @Value("${aguavigia.siembra.datos-sinteticos.semilla:}") String semilla,
            @Value("${aguavigia.siembra.sectores-esperados:211}") int sectoresEsperados,
            @Value("${aguavigia.siembra.intentos-de-espera:60}") int intentosMaximos,
            @Value("${aguavigia.siembra.intervalo-de-espera-ms:5000}") long intervaloMs) {
        this(generar, sectores, new PlanDeDatosSinteticos(reportes, cortes, dispositivos, dias,
                        semilla == null || semilla.isBlank() ? null : Long.parseLong(semilla.trim())),
                sectoresEsperados, intentosMaximos, milisegundos -> {
                    try {
                        Thread.sleep(intervaloMs);
                    } catch (InterruptedException interrumpido) {
                        Thread.currentThread().interrupt();
                    }
                });
    }

    GeneradorDeDatosSinteticosAlArranque(GenerarDatosSinteticosUseCase generar, SectorRepository sectores,
                                         PlanDeDatosSinteticos plan, int sectoresEsperados, int intentosMaximos, Espera espera) {
        this.generar = generar;
        this.sectores = sectores;
        this.plan = plan;
        this.sectoresEsperados = sectoresEsperados;
        this.intentosMaximos = intentosMaximos;
        this.espera = espera;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void alArrancar() {
        generarCuandoEsteListo();
    }

    void generarCuandoEsteListo() {
        if (plan.estaVacio()) {
            return;
        }
        try {
            boolean haySectores = false;
            for (int intento = 0; intento <= intentosMaximos; intento++) {
                haySectores = sectores.listarTodos().size() >= sectoresEsperados;
                if (haySectores) {
                    break;
                }
                if (intento < intentosMaximos) {
                    espera.dormir(intento);
                }
            }
            if (!haySectores) {
                log.warn("Datos sintéticos: faltan los sectores ({} esperados); no se generan. Se reintentará en el próximo arranque.",
                        sectoresEsperados);
                return;
            }
            ResumenDeDatosSinteticos resumen = generar.completar(plan);
            log.info("Datos sintéticos listos: {} reportes, {} cortes, {} eventos de bitácora y {} dispositivos (de simulación, no son personas ni avisos de Acuacar).",
                    resumen.reportes(), resumen.cortes(), resumen.eventos(), resumen.dispositivos());
        } catch (DataAccessException noHayMongo) {
            log.warn("No se pudieron generar los datos sintéticos: {}", noHayMongo.getMessage());
        } catch (RuntimeException inesperado) {
            // Un fallo del generador no puede tumbar la instancia: se dice y la simulación sigue sin el volumen.
            log.error("No se pudieron generar los datos sintéticos", inesperado);
        }
    }
}
