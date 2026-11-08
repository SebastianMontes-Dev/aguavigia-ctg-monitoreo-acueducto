#!/usr/bin/env bash
set -euo pipefail

# Prueba que el respaldo de la base analítica SIRVE (ADR-113): hace un respaldo, lo restaura en una base temporal, compara cuántas filas
# tiene cada tabla con la original, comprueba que la cadena de hashes de la bitácora inmutable sigue válida y borra la base temporal.
# No toca la base original. Falla (código distinto de 0) si algo no cuadra: un respaldo sin restaurar y comparar no es un respaldo.
#
# Uso: ./scripts/verificar-respaldo-postgres.sh [base]   (por defecto aguavigia_analitica)

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BASE_DE_DATOS="${1:-aguavigia_analitica}"
USUARIO="${POSTGRES_USER:-aguavigia}"
TEMPORAL="${BASE_DE_DATOS}_verificacion_$$"
DIRECTORIO="$(mktemp -d)"

limpiar() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql --username "$USUARIO" --dbname postgres --command "DROP DATABASE IF EXISTS \"$TEMPORAL\"" > /dev/null 2>&1 || true
  rm -rf "$DIRECTORIO"
}
trap limpiar EXIT

psql_en() {
  local base="$1"; shift
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql --username "$USUARIO" --dbname "$base" --tuples-only --no-align "$@"
}

./scripts/backup-postgres.sh "$DIRECTORIO" "$BASE_DE_DATOS" > /dev/null
ARCHIVO="$(ls "$DIRECTORIO"/*.dump)"
./scripts/restore-postgres.sh "$ARCHIVO" "$TEMPORAL" > /dev/null

# Filas por tabla del esquema analitica, en la original y en la restaurada. Se leen del catálogo exacto con una sola consulta por base.
read -r -d '' CONTEO <<'SQL' || true
SELECT string_agg(t || '=>' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM analitica.%I', t), false, true, '')))[1]::text, ', ' ORDER BY t)
  FROM (SELECT table_name AS t FROM information_schema.tables
         WHERE table_schema = 'analitica' AND table_type = 'BASE TABLE' AND table_name <> 'flyway_schema_history') x
SQL
ORIGINAL="$(psql_en "$BASE_DE_DATOS" --command "$CONTEO")"
RESTAURADA="$(psql_en "$TEMPORAL" --command "$CONTEO")"

echo "Original   : $ORIGINAL"
echo "Restaurada : $RESTAURADA"
if [ "$ORIGINAL" != "$RESTAURADA" ]; then
  echo "FALLÓ: la base restaurada no tiene las mismas filas que la original." >&2
  exit 1
fi

# El respaldo se hizo mientras la instancia sigue viva, así que la comparación exacta solo vale si nadie escribió entre medias; la cadena sí
# tiene que ser válida siempre.
ROTOS="$(psql_en "$TEMPORAL" --command "SELECT count(*) FROM analitica.v_bitacora_cadena WHERE NOT enlace_ok OR NOT hash_ok")"
EVENTOS="$(psql_en "$TEMPORAL" --command "SELECT count(*) FROM analitica.v_bitacora_cadena")"
if [ "$ROTOS" != "0" ]; then
  echo "FALLÓ: la cadena de la bitácora restaurada tiene $ROTOS eslabón(es) roto(s)." >&2
  exit 1
fi

echo "OK: el respaldo de '$BASE_DE_DATOS' se restauró, las tablas cuadran y la cadena de la bitácora ($EVENTOS eventos) es válida."
