package com.aguavigia.ctg.infrastructure.persistence.sql;

import com.aguavigia.ctg.domain.FilaCorteAnalitica;
import com.aguavigia.ctg.domain.FilaEventoAnalitico;
import com.aguavigia.ctg.domain.FilaParAnalitica;
import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;
import com.aguavigia.ctg.domain.FilaSectorAnalitica;
import com.aguavigia.ctg.domain.RegistroDeVigilancia;
import com.aguavigia.ctg.domain.ResultadoDeCopia;
import com.aguavigia.ctg.domain.SumasDeBarrio;
import com.aguavigia.ctg.domain.VerificacionDeBitacora;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** El adaptador del vigilante contra un PostgreSQL real: bitácora que solo se agrega, sumas por barrio y cadena de hashes. */
@Testcontainers
class IntegridadAnaliticaPostgresAdapterIT {

    private static final Instant COPIA = Instant.parse("2026-11-06T15:00:00Z");
    private static final Instant INICIO = Instant.parse("2026-11-01T10:00:00Z");

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11-alpine")
            .withDatabaseName("aguavigia_analitica").withUsername("aguavigia");

    private JdbcTemplate jdbc;
    private AlmacenAnaliticoPostgresAdapter almacen;
    private IntegridadAnaliticaPostgresAdapter integridad;

    @BeforeEach
    void esquemaLimpio() {
        var dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("DROP SCHEMA IF EXISTS analitica CASCADE");
        almacen = new AlmacenAnaliticoPostgresAdapter(dataSource);
        integridad = new IntegridadAnaliticaPostgresAdapter(dataSource);
        almacen.registrarInicioDeCopia(COPIA);
    }

    private static FilaEventoAnalitico evento(String id, Instant cuando) {
        return new FilaEventoAnalitico(id, "CORTE_ANUNCIADO", "manga", "c1", cuando, "Aviso " + id, "CORTE_PROGRAMADO", "ACUACAR");
    }

    @Test
    void debeAnexarLosEventosYNoRepetirLosQueYaEstaban() {
        int primeros = integridad.anexarABitacora(List.of(evento("e1", INICIO), evento("e2", INICIO.plusSeconds(60))), COPIA);
        int segundos = integridad.anexarABitacora(List.of(evento("e2", INICIO.plusSeconds(60)), evento("e3", INICIO.plusSeconds(120))), COPIA);

        assertThat(primeros).isEqualTo(2);
        assertThat(segundos).isEqualTo(1);
        assertThat(integridad.idsDeBitacora()).containsExactlyInAnyOrder("e1", "e2", "e3");
    }

    @Test
    void laCadenaDebeEstarSanaTrasAnexarEnVariosLotes() {
        integridad.anexarABitacora(List.of(evento("e1", INICIO), evento("e2", INICIO.plusSeconds(60))), COPIA);
        integridad.anexarABitacora(List.of(evento("e3", INICIO.plusSeconds(120))), COPIA);

        VerificacionDeBitacora cadena = integridad.verificarCadena();

        assertThat(cadena.eventos()).isEqualTo(3);
        assertThat(cadena.eslabonesRotos()).isZero();
        assertThat(cadena.cadenaValida()).isTrue();
        assertThat(cadena.ultimoHash()).hasSize(64);
    }

    @Test
    void unaBitacoraVaciaTieneCadenaValidaYSinHash() {
        VerificacionDeBitacora cadena = integridad.verificarCadena();

        assertThat(cadena.eventos()).isZero();
        assertThat(cadena.cadenaValida()).isTrue();
        assertThat(cadena.ultimoHash()).isNull();
    }

    @Test
    void debeDetectarUnEventoAlteradoPorQuienEsquivaElBloqueo() {
        integridad.anexarABitacora(List.of(evento("e1", INICIO), evento("e2", INICIO.plusSeconds(60)), evento("e3", INICIO.plusSeconds(120))), COPIA);
        jdbc.execute("ALTER TABLE analitica.bitacora_inmutable DISABLE TRIGGER bitacora_sin_modificar");
        jdbc.update("UPDATE analitica.bitacora_inmutable SET descripcion = 'reescrita' WHERE evento_id = 'e2'");
        jdbc.execute("ALTER TABLE analitica.bitacora_inmutable ENABLE TRIGGER bitacora_sin_modificar");

        VerificacionDeBitacora cadena = integridad.verificarCadena();

        assertThat(cadena.eslabonesRotos()).isEqualTo(1);
        assertThat(cadena.cadenaValida()).isFalse();
    }

    @Test
    void debeSumarPorBarrioParesCierresSegundosYReportes() {
        Instant cierre = INICIO.plus(Duration.ofHours(3));
        almacen.reemplazar(List.of(new FilaSectorAnalitica("manga", "Manga", 100), new FilaSectorAnalitica("crespo", "Crespo", 100),
                new FilaSectorAnalitica("vacio", "Vacío", 100)), List.of(
                new FilaCorteAnalitica("c1", "OFICIAL_ACUACAR", "RESTABLECIDO", "Mantenimiento", INICIO, INICIO.plus(Duration.ofHours(2)),
                        List.of(new FilaParAnalitica("manga", cierre, "ACUACAR", false), new FilaParAnalitica("crespo", null, null, false))),
                new FilaCorteAnalitica("c2", "OFICIAL_ACUACAR", "RESTABLECIDO", "Mantenimiento", INICIO, INICIO.plus(Duration.ofHours(2)),
                        List.of(new FilaParAnalitica("manga", cierre.plusSeconds(100), "VECINOS", true)))), COPIA);
        almacen.reemplazarReportes(List.of(new FilaReporteDiaAnalitica("manga", LocalDate.of(2026, 11, 1), "SIN_AGUA", "APROBADO", 4),
                new FilaReporteDiaAnalitica("manga", LocalDate.of(2026, 11, 2), "SIN_AGUA", "DESCARTADO", 1)), COPIA);

        Map<String, SumasDeBarrio> sumas = integridad.sumasPorBarrio();

        assertThat(sumas.get("manga")).isEqualTo(new SumasDeBarrio(2, 2, cierre.getEpochSecond() * 2 + 100, 5));
        assertThat(sumas.get("crespo")).isEqualTo(new SumasDeBarrio(1, 0, 0, 0));
        assertThat(sumas).doesNotContainKey("vacio");
    }

    @Test
    void debeAnotarLasRevisionesYDevolverSuId() {
        long id = integridad.registrarVigilancia(new RegistroDeVigilancia(0, COPIA, ResultadoDeCopia.CON_DIFERENCIAS, 211, 2, 40, 0, "Hay diferencias"));

        assertThat(id).isPositive();
        assertThat(jdbc.queryForObject("SELECT resultado FROM analitica.vigilancia WHERE id = ?", String.class, id))
                .isEqualTo("CON_DIFERENCIAS");
    }
}
