import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { logger } from "@core/utils/logger";
import { decryptSecret, encryptSecret } from "@core/utils/crypto";
import { blockedClockTarget, resolvedBlockedAddress } from "./clock-url";
import type { FingerprintStation } from "./time-clock-people.service";

/** Origen del equipo que se está usando para enrolar huellas. */
export type FingerprintStationSource = "tenant" | "platform" | "env" | "none";

export interface FingerprintStationInfo {
  configured: boolean;
  url: string | null;
  username: string | null;
  hasPassword: boolean;
  source: FingerprintStationSource;
  /** `null` = scope de plataforma. */
  scopeTenantId: string | null;
}

export interface FingerprintStationSaveInput {
  /** `null`/ausente = default de plataforma; uuid = override del cliente. */
  tenantId?: string | null;
  url?: string;
  username?: string;
  password?: string;
  /** Borra el override (vuelve al scope inferior / `.env`). */
  clear?: boolean;
}

/** Fallback de desarrollo/E2E: el par global del `.env` (compatibilidad). */
const envStation = (): FingerprintStation | null => {
  const url = process.env.FINGERPRINT_STATION_URL;
  const user = process.env.FINGERPRINT_STATION_USER;
  const pass = process.env.FINGERPRINT_STATION_PASS;
  return url && user && pass ? { url, user, pass } : null;
};

/**
 * Normaliza la dirección de la estación (conserva la ruta: la estación puede
 * exponerse bajo un prefijo) y rechaza destinos que conviertan al API en un
 * proxy hacia la red interna o los metadatos de la nube.
 */
const normalizeUrl = async (value: string): Promise<string> => {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new HttpError(400, "FINGERPRINT_STATION_INVALID_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpError(400, "FINGERPRINT_STATION_INVALID_URL");
  }
  const normalized = parsed.toString().replace(/\/$/, "");
  const reason = blockedClockTarget(parsed.origin) ?? (await resolvedBlockedAddress(parsed.origin));
  if (reason) {
    logger.warn(`[fingerprint-station] dirección rechazada (${reason}): ${parsed.origin}`);
    throw new HttpError(400, "FINGERPRINT_STATION_INVALID_URL");
  }
  return normalized;
};

/**
 * Estación de enrolamiento de huellas configurable (F1B-12).
 *
 * Precedencia: override del cliente (estación en sitio) → default de
 * plataforma (estación central de CheckLab) → `FINGERPRINT_STATION_*` del
 * `.env` (fallback de desarrollo/E2E). La contraseña se guarda cifrada con
 * AES-256-GCM y **nunca** se devuelve por la API (solo `hasPassword`).
 */
export class FingerprintStationService {
  constructor(private readonly db: PrismaClient = prismaClient) {}

  private decryptRow(row: { url: string; username: string; passwordEncrypted: string }): FingerprintStation | null {
    try {
      return { url: row.url, user: row.username, pass: decryptSecret(row.passwordEncrypted) };
    } catch (error) {
      logger.error(
        `[fingerprint-station] no se pudo descifrar la contraseña guardada: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  private async rowFor(tenantId: string | null) {
    return this.db.fingerprintStationConfig.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
  }

  /** Equipo efectivo para el cliente (o la estación central si no tiene override). */
  async resolve(tenantId: string | null): Promise<FingerprintStation | null> {
    if (tenantId) {
      const own = await this.rowFor(tenantId);
      const station = own ? this.decryptRow(own) : null;
      if (station) return station;
    }
    const platform = await this.rowFor(null);
    const central = platform ? this.decryptRow(platform) : null;
    return central ?? envStation();
  }

  /** Estado del scope pedido (sin exponer la contraseña). */
  async info(tenantId: string | null): Promise<FingerprintStationInfo> {
    const scopeRow = await this.rowFor(tenantId);
    if (scopeRow) {
      return {
        configured: true,
        url: scopeRow.url,
        username: scopeRow.username,
        hasPassword: true,
        source: tenantId ? "tenant" : "platform",
        scopeTenantId: tenantId,
      };
    }
    if (tenantId) {
      const central = await this.rowFor(null);
      if (central) {
        return {
          configured: true,
          url: central.url,
          username: central.username,
          hasPassword: true,
          source: "platform",
          scopeTenantId: tenantId,
        };
      }
    }
    const env = envStation();
    return {
      configured: env !== null,
      url: env?.url ?? null,
      username: env?.user ?? null,
      hasPassword: env !== null,
      source: env ? "env" : "none",
      scopeTenantId: tenantId,
    };
  }

  /**
   * Crea/actualiza la configuración de un scope. Sin `password` conserva la
   * existente; `clear` elimina la fila (vuelve al fallback inferior).
   */
  async save(input: FingerprintStationSaveInput, actorId: string): Promise<FingerprintStationInfo> {
    const scopeTenantId = input.tenantId ?? null;
    if (scopeTenantId) {
      const tenant = await this.db.tenant.findUnique({ where: { id: scopeTenantId }, select: { id: true } });
      if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND");
    }

    if (input.clear) {
      await this.db.fingerprintStationConfig.deleteMany({ where: { tenantId: scopeTenantId } });
      return this.info(scopeTenantId);
    }

    const existing = await this.rowFor(scopeTenantId);
    const url = input.url !== undefined ? await normalizeUrl(input.url) : existing?.url;
    const username = input.username?.trim() || existing?.username;
    const password = input.password?.trim() || (existing ? undefined : "");
    if (!url || !username) throw new HttpError(400, "FINGERPRINT_STATION_REQUIRED_FIELDS");
    if (!existing && !password) throw new HttpError(400, "FINGERPRINT_STATION_PASSWORD_REQUIRED");

    if (existing) {
      await this.db.fingerprintStationConfig.update({
        where: { id: existing.id },
        data: {
          url,
          username,
          ...(password ? { passwordEncrypted: encryptSecret(password) } : {}),
          updatedById: actorId,
        },
      });
    } else {
      await this.db.fingerprintStationConfig.create({
        data: {
          tenantId: scopeTenantId,
          url,
          username,
          passwordEncrypted: encryptSecret(password!),
          updatedById: actorId,
        },
      });
    }
    return this.info(scopeTenantId);
  }
}
