-- Fase 2 y 3 de PostgreSQL (ADR-113): el vigilante de integridad, la bitácora inmutable y un rol de solo lectura.
-- Sigue siendo una copia derivada de Mongo y sin datos personales: la bitácora pública no tiene ninguno.

-- ───────────── El vigilante ─────────────
-- Una fila por revisión: compara Mongo con PostgreSQL a fondo (sumas por barrio, referencias colgantes) y avisa. No corrige nada.
CREATE TABLE analitica.vigilancia (
    id                   BIGSERIAL   PRIMARY KEY,
    ejecutada_en         TIMESTAMPTZ NOT NULL,
    resultado            TEXT        NOT NULL CHECK (resultado IN ('OK', 'CON_DIFERENCIAS', 'FALLIDA')),
    barrios_revisados    INTEGER     NOT NULL DEFAULT 0,
    diferencias          INTEGER     NOT NULL DEFAULT 0,
    eventos_en_bitacora  BIGINT      NOT NULL DEFAULT 0,
    eslabones_rotos      BIGINT      NOT NULL DEFAULT 0,
    detalle              TEXT
);

-- ───────────── La bitácora inmutable ─────────────
-- Solo se agrega. Cada fila guarda el hash de la anterior, así que tocar una fila (aunque alguien con permisos esquive el bloqueo)
-- rompe la cadena y la vista v_bitacora_cadena lo delata.
CREATE TABLE analitica.bitacora_inmutable (
    seq            BIGSERIAL   PRIMARY KEY,
    evento_id      TEXT        NOT NULL UNIQUE,
    tipo           TEXT        NOT NULL,
    sector_id      TEXT,
    corte_id       TEXT,
    ocurrio_en     TIMESTAMPTZ NOT NULL,
    descripcion    TEXT        NOT NULL,
    estado         TEXT,
    fuente         TEXT,
    copiado_en     TIMESTAMPTZ NOT NULL,
    hash_anterior  TEXT,
    hash           TEXT        NOT NULL
);
CREATE INDEX bitacora_inmutable_por_fecha ON analitica.bitacora_inmutable (ocurrio_en);

-- La misma fórmula para sellar una fila y para comprobarla después.
CREATE FUNCTION analitica.bitacora_hash(anterior TEXT, evento_id TEXT, tipo TEXT, sector_id TEXT, corte_id TEXT,
                                        ocurrio_en TIMESTAMPTZ, descripcion TEXT, estado TEXT, fuente TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT encode(sha256(convert_to(
        coalesce(anterior, '') || '|' || evento_id || '|' || tipo || '|' || coalesce(sector_id, '') || '|' || coalesce(corte_id, '')
        || '|' || to_char(ocurrio_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' || descripcion
        || '|' || coalesce(estado, '') || '|' || coalesce(fuente, ''), 'UTF8')), 'hex')
$$;

-- Al insertar: enlaza con el hash de la fila anterior y sella la nueva. El candado serializa los inserts para que dos copias
-- simultáneas no encadenen dos filas a la misma anterior.
CREATE FUNCTION analitica.bitacora_encadenar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('analitica.bitacora_inmutable'));
    SELECT b.hash INTO NEW.hash_anterior FROM analitica.bitacora_inmutable b ORDER BY b.seq DESC LIMIT 1;
    NEW.hash := analitica.bitacora_hash(NEW.hash_anterior, NEW.evento_id, NEW.tipo, NEW.sector_id, NEW.corte_id,
                                        NEW.ocurrio_en, NEW.descripcion, NEW.estado, NEW.fuente);
    RETURN NEW;
END $$;
CREATE TRIGGER bitacora_encadenar BEFORE INSERT ON analitica.bitacora_inmutable
    FOR EACH ROW EXECUTE FUNCTION analitica.bitacora_encadenar();

CREATE FUNCTION analitica.bitacora_rechazar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La bitácora inmutable solo admite INSERT (se rechazó %)', TG_OP USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER bitacora_sin_modificar BEFORE UPDATE OR DELETE ON analitica.bitacora_inmutable
    FOR EACH ROW EXECUTE FUNCTION analitica.bitacora_rechazar();
CREATE TRIGGER bitacora_sin_vaciar BEFORE TRUNCATE ON analitica.bitacora_inmutable
    FOR EACH STATEMENT EXECUTE FUNCTION analitica.bitacora_rechazar();

-- Comprueba cada eslabón: que apunte al hash de la fila anterior y que su propio hash salga de sus datos.
CREATE VIEW analitica.v_bitacora_cadena AS
SELECT b.seq, b.evento_id, b.hash,
       b.hash_anterior IS NOT DISTINCT FROM LAG(b.hash) OVER (ORDER BY b.seq) AS enlace_ok,
       b.hash = analitica.bitacora_hash(b.hash_anterior, b.evento_id, b.tipo, b.sector_id, b.corte_id, b.ocurrio_en,
                                        b.descripcion, b.estado, b.fuente) AS hash_ok
  FROM analitica.bitacora_inmutable b;

-- ───────────── Un rol de solo lectura ─────────────
-- Para exportar datos abiertos o enseñar permisos: solo ve las vistas públicas, nunca las tablas. NOLOGIN a propósito: quien lo use crea
-- su usuario con `CREATE USER x IN ROLE aguavigia_lector PASSWORD '…'`. Si quien migra no puede crear roles, se omite sin fallar.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aguavigia_lector') THEN
        CREATE ROLE aguavigia_lector NOLOGIN;
    END IF;
    GRANT USAGE ON SCHEMA analitica TO aguavigia_lector;
    GRANT SELECT ON analitica.v_cumplimiento_global, analitica.v_cumplimiento_por_sector, analitica.v_cumplimiento_mensual,
                    analitica.v_ranking_barrios, analitica.v_tendencia_diaria, analitica.v_bitacora_cadena
                 TO aguavigia_lector;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'No se creó aguavigia_lector: el usuario de la migración no puede crear roles';
END $$;
