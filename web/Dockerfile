# syntax=docker/dockerfile:1

# =========================
# Builder
# =========================
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# pnpm (la caché de npm evita re-descargarlo en cada build).
RUN --mount=type=cache,target=/root/.npm npm install -g pnpm@10

# Dependencias primero: esta capa se reusa mientras no cambie el lockfile.
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# Código y build. La imagen solo necesita el artefacto: `vite` (esbuild) compila
# sin tipar. El typecheck (`tsc -b`) sigue corriendo en `pnpm run build`
# (local/CI); aquí se omite para un build de imagen más rápido.
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm run build:image


# =========================
# Runtime — nginx
# =========================
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 render-config.sh /docker-entrypoint.d/10-render-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
