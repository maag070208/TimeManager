/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ABLY_API_KEY?: string;
  /** Dominio base de los subdominios de cliente en producción (p. ej. `timemanager.mx`). */
  readonly VITE_TENANT_BASE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare const __APP_VERSION__: string;
