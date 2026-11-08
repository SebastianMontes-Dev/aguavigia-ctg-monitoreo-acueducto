package com.aguavigia.ctg.infrastructure.persistence.mongo;

import com.aguavigia.ctg.application.GenerarDatosSinteticosService;
import com.aguavigia.ctg.domain.Coordenada;
import com.aguavigia.ctg.domain.EstadoModeracion;
import com.aguavigia.ctg.domain.EstadoServicio;
import com.aguavigia.ctg.domain.GeometriaSector;
import com.aguavigia.ctg.domain.HuellaDispositivo;
import com.aguavigia.ctg.domain.OrigenCorte;
import com.aguavigia.ctg.domain.PlanDeDatosSinteticos;
import com.aguavigia.ctg.domain.ReporteCiudadano;
import com.aguavigia.ctg.domain.ReporteId;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import com.aguavigia.ctg.domain.Sector;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.TipoReporte;
import com.aguavigia.ctg.domain.port.out.GeometriaSectoresPort;
import com.aguavigia.ctg.domain.port.out.RelojPort;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * El generador de datos sintéticos (ADR-111) contra un MongoDB real: lo que inserta se puede leer con los adaptadores de siempre,
 * queda marcado como sintético y no se confunde con lo que crea una persona.
 */
@Testcontainers
@DataMongoTest
@Import({DatosSinteticosMongoAdapter.class, CorteAguaMongoAdapter.class, ReporteCiudadanoMongoAdapter.class,
        EventoBitacoraMongoAdapter.class, DatosSinteticosMongoAdapterIT.Config.class})
class DatosSinteticosMongoAdapterIT {

    private static final Instant AHORA = Instant.parse("2026-11-06T15:00:00Z");

    @TestConfiguration
    static class Config {
        @Bean
        RelojPort reloj() {
            return () -> AHORA;
        }
    }

    @Container
    @ServiceConnection
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @Autowired
    private DatosSinteticosMongoAdapter almacen;
    @Autowired
    private CorteAguaMongoAdapter cortes;
    @Autowired
    private ReporteCiudadanoMongoAdapter reportes;
    @Autowired
    private MongoTemplate mongoTemplate;

    private GenerarDatosSinteticosService servicio;

    @BeforeEach
    void preparar() {
        for (String coleccion : List.of("reportes", "cortes", "dispositivos", "eventos_bitacora")) {
            mongoTemplate.getDb().getCollection(coleccion).drop();
        }
        SectorRepository sectores = mock(SectorRepository.class);
        GeometriaSectoresPort geometrias = mock(GeometriaSectoresPort.class);
        SectorId manga = new SectorId("manga");
        SectorId crespo = new SectorId("crespo");
        when(sectores.listarTodos()).thenReturn(List.of(
                new Sector(manga, "Manga", 9000, EstadoServicio.CON_SERVICIO),
                new Sector(crespo, "Crespo", 6000, EstadoServicio.CON_SERVICIO)));
        when(geometrias.listar()).thenReturn(List.of(
                new GeometriaSector(manga, "Manga", cuadrado(-75.55, 10.41)),
                new GeometriaSector(crespo, "Crespo", cuadrado(-75.50, 10.46))));
        servicio = new GenerarDatosSinteticosService(sectores, geometrias, almacen, () -> AHORA);
    }

    private static Map<String, Object> cuadrado(double longitud, double latitud) {
        return Map.of("type", "Polygon", "coordinates", List.of(List.of(
                List.of(longitud, latitud), List.of(longitud + 0.02, latitud), List.of(longitud + 0.02, latitud + 0.02),
                List.of(longitud, latitud + 0.02), List.of(longitud, latitud))));
    }

    @Test
    void debeGuardarYContarLoGeneradoComoSintetico() {
        ResumenDeDatosSinteticos generado = servicio.generar(new PlanDeDatosSinteticos(2500, 40, 200, 90, 123L));

        ResumenDeDatosSinteticos contado = almacen.contar();

        assertThat(contado.reportes()).isEqualTo(2500);
        assertThat(contado.cortes()).isEqualTo(40);
        assertThat(contado.dispositivos()).isEqualTo(200);
        assertThat(contado.eventos()).isEqualTo(generado.eventos()).isPositive();
    }

    @Test
    void debeSerLegibleConLosAdaptadoresDeSiempreConOrigenSintetico() {
        servicio.generar(new PlanDeDatosSinteticos(300, 25, 50, 60, 9L));

        assertThat(cortes.listarTodos()).hasSize(25)
                .allSatisfy(corte -> assertThat(corte.origen()).isEqualTo(OrigenCorte.SINTETICO));
        assertThat(mongoTemplate.findAll(ReporteCiudadanoDocumento.class)).hasSize(300)
                .allSatisfy(documento -> {
                    assertThat(documento.getSintetico()).isTrue();
                    assertThat(documento.getHuella()).hasSize(64);
                    assertThat(documento.getLatitud()).isNotNull();
                });
    }

    @Test
    void noDebeConfundirLoSinteticoConLoQueCreaUnaPersona() {
        reportes.guardar(new ReporteCiudadano(new ReporteId("real-1"), new SectorId("manga"), TipoReporte.SIN_AGUA,
                new Coordenada(10.42, -75.54), new HuellaDispositivo("huella-real"), AHORA.minusSeconds(120),
                EstadoModeracion.PENDIENTE, null, java.util.Set.of(), false, null, null, null, false));
        servicio.generar(new PlanDeDatosSinteticos(100, 5, 20, 30, 1L));

        assertThat(mongoTemplate.getCollection("reportes").countDocuments()).isEqualTo(101);
        assertThat(almacen.contar().reportes()).isEqualTo(100);
        assertThat(mongoTemplate.findById("real-1", ReporteCiudadanoDocumento.class).getSintetico()).isNull();
    }

    @Test
    void completarNoDebeDuplicarAlReiniciar() {
        PlanDeDatosSinteticos plan = new PlanDeDatosSinteticos(400, 15, 60, 60, 5L);
        servicio.completar(plan);
        long reportes = almacen.contar().reportes();
        long cortesGenerados = almacen.contar().cortes();

        servicio.completar(plan);

        assertThat(almacen.contar().reportes()).isEqualTo(reportes).isEqualTo(400);
        assertThat(almacen.contar().cortes()).isEqualTo(cortesGenerados).isEqualTo(15);
    }
}
