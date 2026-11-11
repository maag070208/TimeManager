#!/bin/sh
# Genera /config.js con la configuración de runtime (prioridad sobre VITE_API_URL).
# Se ejecuta solo al arrancar el contenedor (nginx lo invoca desde docker-entrypoint.d).
set -eu

: "${API_URL:=}"
: "${TENANT_BASE_DOMAIN:=}"

# Escapa comillas simples para meter el valor en un string JS.
safe_api_url=$(printf '%s' "$API_URL" | sed "s/'/\\\\'/g")
# Solo caracteres de dominio: el valor entra tal cual en un string JS.
safe_base_domain=$(printf '%s' "$TENANT_BASE_DOMAIN" | tr -cd 'A-Za-z0-9.-')

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = { API_URL: '${safe_api_url}', TENANT_BASE_DOMAIN: '${safe_base_domain}' };
EOF
