-- Los reportes ciudadanos en la copia analítica (ADR-112). Solo conteos: por barrio, día (hora de Cartagena), tipo y estado de moderación.
-- Nada de coordenadas, huella de dispositivo, red ni fotos: ningún dato personal en PostgreSQL (ADR-100).

CREATE TABLE analitica.reporte_dia (
    sector_id          TEXT        NOT NULL REFERENCES analitica.sector(id) ON DELETE CASCADE,
    dia                DATE        NOT NULL,
    tipo               TEXT        NOT NULL,
    estado_moderacion  TEXT        NOT NULL CHECK (estado_moderacion IN ('PENDIENTE', 'APROBADO', 'DESCARTADO')),
    cantidad           INTEGER     NOT NULL CHECK (cantidad > 0),
    copiado_en         TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (sector_id, dia, tipo, estado_moderacion)
);
CREATE INDEX reporte_dia_por_dia ON analitica.reporte_dia (dia);

-- Lo que cuenta como reporte: todo menos lo que el veedor descartó.
CREATE VIEW analitica.v_reportes_vigentes AS
SELECT sector_id, dia, tipo, SUM(cantidad)::BIGINT AS cantidad
  FROM analitica.reporte_dia
 WHERE estado_moderacion <> 'DESCARTADO'
 GROUP BY sector_id, dia, tipo;

-- Ranking de barrios por reportes de los últimos 30 días CON DATOS (se cuenta hacia atrás desde el último día copiado, no desde hoy:
-- así una simulación vieja o una base parada siguen dando un ranking). RANK() comparte posición entre empates.
CREATE VIEW analitica.v_ranking_barrios AS
WITH referencia AS (
    SELECT MAX(dia) AS ultimo FROM analitica.reporte_dia
), ventana AS (
    SELECT v.sector_id,
           SUM(v.cantidad)                                          AS reportes,
           SUM(v.cantidad) FILTER (WHERE v.tipo = 'SIN_AGUA')       AS sin_agua,
           SUM(v.cantidad) FILTER (WHERE v.tipo = 'PRESION_BAJA')   AS presion_baja
      FROM analitica.v_reportes_vigentes v
      CROSS JOIN referencia r
     WHERE v.dia > r.ultimo - 30
     GROUP BY v.sector_id
)
SELECT RANK() OVER (ORDER BY w.reportes DESC)::INTEGER                    AS posicion,
       s.id                                                              AS sector_id,
       s.nombre,
       w.reportes::BIGINT                                                AS reportes,
       COALESCE(w.sin_agua, 0)::BIGINT                                   AS sin_agua,
       COALESCE(w.presion_baja, 0)::BIGINT                               AS presion_baja,
       ROUND(100.0 * w.reportes / SUM(w.reportes) OVER (), 1)::DOUBLE PRECISION AS porcentaje_ciudad
  FROM ventana w
  JOIN analitica.sector s ON s.id = w.sector_id;

-- Reportes por día, sin huecos (un día sin reportes vale 0), con la media móvil de 7 días y el cambio frente al día anterior.
CREATE VIEW analitica.v_tendencia_diaria AS
WITH rango AS (
    SELECT generate_series(MIN(dia), MAX(dia), INTERVAL '1 day')::DATE AS dia FROM analitica.reporte_dia
), diario AS (
    SELECT r.dia, COALESCE(SUM(v.cantidad), 0)::BIGINT AS reportes
      FROM rango r
      LEFT JOIN analitica.v_reportes_vigentes v ON v.dia = r.dia
     GROUP BY r.dia
)
SELECT dia,
       reportes,
       ROUND(AVG(reportes) OVER (ORDER BY dia ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1)::DOUBLE PRECISION AS media_7d,
       reportes - LAG(reportes) OVER (ORDER BY dia)                                                           AS cambio_dia
  FROM diario;
