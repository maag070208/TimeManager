# syntax=docker/dockerfile:1
# Se construye desde la RAÍZ del monorepo (un solo pnpm-lock.yaml):
#   docker build -f api/Dockerfile .

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


# =========================
# Runtime
# =========================
FROM node:20-bullseye-slim AS runtime

ENV NODE_ENV=production
WORKDIR /repo/api

# Misma estructura que en el builder: los enlaces de `api/node_modules` apuntan
# al almacén virtual de la raíz (`/repo/node_modules/.pnpm`).
COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/api/node_modules ./node_modules
COPY --from=builder /repo/api/package.json ./
COPY --from=builder /repo/api/prisma ./prisma
COPY --from=builder /repo/api/dist ./dist

EXPOSE 4001

# Boot de producción: aplica pendientes de migración y arranca. El seed NO corre
# aquí; es manual vía `pnpm seed`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
