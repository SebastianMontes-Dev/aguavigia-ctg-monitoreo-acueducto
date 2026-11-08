package com.aguavigia.ctg.infrastructure.persistence.sql;

import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;
import com.aguavigia.ctg.domain.FilaSectorAnalitica;
import com.aguavigia.ctg.domain.PuntoTendenciaAnalitico;
import com.aguavigia.ctg.domain.RankingDeBarrioAnalitico;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Los reportes en la copia analítica (ADR-112): la tabla `reporte_dia` y las vistas con funciones de ventana (ranking con `RANK()`,
 * tendencia con media móvil y `LAG`). Contra un PostgreSQL real, porque lo que se prueba es el SQL.
 */
@Testcontainers
class VistasDeReportesIT {

    private static final Instant COPIA = Instant.parse("2026-11-06T15:00:00Z");
    private static final LocalDate D1 = LocalDate.of(2026, 11, 1);

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11-alpine")
            .withDatabaseName("aguavigia_analitica").withUsername("aguavigia");

    private JdbcTemplate jdbc;
    private AlmacenAnaliticoPostgresAdapter almacen;
    private ConsultaAnaliticaPostgresAdapter consulta;

    private static final List<FilaSectorAnalitica> BARRIOS = List.of(new FilaSectorAnalitica("manga", "Manga", 100),
            new FilaSectorAnalitica("bocagrande", "Bocagrande", 100), new FilaSectorAnalitica("crespo", "Crespo", 100));

    @BeforeEach
    void esquemaLimpio() {
        var dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("DROP SCHEMA IF EXISTS analitica CASCADE");
        almacen = new AlmacenAnaliticoPostgresAdapter(dataSource);
        consulta = new ConsultaAnaliticaPostgresAdapter(dataSource);
        almacen.registrarInicioDeCopia(COPIA);
        almacen.reemplazar(BARRIOS, List.of(), COPIA);
    }

    private static FilaReporteDiaAnalitica fila(String barrio, LocalDate dia, String tipo, String estado, int cantidad) {
        return new FilaReporteDiaAnalitica(barrio, dia, tipo, estado, cantidad);
    }

    @Test
    void debeGuardarLosReportesYDevolverSuTotal() {
        long total = almacen.reemplazarReportes(List.of(
                fila("manga", D1, "SIN_AGUA", "APROBADO", 5), fila("manga", D1, "PRESION_BAJA", "PENDIENTE", 2),
                fila("crespo", D1, "SIN_AGUA", "DESCARTADO", 4)), COPIA);

        assertThat(total).isEqualTo(11);
    }

    @Test
    void repetirLaCopiaDeReportesNoDebeDuplicarNada() {
        List<FilaReporteDiaAnalitica> filas = List.of(fila("manga", D1, "SIN_AGUA", "APROBADO", 5));

        almacen.reemplazarReportes(filas, COPIA);
        long total = almacen.reemplazarReportes(filas, COPIA);

        assertThat(total).isEqualTo(5);
    }

    @Test
    void debeRechazarUnBarrioQueNoEstaEnLaCopia() {
        assertThatThrownBy(() -> almacen.reemplazarReportes(List.of(fila("fantasma", D1, "SIN_AGUA", "APROBADO", 1)), COPIA))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void elRankingDebeOrdenarPorReportesSinContarLosDescartadosYCompartirPosicionEnLosEmpates() {
        almacen.reemplazarReportes(List.of(
                fila("manga", D1, "SIN_AGUA", "APROBADO", 6), fila("manga", D1, "PRESION_BAJA", "APROBADO", 2),
                fila("manga", D1, "SIN_AGUA", "DESCARTADO", 50),
                fila("bocagrande", D1, "SIN_AGUA", "APROBADO", 4),
                fila("crespo", D1, "PRESION_BAJA", "PENDIENTE", 4)), COPIA);

        List<RankingDeBarrioAnalitico> ranking = consulta.rankingDeBarrios(10);

        assertThat(ranking).extracting(RankingDeBarrioAnalitico::sectorId).containsExactly("manga", "bocagrande", "crespo");
        assertThat(ranking).extracting(RankingDeBarrioAnalitico::posicion).containsExactly(1, 2, 2);
        assertThat(ranking.get(0).reportes()).isEqualTo(8);
        assertThat(ranking.get(0).sinAgua()).isEqualTo(6);
        assertThat(ranking.get(0).presionBaja()).isEqualTo(2);
        assertThat(ranking.get(0).porcentajeDeLaCiudad()).isEqualTo(50.0);
    }

    @Test
    void elRankingSoloDebeMirarLosUltimos30DiasConDatos() {
        almacen.reemplazarReportes(List.of(
                fila("manga", D1.minusDays(40), "SIN_AGUA", "APROBADO", 100),
                fila("manga", D1, "SIN_AGUA", "APROBADO", 1),
                fila("bocagrande", D1, "SIN_AGUA", "APROBADO", 3)), COPIA);

        List<RankingDeBarrioAnalitico> ranking = consulta.rankingDeBarrios(10);

        assertThat(ranking).extracting(RankingDeBarrioAnalitico::sectorId).containsExactly("bocagrande", "manga");
        assertThat(ranking.get(1).reportes()).isEqualTo(1);
    }

    @Test
    void elRankingDebeRespetarElLimite() {
        almacen.reemplazarReportes(List.of(fila("manga", D1, "SIN_AGUA", "APROBADO", 3),
                fila("bocagrande", D1, "SIN_AGUA", "APROBADO", 2), fila("crespo", D1, "SIN_AGUA", "APROBADO", 1)), COPIA);

        assertThat(consulta.rankingDeBarrios(2)).hasSize(2);
    }

    @Test
    void laTendenciaDebeLlenarLosDiasSinReportesConCeroYCalcularLaMediaMovil() {
        // Dia 1: 7 reportes. Dia 2: ninguno (0). Dia 3: 14. Dia 4: solo descartados (0).
        almacen.reemplazarReportes(List.of(
                fila("manga", D1, "SIN_AGUA", "APROBADO", 7),
                fila("manga", D1.plusDays(2), "SIN_AGUA", "APROBADO", 10), fila("crespo", D1.plusDays(2), "SIN_AGUA", "PENDIENTE", 4),
                fila("manga", D1.plusDays(3), "SIN_AGUA", "DESCARTADO", 9)), COPIA);

        List<PuntoTendenciaAnalitico> serie = consulta.tendenciaDeReportes(30);

        assertThat(serie).extracting(PuntoTendenciaAnalitico::dia).containsExactly(D1, D1.plusDays(1), D1.plusDays(2), D1.plusDays(3));
        assertThat(serie).extracting(PuntoTendenciaAnalitico::reportes).containsExactly(7L, 0L, 14L, 0L);
        assertThat(serie).extracting(PuntoTendenciaAnalitico::media7Dias).containsExactly(7.0, 3.5, 7.0, 5.3);
        assertThat(serie).extracting(PuntoTendenciaAnalitico::cambioRespectoAlDiaAnterior).containsExactly(null, -7L, 14L, -14L);
    }

    @Test
    void laTendenciaDebeDevolverSoloLosUltimosDiasPedidos() {
        almacen.reemplazarReportes(List.of(fila("manga", D1, "SIN_AGUA", "APROBADO", 1),
                fila("manga", D1.plusDays(4), "SIN_AGUA", "APROBADO", 1)), COPIA);

        List<PuntoTendenciaAnalitico> serie = consulta.tendenciaDeReportes(2);

        assertThat(serie).extracting(PuntoTendenciaAnalitico::dia).containsExactly(D1.plusDays(3), D1.plusDays(4));
    }

    @Test
    void sinReportesLasVistasDebenQuedarVacias() {
        assertThat(consulta.rankingDeBarrios(10)).isEmpty();
        assertThat(consulta.tendenciaDeReportes(30)).isEmpty();
    }

    @Test
    void laTablaNoDebeGuardarNingunDatoPersonal() {
        List<String> columnas = jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                 WHERE table_schema = 'analitica' AND table_name = 'reporte_dia'
                """, String.class);

        assertThat(columnas).containsExactlyInAnyOrder("sector_id", "dia", "tipo", "estado_moderacion", "cantidad", "copiado_en");
    }
}
