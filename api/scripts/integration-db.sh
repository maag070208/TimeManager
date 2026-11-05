#!/usr/bin/env bash
# Levanta el PostgreSQL de pruebas (Docker) y aplica migraciones. SOLO local:
# no toca la base de la nube. Uso: pnpm --filter timemanager-api db:test:up
set -euo pipefail

CONTAINER="${TM_TEST_DB_CONTAINER:-tm-test-pg}"
PORT="${TM_TEST_DB_PORT:-55433}"
URL="${TM_TEST_DB_URL:-postgresql://postgres:test@127.0.0.1:${PORT}/tm_test}"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker create \
    --name "$CONTAINER" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=tm_test \
    -p "${PORT}:5432" \
    postgres:16-alpine >/dev/null
fi

docker start "$CONTAINER" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d tm_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd "$(dirname "$0")/.."
DATABASE_URL="$URL" npx prisma migrate deploy >/dev/null
echo "BD de pruebas lista en $URL"
