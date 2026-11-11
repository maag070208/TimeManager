import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { formatDateTime, systemLanguage, t } from "@core/i18n";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { NotificationPort } from "@modules/notifications";
import type {
  MyTelework,
  OutOfHoursContactDto,
  OutOfHoursContactInput,
  TeleworkChecklistDto,
  TeleworkChecklistKind,
  TeleworkPolicyUpdateInput,
  TeleworkRegistrationDto,
  TeleworkRegistrationInput,
  TeleworkRegistrationUpdateInput,
} from "../models/entity/nom.entity";
import type { NomSettingsService } from "./nom-settings.service";

/**
 * Plantilla del checklist del lugar de teletrabajo (NOM-037). Las claves se
 * traducen en la web (`nom:checklist.items.<clave>`); el API valida que estén
 * todas respondidas.
 */
export const TELEWORK_CHECKLIST_ITEMS = [
  "space_adequate",
  "ergonomics",
  "electrical_safety",
  "connectivity",
  "ventilation_lighting",
  "emergency_plan",
  "equipment_inventory",
  "no_risk_conditions",
] as const;

export const TELEWORK_CHECKLIST_VERSION = 1;

/** Periodicidad del checklist (12 meses). */
const PERIODIC_MONTHS = 12;

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() < day) next.setUTCDate(0);
  return next;
};

type RegistrationRow = Awaited<ReturnType<PrismaClient["teleworkRegistration"]["findFirst"]>>;

/**
 * NOM-037 (teletrabajo) + F2-08: registro de teletrabajadores por cliente,
 * política y aviso de privacidad con consentimiento versionado, checklist del
 * lugar de trabajo y registro de comunicaciones fuera de jornada.
 */
export class TeleworkService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly settings: NomSettingsService,
    private readonly notifications?: NotificationPort,
    private readonly audit?: AuditLogger
  ) {}

  checklistTemplate() {
    return { version: TELEWORK_CHECKLIST_VERSION, items: [...TELEWORK_CHECKLIST_ITEMS] };
  }

  private toRegistrationDto(
    row: NonNullable<RegistrationRow> & {
      user?: { name: string; email: string | null; employeeNumber: string | null } | null;
      checklists?: Array<{ kind: TeleworkChecklistKind; completedAt: Date }>;
    }
  ): TeleworkRegistrationDto {
    const checklists = [...(row.checklists ?? [])].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    );
    const last = checklists[checklists.length - 1] ?? null;
    const nextPeriodicDueAt = last ? addMonths(last.completedAt, PERIODIC_MONTHS).toISOString() : null;
    return {
      id: row.id,
      userId: row.userId,
      userName: row.user?.name ?? null,
      email: row.user?.email ?? null,
      employeeNumber: row.user?.employeeNumber ?? null,
      mode: row.mode,
      status: row.status,
      homeAddress: row.homeAddress,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      consentAcceptedAt: row.consentAcceptedAt?.toISOString() ?? null,
      consentPolicyVersion: row.consentPolicyVersion,
      consentPrivacyVersion: row.consentPrivacyVersion,
      notes: row.notes,
      lastChecklist: last ? { kind: last.kind, completedAt: last.completedAt.toISOString() } : null,
      nextPeriodicDueAt,
    };
  }

  private toChecklistDto(
    row: {
      id: string;
      registrationId: string;
      userId: string;
      kind: TeleworkChecklistKind;
      answers: unknown;
      completedAt: Date;
      user?: { name: string } | null;
    }
  ): TeleworkChecklistDto {
    return {
      id: row.id,
      registrationId: row.registrationId,
      userId: row.userId,
      userName: row.user?.name ?? null,
      kind: row.kind,
      answers: row.answers as Record<string, "YES" | "NO">,
      completedAt: row.completedAt.toISOString(),
    };
  }

  private toOutOfHoursDto(row: {
    id: string;
    userId: string;
    contactedAt: Date;
    channel: OutOfHoursContactDto["channel"];
    reason: string;
    notifiedEmployee: boolean;
    createdAt: Date;
    user?: { name: string } | null;
  }): OutOfHoursContactDto {
    return {
      id: row.id,
      userId: row.userId,
      userName: row.user?.name ?? null,
      contactedAt: row.contactedAt.toISOString(),
      channel: row.channel,
      reason: row.reason,
      notifiedEmployee: row.notifiedEmployee,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getPolicy(tenantId: string) {
    const config = await this.settings.resolve(tenantId);
    return { ...config.policy, remotePunchEnabled: config.remotePunchEnabled };
  }

  updatePolicy(
    tenantId: string,
    actor: { id: string; name?: string | null },
    input: TeleworkPolicyUpdateInput
  ) {
    return this.settings.updatePolicy(tenantId, actor, input);
  }

  async listRegistrations(): Promise<TeleworkRegistrationDto[]> {
    const rows = await this.db.teleworkRegistration.findMany({
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      include: {
        user: { select: { name: true, email: true, employeeNumber: true } },
        checklists: { select: { kind: true, completedAt: true }, orderBy: { completedAt: "desc" } },
      },
    });
    return rows.map((row) => this.toRegistrationDto(row));
  }

  async register(
    input: TeleworkRegistrationInput,
    actor: { id: string; name?: string | null }
  ): Promise<TeleworkRegistrationDto> {
    const user = await this.db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, tenantId: true },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    if (!user.tenantId) throw new HttpError(400, "TENANT_REQUIRED");

    const existing = await this.db.teleworkRegistration.findUnique({
      where: { tenantId_userId: { tenantId: user.tenantId, userId: input.userId } },
    });
    if (existing?.status === "ACTIVE") throw new HttpError(409, "TELEWORK_ALREADY_REGISTERED");

    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    if (Number.isNaN(startedAt.getTime())) throw new HttpError(400, "INVALID_ADJUSTMENT_DATE");

    const row = existing
      ? await this.db.teleworkRegistration.update({
          where: { id: existing.id },
          data: {
            mode: input.mode ?? existing.mode,
            status: "ACTIVE",
            homeAddress: input.homeAddress ?? existing.homeAddress,
            notes: input.notes ?? existing.notes,
            startedAt,
            endedAt: null,
          },
          include: { user: { select: { name: true, email: true, employeeNumber: true } } },
        })
      : await this.db.teleworkRegistration.create({
          data: {
            userId: input.userId,
            mode: input.mode ?? "REMOTO",
            status: "ACTIVE",
            homeAddress: input.homeAddress ?? null,
            notes: input.notes ?? null,
            startedAt,
            createdById: actor.id,
          },
          include: { user: { select: { name: true, email: true, employeeNumber: true } } },
        });

    await this.audit?.({
      action: existing ? "TELEWORK_REACTIVATED" : "TELEWORK_REGISTERED",
      entityType: "TeleworkRegistration",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: existing ? { status: existing.status, endedAt: existing.endedAt?.toISOString() ?? null } : undefined,
      newState: { userId: row.userId, mode: row.mode, status: row.status, startedAt },
      metadata: { employeeName: user.name },
    });

    return this.toRegistrationDto(row);
  }

  async updateRegistration(
    id: string,
    input: TeleworkRegistrationUpdateInput,
    actor: { id: string; name?: string | null }
  ): Promise<TeleworkRegistrationDto> {
    const existing = await this.db.teleworkRegistration.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "TELEWORK_NOT_REGISTERED");

    const endedAt =
      input.status === "ENDED"
        ? input.endedAt
          ? new Date(input.endedAt)
          : new Date()
        : input.status === "ACTIVE"
          ? null
          : input.endedAt === undefined
            ? undefined
            : input.endedAt
              ? new Date(input.endedAt)
              : null;

    const row = await this.db.teleworkRegistration.update({
      where: { id },
      data: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.homeAddress !== undefined ? { homeAddress: input.homeAddress } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(endedAt !== undefined ? { endedAt } : {}),
      },
      include: { user: { select: { name: true, email: true, employeeNumber: true } } },
    });

    await this.audit?.({
      action: "TELEWORK_REGISTRATION_UPDATED",
      entityType: "TeleworkRegistration",
      entityId: id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      previousState: {
        mode: existing.mode,
        status: existing.status,
        homeAddress: existing.homeAddress,
        endedAt: existing.endedAt?.toISOString() ?? null,
      },
      newState: {
        mode: row.mode,
        status: row.status,
        homeAddress: row.homeAddress,
        endedAt: row.endedAt?.toISOString() ?? null,
      },
    });

    return this.toRegistrationDto(row);
  }

  async listChecklists(limit = 100): Promise<TeleworkChecklistDto[]> {
    const rows = await this.db.teleworkChecklist.findMany({
      orderBy: { completedAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    });
    return rows.map((row) => this.toChecklistDto(row));
  }

  /** Registro de comunicación fuera de jornada + aviso in-app al trabajador. */
  async registerOutOfHoursContact(
    input: OutOfHoursContactInput,
    actor: { id: string; name?: string | null }
  ): Promise<OutOfHoursContactDto> {
    const user = await this.db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, tenantId: true },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    if (!user.tenantId) throw new HttpError(400, "TENANT_REQUIRED");

    const contactedAt = input.contactedAt ? new Date(input.contactedAt) : new Date();
    if (Number.isNaN(contactedAt.getTime())) throw new HttpError(400, "INVALID_ADJUSTMENT_DATE");

    const row = await this.db.outOfHoursContact.create({
      data: {
        userId: input.userId,
        contactedAt,
        channel: input.channel,
        reason: input.reason,
        notifiedEmployee: true,
        createdById: actor.id,
      },
      include: { user: { select: { name: true } } },
    });

    const lng = await systemLanguage();
    const detail = t(
      "notifications.outOfHoursContactDetail",
      { date: formatDateTime(contactedAt, lng), channel: input.channel, reason: input.reason },
      lng
    );
    try {
      await this.notifications?.createNotification({
        userId: input.userId,
        type: "OUT_OF_HOURS_CONTACT",
        title: t("notifications.outOfHoursContact", {}, lng),
        detail,
      });
    } catch {
      await this.db.outOfHoursContact.update({
        where: { id: row.id },
        data: { notifiedEmployee: false },
      });
    }

    await this.audit?.({
      action: "OUT_OF_HOURS_CONTACT_RECORDED",
      entityType: "OutOfHoursContact",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: {
        employeeId: input.userId,
        contactedAt: contactedAt.toISOString(),
        channel: input.channel,
        reason: input.reason,
      },
      metadata: { employeeName: user.name },
    });

    return this.toOutOfHoursDto(row);
  }

  async listOutOfHoursContacts(limit = 100): Promise<OutOfHoursContactDto[]> {
    const rows = await this.db.outOfHoursContact.findMany({
      orderBy: { contactedAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    });
    return rows.map((row) => this.toOutOfHoursDto(row));
  }

  private async activeRegistrationOf(userId: string) {
    return this.db.teleworkRegistration.findFirst({
      where: { userId },
      include: {
        user: { select: { name: true, email: true, employeeNumber: true } },
        checklists: { select: { kind: true, completedAt: true }, orderBy: { completedAt: "desc" } },
      },
    });
  }

  /** Estado de teletrabajo del trabajador: registro, políticas, checklist y consentimiento. */
  async me(userId: string): Promise<MyTelework> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    if (!user?.tenantId) throw new HttpError(400, "TENANT_REQUIRED");

    const config = await this.settings.resolve(user.tenantId);
    const registration = await this.activeRegistrationOf(userId);
    const lastChecklist = registration?.checklists?.[0]
      ? await this.db.teleworkChecklist.findFirst({
          where: { userId },
          orderBy: { completedAt: "desc" },
          include: { user: { select: { name: true } } },
        })
      : null;

    const consentCurrent =
      !!registration?.consentAcceptedAt &&
      registration.consentPolicyVersion === config.policy.policyVersion &&
      registration.consentPrivacyVersion === config.policy.privacyNoticeVersion;

    return {
      registration: registration ? this.toRegistrationDto(registration) : null,
      policy: config.policy,
      remotePunchEnabled: config.remotePunchEnabled,
      remoteGeolocationEnabled: config.remoteGeolocationEnabled,
      checklistTemplate: this.checklistTemplate(),
      lastChecklist: lastChecklist ? this.toChecklistDto(lastChecklist) : null,
      nextPeriodicDueAt: registration
        ? this.toRegistrationDto(registration).nextPeriodicDueAt
        : null,
      consentCurrent,
      pendingConsent:
        !!registration &&
        registration.status === "ACTIVE" &&
        (!consentCurrent || !lastChecklist),
    };
  }

  /** El trabajador acepta política y aviso de privacidad vigentes (consentimiento). */
  async acceptPolicy(
    userId: string,
    versions: { policyVersion: number; privacyNoticeVersion: number },
    actor: { id: string; name?: string | null }
  ): Promise<TeleworkRegistrationDto> {
    const registration = await this.db.teleworkRegistration.findFirst({ where: { userId } });
    if (!registration || registration.status !== "ACTIVE") {
      throw new HttpError(404, "TELEWORK_NOT_REGISTERED");
    }
    const config = await this.settings.resolve(registration.tenantId);
    if (
      versions.policyVersion !== config.policy.policyVersion ||
      versions.privacyNoticeVersion !== config.policy.privacyNoticeVersion
    ) {
      throw new HttpError(409, "TELEWORK_POLICY_VERSION_CHANGED");
    }

    const row = await this.db.teleworkRegistration.update({
      where: { id: registration.id },
      data: {
        consentAcceptedAt: new Date(),
        consentPolicyVersion: versions.policyVersion,
        consentPrivacyVersion: versions.privacyNoticeVersion,
      },
      include: { user: { select: { name: true, email: true, employeeNumber: true } } },
    });

    await this.audit?.({
      action: "TELEWORK_CONSENT_ACCEPTED",
      entityType: "TeleworkRegistration",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: {
        policyVersion: versions.policyVersion,
        privacyNoticeVersion: versions.privacyNoticeVersion,
        acceptedAt: row.consentAcceptedAt?.toISOString() ?? null,
      },
    });

    return this.toRegistrationDto(row);
  }

  /** Checklist inicial/periódico del lugar de teletrabajo (validado contra plantilla). */
  async submitChecklist(
    userId: string,
    input: { kind?: TeleworkChecklistKind; answers: Record<string, "YES" | "NO"> },
    actor: { id: string; name?: string | null }
  ): Promise<TeleworkChecklistDto> {
    const registration = await this.db.teleworkRegistration.findFirst({ where: { userId } });
    if (!registration || registration.status !== "ACTIVE") {
      throw new HttpError(404, "TELEWORK_NOT_REGISTERED");
    }
    if (!registration.consentAcceptedAt) throw new HttpError(409, "TELEWORK_CONSENT_REQUIRED");

    const missing = TELEWORK_CHECKLIST_ITEMS.filter((key) => input.answers[key] === undefined);
    const unknown = Object.keys(input.answers).filter(
      (key) => !(TELEWORK_CHECKLIST_ITEMS as readonly string[]).includes(key)
    );
    if (missing.length > 0 || unknown.length > 0) throw new HttpError(400, "TELEWORK_CHECKLIST_INCOMPLETE");

    const existing = await this.db.teleworkChecklist.findFirst({
      where: { userId },
      orderBy: { completedAt: "desc" },
    });
    const kind: TeleworkChecklistKind = input.kind ?? (existing ? "PERIODIC" : "INITIAL");

    const row = await this.db.teleworkChecklist.create({
      data: {
        registrationId: registration.id,
        userId,
        kind,
        answers: input.answers,
        createdById: actor.id,
      },
      include: { user: { select: { name: true } } },
    });

    await this.audit?.({
      action: "TELEWORK_CHECKLIST_COMPLETED",
      entityType: "TeleworkChecklist",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: { kind, answers: input.answers, completedAt: row.completedAt.toISOString() },
      metadata: { employeeId: userId, registrationId: registration.id },
    });

    return this.toChecklistDto(row);
  }
}
