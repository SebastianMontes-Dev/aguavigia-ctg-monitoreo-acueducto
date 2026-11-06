package com.aguavigia.ctg.infrastructure.persistence.sql;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * La bitácora inmutable y el rol de solo lectura (ADR-113), contra un PostgreSQL real porque lo que se prueba son disparadores,
 * funciones y permisos: nada de eso existe fuera de la base.
 */
@Testcontainers
class BitacoraInmutableIT {

    private static final Instant COPIA = Instant.parse("2026-11-06T15:00:00Z");

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17.11-alpine")
            .withDatabaseName("aguavigia_analitica").withUsername("aguavigia");

    private JdbcTemplate jdbc;

    @BeforeEach
    void esquemaLimpio() {
        var dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("DROP SCHEMA IF EXISTS analitica CASCADE");
        new AlmacenAnaliticoPostgresAdapter(dataSource).registrarInicioDeCopia(COPIA);
    }

    private void evento(String id, String descripcion) {
        jdbc.update("""
                INSERT INTO analitica.bitacora_inmutable (evento_id, tipo, sector_id, ocurrio_en, descripcion, estado, fuente, copiado_en)
                VALUES (?, 'CORTE_ANUNCIADO', 'manga', ?::timestamptz, ?, 'CORTE_PROGRAMADO', 'ACUACAR', ?::timestamptz)
                """, id, "2026-11-01T10:00:00Z", descripcion, COPIA.toString());
    }

    private long eslabonesRotos() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM analitica.v_bitacora_cadena WHERE NOT enlace_ok OR NOT hash_ok", Long.class);
    }

    @Test
    void cadaFilaDebeEncadenarseConLaAnterior() {
        evento("e1", "Primero");
        evento("e2", "Segundo");
        evento("e3", "Tercero");

        List<String[]> filas = jdbc.query("SELECT hash_anterior, hash FROM analitica.bitacora_inmutable ORDER BY seq",
                (rs, n) -> new String[] {rs.getString(1), rs.getString(2)});

        assertThat(filas.get(0)[0]).isNull();
        assertThat(filas.get(1)[0]).isEqualTo(filas.get(0)[1]);
        assertThat(filas.get(2)[0]).isEqualTo(filas.get(1)[1]);
        assertThat(filas).extracting(f -> f[1]).doesNotHaveDuplicates().allSatisfy(h -> assertThat(h).hasSize(64));
        assertThat(eslabonesRotos()).isZero();
    }

    @Test
    void noDebeAdmitirModificarNiBorrarNiVaciar() {
        evento("e1", "Intocable");

        assertThatThrownBy(() -> jdbc.update("UPDATE analitica.bitacora_inmutable SET descripcion = 'cambiada'"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("solo admite INSERT");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM analitica.bitacora_inmutable"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("solo admite INSERT");
        assertThatThrownBy(() -> jdbc.execute("TRUNCATE analitica.bitacora_inmutable"))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("solo admite INSERT");

        assertThat(jdbc.queryForObject("SELECT descripcion FROM analitica.bitacora_inmutable", String.class)).isEqualTo("Intocable");
    }

    @Test
    void noDebeAdmitirUnEventoRepetido() {
        evento("e1", "Uno");

        assertThatThrownBy(() -> evento("e1", "Otra vez")).isInstanceOf(DataAccessException.class);
    }

    @Test
    void siAlguienEsquivaElBloqueoLaCadenaDebeDelatarloEnLaFilaTocada() {
        evento("e1", "Primero");
        evento("e2", "Segundo");
        evento("e3", "Tercero");

        // Un superusuario puede apagar el disparador; lo que no puede es esconder el cambio.
        jdbc.execute("ALTER TABLE analitica.bitacora_inmutable DISABLE TRIGGER bitacora_sin_modificar");
        jdbc.update("UPDATE analitica.bitacora_inmutable SET descripcion = 'reescrita' WHERE evento_id = 'e2'");
        jdbc.execute("ALTER TABLE analitica.bitacora_inmutable ENABLE TRIGGER bitacora_sin_modificar");

        List<String> rotos = jdbc.queryForList(
                "SELECT evento_id FROM analitica.v_bitacora_cadena WHERE NOT enlace_ok OR NOT hash_ok ORDER BY seq", String.class);
        assertThat(rotos).containsExactly("e2");
    }

    @Test
    void siAlguienBorraUnaFilaDelMedioElEnlaceSiguienteDebeRomperse() {
        evento("e1", "Primero");
        evento("e2", "Segundo");
        evento("e3", "Tercero");

        jdbc.execute("ALTER TABLE analitica.bitacora_inmutable DISABLE TRIGGER bitacora_sin_modificar");
        jdbc.update("DELETE FROM analitica.bitacora_inmutable WHERE evento_id = 'e2'");
        jdbc.execute("ALTER TABLE analitica.bitacora_inmutable ENABLE TRIGGER bitacora_sin_modificar");

        assertThat(jdbc.queryForList("SELECT evento_id FROM analitica.v_bitacora_cadena WHERE NOT enlace_ok", String.class))
                .containsExactly("e3");
    }

    @Test
    void elRolLectorSoloDebeVerLasVistasPublicas() {
        evento("e1", "Visible por la vista");

        jdbc.execute((java.sql.Connection conexion) -> {
            try (Statement sentencia = conexion.createStatement()) {
                sentencia.execute("SET ROLE aguavigia_lector");
                // Las vistas públicas, sí.
                sentencia.executeQuery("SELECT * FROM analitica.v_ranking_barrios").close();
                sentencia.executeQuery("SELECT * FROM analitica.v_tendencia_diaria").close();
                sentencia.executeQuery("SELECT * FROM analitica.v_bitacora_cadena").close();
                // Las tablas, no; y escribir, tampoco.
                for (String prohibida : List.of("SELECT * FROM analitica.sector", "SELECT * FROM analitica.bitacora_inmutable",
                        "INSERT INTO analitica.vigilancia (ejecutada_en, resultado) VALUES (now(), 'OK')",
                        "DELETE FROM analitica.copia")) {
                    assertThatThrownBy(() -> sentencia.execute(prohibida))
                            .isInstanceOf(SQLException.class).hasMessageContaining("permission denied");
                    // Una sentencia fallida deja la transacción abortada solo si no hay autocommit; aquí lo hay.
                }
                sentencia.execute("RESET ROLE");
            }
            return null;
        });
    }
}
