# syntax=docker/dockerfile:1
# Se construye desde la RAÍZ del monorepo (un solo pnpm-lock.yaml):
#   docker build -f web/Dockerfile --build-arg VITE_API_URL=... .

# =========================
# Builder
# =========================
FROM node:22-bullseye-slim AS builder

WORKDIR /repo

RUN corepack enable

# Dependencias primero: esta capa se reusa mientras no cambie el lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter timemanager-web --store-dir=/pnpm/store

# Código y build de PRODUCCIÓN: `tsc -b` (typecheck) + `vite build` minimizado.
# La URL del API se puede fijar en build (VITE_API_URL) o en runtime con el
# env `API_URL` del contenedor, que render-config.sh escribe en /config.js.
COPY web ./web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter timemanager-web run build:prod


# =========================
# Runtime — nginx
# =========================
FROM nginx:1.27-alpine AS runtime

# API_URL es la config de runtime (prioridad sobre el build). Ejemplo:
#   docker run -e API_URL=https://api.timemanager.mx/api/v1 ...
ENV API_URL=""

COPY --from=builder /repo/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 web/render-config.sh /docker-entrypoint.d/10-render-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
