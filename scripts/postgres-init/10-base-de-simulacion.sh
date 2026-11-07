#!/bin/sh
# Se ejecuta solo al crear el volumen de PostgreSQL por primera vez. La simulación copia su Mongo (aguavigia_sim) a su propia base
# analítica y no a la de la instancia real (ADR-112). En un volumen que ya existe, una vez:
#   docker exec aguavigia-postgres createdb -U aguavigia aguavigia_sim_analitica
set -e
createdb --username "$POSTGRES_USER" aguavigia_sim_analitica
