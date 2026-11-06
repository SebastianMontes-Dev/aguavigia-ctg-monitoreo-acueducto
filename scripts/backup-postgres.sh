#!/usr/bin/env bash
set -euo pipefail

# Respaldo de la base analítica de PostgreSQL con pg_dump (formato custom, comprimido) dentro del contenedor del compose local (ADR-113).
# La base analítica es una COPIA derivada de Mongo: si se pierde se reconstruye en la siguiente copia, salvo la bitácora inmutable, que
# conserva el hash de cada evento y por eso vale la pena respaldar.
#
# Uso: ./scripts/backup-postgres.sh [directorio-de-respaldos] [base]
#   base: aguavigia_analitica (por defecto, la de la instancia real) o aguavigia_sim_analitica (la de la simulación)

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DIRECTORIO_RESPALDOS="${1:-./respaldos-postgres}"
BASE_DE_DATOS="${2:-aguavigia_analitica}"
USUARIO="${POSTGRES_USER:-aguavigia}"

mkdir -p "$DIRECTORIO_RESPALDOS"

MARCA_DE_TIEMPO="$(date +%Y%m%dT%H%M%S)"
ARCHIVO="$DIRECTORIO_RESPALDOS/${BASE_DE_DATOS}-${MARCA_DE_TIEMPO}.dump"
PARCIAL="$ARCHIVO.parcial"

# Se escribe a un archivo parcial y solo se renombra si pg_dump terminó bien: si falla, no queda un archivo pequeño y corrupto con pinta de
# respaldo que alguien restaure el día que haga falta.
trap 'rm -f "$PARCIAL"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump --username "$USUARIO" --format custom --compress 6 "$BASE_DE_DATOS" > "$PARCIAL"

# pg_restore --list lee el índice del archivo: si el volcado está truncado o corrupto, falla aquí y no al restaurar.
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'cat > /tmp/verificacion.dump && pg_restore --list /tmp/verificacion.dump > /dev/null && rm -f /tmp/verificacion.dump' < "$PARCIAL"

mv "$PARCIAL" "$ARCHIVO"
echo "Respaldo de '$BASE_DE_DATOS' escrito en $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
