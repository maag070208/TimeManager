# syntax=docker/dockerfile:1
# Se construye desde la RAÍZ del monorepo (un solo pnpm-lock.yaml):
#   docker build -f api/Dockerfile .
#
# La migración de Prisma YA NO corre en el CMD (F1C-03): es un paso de release
# (`pnpm --filter timemanager-api prisma:migrate`) antes de levantar la réplica
# nueva. El entrypoint solo arranca la API.

# =========================
# Builder
# =========================
# Node 22 solo para instalar con pnpm 12 (packageManager de la raíz); el
# runtime sigue en Node 20.
FROM node:22-bullseye AS builder

WORKDIR /repo

RUN corepack enable

# Dependencias primero: `prisma/` y `src/` NO invalidan esta capa. Solo se
# instala el paquete de la API (`--filter`), no la web.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter timemanager-api --store-dir=/pnpm/store

# Esquema de Prisma y cliente generado (los binarios se cachean entre builds).
COPY api/prisma ./api/prisma
RUN --mount=type=cache,target=/root/.cache/prisma pnpm --filter timemanager-api exec prisma generate

# Código y compilación.
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
RUN pnpm --filter timemanager-api run build

# Imagen final sin devDependencies: se re-instala solo producción (el cliente
# de Prisma ya generado queda en node_modules/.pnpm).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter timemanager-api --store-dir=/pnpm/store


# =========================
# Runtime
# =========================
FROM node:20-bullseye-slim AS runtime

ENV NODE_ENV=production
WORKDIR /repo/api

# Sin usuario root: el proceso corre como `node` (uid 1000).
COPY --chown=node:node --from=builder /repo/node_modules /repo/node_modules
COPY --chown=node:node --from=builder /repo/api/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/api/package.json ./
COPY --chown=node:node --from=builder /repo/api/prisma ./prisma
COPY --chown=node:node --from=builder /repo/api/dist ./dist

USER node

EXPOSE 4001

# Liveness del API (no toca la BD: la readiness está en /api/v1/health/ready).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4001)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migraciones: paso de release (ver docs/OPERACION_PRODUCCION.md). Aquí solo
# arranca el proceso HTTP; los workers van en su propio contenedor con el
# entrypoint `dist/src/workers/index.js`.
CMD ["node", "dist/src/index.js"]
