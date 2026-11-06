#!/usr/bin/env bash
set -euo pipefail

# Restaura un respaldo de backup-postgres.sh en una base NUEVA, nunca encima de la original (ADR-113). Así se puede comprobar un respaldo
# sin riesgo y, si hace falta volver a él, se apunta el backend a la base restaurada o se renombra a mano. Si la base de destino ya existe,
# el script se niega: no sobrescribe nada.
#
# Uso: ./scripts/restore-postgres.sh <archivo.dump> [base-de-destino]
#   base-de-destino: por defecto, aguavigia_restaurada

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ARCHIVO="${1:?Uso: restore-postgres.sh <archivo.dump> [base-de-destino]}"
DESTINO="${2:-aguavigia_restaurada}"
USUARIO="${POSTGRES_USER:-aguavigia}"

if [ ! -f "$ARCHIVO" ]; then
  echo "No existe: $ARCHIVO" >&2
  exit 1
fi

psql_en_el_contenedor() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql --username "$USUARIO" --dbname postgres --tuples-only --no-align "$@"
}

if [ "$(psql_en_el_contenedor --command "SELECT 1 FROM pg_database WHERE datname = '$DESTINO'")" = "1" ]; then
  echo "La base '$DESTINO' ya existe: no se sobrescribe. Elige otro nombre o bórrala tú (DROP DATABASE) si de verdad quieres reemplazarla." >&2
  exit 1
fi

psql_en_el_contenedor --command "CREATE DATABASE \"$DESTINO\""
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_restore --username "$USUARIO" --dbname "$DESTINO" --no-owner --exit-on-error < "$ARCHIVO"

echo "Respaldo restaurado en la base '$DESTINO'."
