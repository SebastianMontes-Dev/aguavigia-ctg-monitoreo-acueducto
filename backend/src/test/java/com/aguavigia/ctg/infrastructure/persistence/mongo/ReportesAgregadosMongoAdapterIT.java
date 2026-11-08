package com.aguavigia.ctg.infrastructure.persistence.mongo;

import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El conteo de reportes por barrio, día de Cartagena, tipo y estado de moderación se hace en Mongo (ADR-112). El día es el de Cartagena
 * (UTC-5), no el UTC: un reporte de las 22:30 en Cartagena ya es del día siguiente en UTC y no debe contarse en él.
 */
@Testcontainers
@DataMongoTest
@Import(ReportesAgregadosMongoAdapter.class)
class ReportesAgregadosMongoAdapterIT {

    @Container
    @ServiceConnection
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @Autowired
    private ReportesAgregadosMongoAdapter adaptador;
    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void limpiar() {
        mongoTemplate.getDb().getCollection("reportes").drop();
    }

    private void reporte(String id, String sector, String tipo, String estado, String instante) {
        ReporteCiudadanoDocumento documento = new ReporteCiudadanoDocumento();
        documento.setId(id);
        documento.setSectorId(sector);
        documento.setTipo(tipo);
        documento.setEstadoModeracion(estado);
        documento.setTimestamp(Instant.parse(instante));
        documento.setHuella("huella-" + id);
        mongoTemplate.save(documento);
    }

    private static FilaReporteDiaAnalitica fila(String sector, String dia, String tipo, String estado, int cantidad) {
        return new FilaReporteDiaAnalitica(sector, LocalDate.parse(dia), tipo, estado, cantidad);
    }

    @Test
    void debeContarPorBarrioDiaTipoYEstado() {
        reporte("1", "manga", "SIN_AGUA", "APROBADO", "2026-11-02T15:00:00Z");
        reporte("2", "manga", "SIN_AGUA", "APROBADO", "2026-11-02T18:00:00Z");
        reporte("3", "manga", "PRESION_BAJA", "APROBADO", "2026-11-02T18:00:00Z");
        reporte("4", "manga", "SIN_AGUA", "DESCARTADO", "2026-11-02T18:00:00Z");
        reporte("5", "crespo", "SIN_AGUA", "PENDIENTE", "2026-11-03T15:00:00Z");

        List<FilaReporteDiaAnalitica> filas = adaptador.agregarPorDia();

        assertThat(filas).containsExactlyInAnyOrder(
                fila("manga", "2026-11-02", "SIN_AGUA", "APROBADO", 2),
                fila("manga", "2026-11-02", "PRESION_BAJA", "APROBADO", 1),
                fila("manga", "2026-11-02", "SIN_AGUA", "DESCARTADO", 1),
                fila("crespo", "2026-11-03", "SIN_AGUA", "PENDIENTE", 1));
    }

    @Test
    void elDiaEsElDeCartagenaYNoElDeUtc() {
        // 2026-11-03T03:30Z son las 22:30 del 2 de noviembre en Cartagena (UTC-5, sin horario de verano).
        reporte("1", "manga", "SIN_AGUA", "APROBADO", "2026-11-03T03:30:00Z");
        // 2026-11-03T05:30Z son las 00:30 del 3 de noviembre en Cartagena.
        reporte("2", "manga", "SIN_AGUA", "APROBADO", "2026-11-03T05:30:00Z");

        assertThat(adaptador.agregarPorDia()).containsExactlyInAnyOrder(
                fila("manga", "2026-11-02", "SIN_AGUA", "APROBADO", 1),
                fila("manga", "2026-11-03", "SIN_AGUA", "APROBADO", 1));
    }

    @Test
    void unReporteAnteriorAlEstadoDeModeracionSeLeeComoAprobado() {
        reporte("1", "manga", "SIN_AGUA", null, "2026-11-02T15:00:00Z");

        assertThat(adaptador.agregarPorDia()).containsExactly(fila("manga", "2026-11-02", "SIN_AGUA", "APROBADO", 1));
    }

    @Test
    void sinReportesDebeDevolverUnaListaVacia() {
        assertThat(adaptador.agregarPorDia()).isEmpty();
    }
}
