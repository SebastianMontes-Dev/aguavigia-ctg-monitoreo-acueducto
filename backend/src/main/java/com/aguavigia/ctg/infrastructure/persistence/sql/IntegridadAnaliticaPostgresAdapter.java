package com.aguavigia.ctg.infrastructure.persistence.sql;

import com.aguavigia.ctg.domain.AnaliticaNoDisponibleException;
import com.aguavigia.ctg.domain.FilaEventoAnalitico;
import com.aguavigia.ctg.domain.RegistroDeVigilancia;
import com.aguavigia.ctg.domain.SumasDeBarrio;
import com.aguavigia.ctg.domain.VerificacionDeBitacora;
import com.aguavigia.ctg.domain.port.out.IntegridadAnaliticaPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * El vigilante en PostgreSQL (ADR-113). No migra: las tablas las crea Flyway en la primera copia ({@link AlmacenAnaliticoPostgresAdapter}),
 * así que si el vigilante corre antes, o con la base apagada, lanza {@link AnaliticaNoDisponibleException} y la revisión se anota como fallida.
 * El gestor de transacciones es privado de este adaptador, por la misma razón que en el almacén.
 */
public class IntegridadAnaliticaPostgresAdapter implements IntegridadAnaliticaPort {

    private static final Logger log = LoggerFactory.getLogger(IntegridadAnaliticaPostgresAdapter.class);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaccion;

    public IntegridadAnaliticaPostgresAdapter(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.transaccion = new TransactionTemplate(new JdbcTransactionManager(dataSource));
    }

    @Override
    public Set<String> idsDeBitacora() {
        return alcanzable(() -> new HashSet<>(jdbc.queryForList("SELECT evento_id FROM analitica.bitacora_inmutable", String.class)));
    }

    @Override
    public int anexarABitacora(List<FilaEventoAnalitico> eventos, Instant copiadoEn) {
        if (eventos.isEmpty()) {
            return 0;
        }
        return alcanzable(() -> transaccion.execute(estado -> {
            OffsetDateTime copiado = utc(copiadoEn);
            // El orden del lote es el de la cadena; ON CONFLICT cubre a dos réplicas que copien a la vez (la segunda no agrega nada).
            int[][] resultados = jdbc.batchUpdate("""
                    INSERT INTO analitica.bitacora_inmutable (evento_id, tipo, sector_id, corte_id, ocurrio_en, descripcion, estado, fuente, copiado_en)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (evento_id) DO NOTHING
                    """, eventos, 1000, (ps, evento) -> {
                ps.setString(1, evento.id());
                ps.setString(2, evento.tipo());
                ps.setString(3, evento.sectorId());
                ps.setString(4, evento.corteId());
                ps.setObject(5, utc(evento.ocurrioEn()));
                ps.setString(6, evento.descripcion());
                ps.setString(7, evento.estado());
                ps.setString(8, evento.fuente());
                ps.setObject(9, copiado);
            });
            int agregados = 0;
            for (int[] lote : resultados) {
                for (int filas : lote) {
                    agregados += filas > 0 ? filas : 0;
                }
            }
            return agregados;
        }));
    }

    @Override
    public Map<String, SumasDeBarrio> sumasPorBarrio() {
        return alcanzable(() -> {
            Map<String, SumasDeBarrio> sumas = new HashMap<>();
            jdbc.query("""
                    SELECT s.id,
                           COALESCE(p.pares, 0), COALESCE(p.cierres, 0), COALESCE(p.segundos, 0), COALESCE(r.reportes, 0)
                      FROM analitica.sector s
                      LEFT JOIN (SELECT sector_id, COUNT(*) AS pares, COUNT(cierre_hora) AS cierres,
                                        COALESCE(SUM(FLOOR(EXTRACT(EPOCH FROM cierre_hora))::BIGINT), 0) AS segundos
                                   FROM analitica.corte_sector GROUP BY sector_id) p ON p.sector_id = s.id
                      LEFT JOIN (SELECT sector_id, SUM(cantidad)::BIGINT AS reportes
                                   FROM analitica.reporte_dia GROUP BY sector_id) r ON r.sector_id = s.id
                    """, rs -> {
                SumasDeBarrio fila = new SumasDeBarrio(rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5));
                if (!fila.equals(SumasDeBarrio.VACIAS)) {
                    sumas.put(rs.getString(1), fila);
                }
            });
            return sumas;
        });
    }

    @Override
    public VerificacionDeBitacora verificarCadena() {
        return alcanzable(() -> jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM analitica.v_bitacora_cadena),
                       (SELECT COUNT(*) FROM analitica.v_bitacora_cadena WHERE NOT enlace_ok OR NOT hash_ok),
                       (SELECT hash FROM analitica.bitacora_inmutable ORDER BY seq DESC LIMIT 1)
                """, (rs, fila) -> new VerificacionDeBitacora(rs.getLong(1), rs.getLong(2), rs.getString(3))));
    }

    @Override
    public long registrarVigilancia(RegistroDeVigilancia revision) {
        return alcanzable(() -> jdbc.queryForObject("""
                INSERT INTO analitica.vigilancia (ejecutada_en, resultado, barrios_revisados, diferencias, eventos_en_bitacora,
                                                  eslabones_rotos, detalle)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, utc(revision.ejecutadaEn()), revision.resultado().name(), revision.barriosRevisados(),
                revision.diferencias(), revision.eventosEnBitacora(), revision.eslabonesRotos(), revision.detalle()));
    }

    private static OffsetDateTime utc(Instant instante) {
        return instante.atOffset(ZoneOffset.UTC);
    }

    private <T> T alcanzable(Supplier<T> operacion) {
        try {
            return operacion.get();
        } catch (DataAccessException fallo) {
            log.warn("La base analítica no respondió al vigilante: {}", AlmacenAnaliticoPostgresAdapter.causaRaiz(fallo));
            throw new AnaliticaNoDisponibleException("La base analítica no está disponible", fallo);
        }
    }
}
