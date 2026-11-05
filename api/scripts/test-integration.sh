#!/usr/bin/env bash
# Corre las pruebas de integración (API real + PostgreSQL local de pruebas).
#   pnpm --filter timemanager-api db:test:up     # una vez / cuando cambie el esquema
#   pnpm --filter timemanager-api test:integration
#
# Los archivos corren en serie: cada uno trunca la base al arrancar.
set -euo pipefail

cd "$(dirname "$0")/.."
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:test@127.0.0.1:55433/tm_test}"
export NODE_ENV=test

node \
  --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  --test \
  --test-concurrency=1 \
  "tests/integration/**/*.test.ts"
