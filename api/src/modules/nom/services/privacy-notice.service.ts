import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { NomSettingsService } from "./nom-settings.service";

/** Huella del texto aceptado: la misma para la aceptación en Mi jornada y en teletrabajo. */
export const privacyTextHash = (text: string, version: number): string =>
  createHash("sha256").update(JSON.stringify({ text, version })).digest("hex");

/**
 * ¿La persona aceptó el aviso vigente del cliente? `true` si el cliente aún no
 * publica aviso (no hay nada que aceptar).
 */
export const hasCurrentPrivacyConsent = async (
  db: Pick<PrismaClient, "privacyConsent">,
  userId: string,
  policy: { privacyNotice: string | null; privacyNoticeVersion: number }
): Promise<boolean> => {
  if (!policy.privacyNotice) return true;
  const consent = await db.privacyConsent.findUnique({
    where: { userId_version: { userId, version: policy.privacyNoticeVersion } },
    select: { id: true },
  });
  return consent !== null;
};

export interface MyPrivacyNotice {
  /** `null`: el cliente aún no publica su aviso. */
  notice: string | null;
  version: number;
  accepted: boolean;
  acceptedAt: string | null;
}

export interface PrivacyConsentRow {
  userId: string;
  name: string;
  employeeNumber: string | null;
  acceptedAt: string | null;
}

export interface PrivacyConsentSummary {
  notice: string | null;
  version: number;
  updatedAt: string | null;
  accepted: number;
  pending: number;
  people: PrivacyConsentRow[];
}

/**
 * Aviso de privacidad del cliente para TODO su personal (LFPDPPP): la persona
 * lo acepta una vez por versión desde Mi jornada y queda la constancia (fecha,
 * IP y hash del texto). Sin aceptación vigente, la checada web/app no guarda
 * ubicación (ver `RemotePunchService`).
 */
export class PrivacyNoticeService {
  constructor(
    private readonly settings: NomSettingsService,
    private readonly db: PrismaClient = prismaClient,
    private readonly audit?: AuditLogger
  ) {}

  private async tenantOf(userId: string): Promise<string> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    if (!user.tenantId) throw new HttpError(400, "TENANT_REQUIRED");
    return user.tenantId;
  }

  async mine(userId: string): Promise<MyPrivacyNotice> {
    const tenantId = await this.tenantOf(userId);
    const { policy } = await this.settings.resolve(tenantId);
    const consent = policy.privacyNotice
      ? await this.db.privacyConsent.findUnique({
          where: { userId_version: { userId, version: policy.privacyNoticeVersion } },
          select: { acceptedAt: true },
        })
      : null;
    return {
      notice: policy.privacyNotice,
      version: policy.privacyNoticeVersion,
      accepted: consent !== null,
      acceptedAt: consent?.acceptedAt.toISOString() ?? null,
    };
  }

  /** La persona acepta la versión que leyó; si el texto cambió mientras tanto, se le pide de nuevo. */
  async accept(userId: string, version: number, ip: string | null, actorName?: string): Promise<MyPrivacyNotice> {
    const tenantId = await this.tenantOf(userId);
    const { policy } = await this.settings.resolve(tenantId);
    if (!policy.privacyNotice) throw new HttpError(409, "PRIVACY_NOTICE_NOT_SET");
    if (version !== policy.privacyNoticeVersion) throw new HttpError(409, "PRIVACY_NOTICE_VERSION_CHANGED");

    const existing = await this.db.privacyConsent.findUnique({
      where: { userId_version: { userId, version } },
    });
    if (!existing) {
      const textHash = privacyTextHash(policy.privacyNotice, version);
      const row = await this.db.privacyConsent.create({
        data: { userId, version, textHash, acceptedIp: ip },
      });
      await this.audit?.({
        action: "PRIVACY_NOTICE_ACCEPTED",
        entityType: "PrivacyConsent",
        entityId: row.id,
        userId,
        userName: actorName,
        newState: { version, textHash, acceptedAt: row.acceptedAt.toISOString() },
      });
    }
    return this.mine(userId);
  }

  /** RH: quién aceptó la versión vigente y quién falta (personal activo del cliente). */
  async summary(tenantId: string): Promise<PrivacyConsentSummary> {
    const { policy } = await this.settings.resolve(tenantId);
    const [people, consents] = await Promise.all([
      this.db.user.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, middleName: true, paternalSurname: true, maternalSurname: true, employeeNumber: true },
        orderBy: { name: "asc" },
      }),
      policy.privacyNotice
        ? this.db.privacyConsent.findMany({
            where: { version: policy.privacyNoticeVersion },
            select: { userId: true, acceptedAt: true },
          })
        : Promise.resolve([]),
    ]);
    const acceptedBy = new Map(consents.map((row) => [row.userId, row.acceptedAt]));
    const rows = people.map((person) => ({
      userId: person.id,
      name: person.name,
      employeeNumber: person.employeeNumber,
      acceptedAt: acceptedBy.get(person.id)?.toISOString() ?? null,
    }));
    const accepted = rows.filter((row) => row.acceptedAt).length;
    return {
      notice: policy.privacyNotice,
      version: policy.privacyNoticeVersion,
      updatedAt: policy.policiesUpdatedAt,
      accepted,
      pending: rows.length - accepted,
      people: rows.sort((a, b) => Number(Boolean(a.acceptedAt)) - Number(Boolean(b.acceptedAt))),
    };
  }
}
