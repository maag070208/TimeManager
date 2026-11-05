type RuntimeConfig = { API_URL?: string };

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

// Prioridad: 1) config en runtime (nginx/config.js desde AXZY_PTNV_SERVERS/.env),
//            2) VITE_API_URL (build/dev), 3) por defecto ruta relativa del proxy.
const BASE_URL =
  window.__APP_CONFIG__?.API_URL ||
  ((import.meta as any).env?.VITE_API_URL as string | undefined) ||
  "/api/v1";

export const API_CONSTANTS = {
  BASE_URL,
  TIMEOUT: 30000,
  HEADERS: {
    "Content-Type": "application/json",
  },
} as const;