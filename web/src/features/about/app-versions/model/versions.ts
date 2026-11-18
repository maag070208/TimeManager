import { get } from "@shared/api/client";

export interface PartVersion {
  version: string | null;
  commit: string | null;
}

export const WEB_VERSION: PartVersion = { version: __APP_VERSION__, commit: __APP_COMMIT__ || null };

/** `GET /health` es público y trae la versión y el commit del API. */
export const fetchApiVersion = async (): Promise<PartVersion> => {
  const health = await get<{ version?: string; commit?: string | null }>("/health");
  return { version: health.version ?? null, commit: health.commit ?? null };
};
