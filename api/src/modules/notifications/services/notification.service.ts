import { prismaClient } from "@core/config/database";
import { env } from "@core/config/env.config";
import { broadcastToUser } from "@core/services/ably";
import { systemLanguage, t } from "@core/i18n";
import { enqueueEmail } from "@core/services/email-queue";
import { rosterAlertEmail, workdayLimitEmail } from "@core/services/email-templates";
import { createNotificationTokenRequest } from "./ably-token.service";
import { resolveTeleworkDeferral } from "./telework-deferral";
import type {
  CreateNotificationInput,
  NotifyWorkdayLimitInput,
  NotifyDocumentUploadedInput,
  NotifyRecipientSummary,
  NotifyRosterAlertInput,
  NotifyUserCreatedInput,
  NotifyUserDeactivatedInput,
  NotificationPort,
} from "../models/entity/notification.entity";

const ADMIN_HR_ROLES = ["CLIENT_ADMIN", "HUMAN_RESOURCES"] as const;

export class NotificationService implements NotificationPort {
  constructor(private readonly db = prismaClient) {}

  async createNotification(input: CreateNotificationInput) {
    const deferredUntil = await resolveTeleworkDeferral(this.db, input.userId);
    return this.db.notification.create({
      data: { ...input, ...(deferredUntil ? { deferredUntil } : {}) },
    });
  }

  /**
   * TokenRequest de Ably para el navegador del usuario: `clientId` propio y
   * capability de suscripción solo a `user:<id>`. La app key nunca sale del API.
   */
  createAblyTokenRequest(userId: string) {
    return createNotificationTokenRequest(userId, env.ABLY_API_KEY);
  }

  async createManyNotifications(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return;
    const userIds = [...new Set(inputs.map((input) => input.userId))];
    const deferrals = new Map<string, Date>();
    for (const userId of userIds) {
      const deferredUntil = await resolveTeleworkDeferral(this.db, userId);
      if (deferredUntil) deferrals.set(userId, deferredUntil);
    }
    return this.db.notification.createMany({
      data: inputs.map((input) => {
        const deferredUntil = deferrals.get(input.userId);
        return { ...input, ...(deferredUntil ? { deferredUntil } : {}) };
      }),
    });
  }

  /** Condición para mostrar solo lo que ya se puede entregar (desconexión). */
  private visibleNow() {
    return {
      OR: [{ deferredUntil: null }, { deferredUntil: { lte: new Date() } }],
    };
  }

  listNotifications(userId: string, unreadOnly = false) {
    return this.db.notification.findMany({
      where: {
        userId,
        ...this.visibleNow(),
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    return this.db.notification.count({
      where: { userId, read: false, ...this.visibleNow() },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.db.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(id: string, userId: string) {
    return this.db.notification.deleteMany({ where: { id, userId } });
  }

  /** El ticket se levantó a nombre del usuario (lo pidió por teléfono). */
  /**
   * Devuelve los destinatarios con rol ADMIN o RECURSOS_HUMANOS, activos, con
   * email. Excluye al actor para evitar auto-notificarse. Sin cache (R7): se
   * resuelve en cada evento; el volumen es chico y simplifica el manejo de
   * altas/bajas concurrentes.
   */
  private async resolveAdminHrRecipients(
    actorId: string
  ): Promise<{ id: string; email: string; name: string }[]> {
    const recipients = await this.db.user.findMany({
      where: {
        role: { in: [...ADMIN_HR_ROLES] },
        active: true,
        email: { not: null },
        NOT: { id: actorId },
      },
      select: { id: true, email: true, name: true },
    });
    return recipients.filter((r): r is { id: string; email: string; name: string } => !!r.email);
  }

  async notifyUserCreated(input: NotifyUserCreatedInput): Promise<NotifyRecipientSummary> {
    const recipients = await this.resolveAdminHrRecipients(input.actorId);
    if (recipients.length === 0) {
      return { count: 0, recipientIds: [] };
    }

    const actor = await this.db.user.findUnique({
      where: { id: input.actorId },
      select: { name: true },
    });
    const lng = await systemLanguage();
    const actorName = actor?.name ?? t("labels.administrator", {}, lng);

    const userEmail = input.userEmail ?? t("labels.noEmail", {}, lng);

    const notifications: CreateNotificationInput[] = recipients.map((r) => ({
      userId: r.id,
      type: "USER_CREATED",
      title: t("notifications.userCreated", { name: input.userName }, lng),
      detail: t("notifications.userCreatedDetail", { email: userEmail, actor: actorName }, lng),
    }));

    await this.createManyNotifications(notifications);

    for (const n of notifications) {
      broadcastToUser(n.userId, {
        type: n.type,
        title: n.title,
        detail: n.detail,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return { count: notifications.length, recipientIds: recipients.map((r) => r.id) };
  }

  async notifyUserDeactivated(
    input: NotifyUserDeactivatedInput
  ): Promise<NotifyRecipientSummary> {
    const recipients = await this.resolveAdminHrRecipients(input.actorId);
    if (recipients.length === 0) {
      return { count: 0, recipientIds: [] };
    }

    const actor = await this.db.user.findUnique({
      where: { id: input.actorId },
      select: { name: true },
    });
    const lng = await systemLanguage();
    const actorName = actor?.name ?? t("labels.administrator", {}, lng);

    const notifications: CreateNotificationInput[] = recipients.map((r) => ({
      userId: r.id,
      type: "USER_DEACTIVATED",
      title: t("notifications.userDeactivated", { name: input.userName }, lng),
      detail: t("notifications.userDeactivatedDetail", { reason: input.reason, actor: actorName }, lng),
    }));

    await this.createManyNotifications(notifications);

    for (const n of notifications) {
      broadcastToUser(n.userId, {
        type: n.type,
        title: n.title,
        detail: n.detail,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return { count: notifications.length, recipientIds: recipients.map((r) => r.id) };
  }

  /**
   * Aviso a RH del padrón del reloj: campanita para cada admin/HR y correo a
   * su dirección. Solo se llama cuando hay bajas pendientes, reapariciones o una
   * corrida sospechosa.
   */
  async notifyRosterAlert(input: NotifyRosterAlertInput): Promise<NotifyRecipientSummary> {
    const recipients = await this.resolveAdminHrRecipients("");
    if (recipients.length === 0) {
      return { count: 0, recipientIds: [] };
    }
    const lng = await systemLanguage();
    const vars = { pending: input.pending, reappeared: input.reappeared };
    const title = t(
      input.suspicious ? "notifications.rosterAlertSuspicious" : "notifications.rosterAlert",
      vars,
      lng
    );
    const detail = t("notifications.rosterAlertDetail", {}, lng);

    await this.createManyNotifications(
      recipients.map((r) => ({ userId: r.id, type: "TIME_CLOCK_ROSTER", title, detail }))
    );
    for (const r of recipients) {
      broadcastToUser(r.id, {
        type: "TIME_CLOCK_ROSTER",
        title,
        detail,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
      const { subject, html } = rosterAlertEmail({ language: lng, ...input });
      void enqueueEmail({
        to: r.email,
        subject,
        html,
        action: "time_clock.roster",
        entityType: "TimeClockRosterRun",
      });
    }
    return { count: recipients.length, recipientIds: recipients.map((r) => r.id) };
  }

  /**
   * Aviso a RH de límite de jornada excedido (F2-03): campanita + correo por
   * la cola. Se ejecuta dentro del tenant del empleado (el worker lo hace con
   * `runWithTenant`), así que los destinatarios son los ADMIN/HR de ese cliente.
   */
  async notifyWorkdayLimit(input: NotifyWorkdayLimitInput): Promise<NotifyRecipientSummary> {
    const recipients = await this.resolveAdminHrRecipients("");
    if (recipients.length === 0) return { count: 0, recipientIds: [] };

    const lng = await systemLanguage();
    const hours = (minutes: number) => (minutes / 60).toFixed(1).replace(/\.0$/, "");
    const vars = {
      name: input.employeeName,
      date: input.date,
      worked: hours(input.workedMinutes),
      limit: hours(input.limitMinutes),
      scope: t(input.scope === "day" ? "emails.workdayLimit.scopeDay" : "emails.workdayLimit.scopeWeek", {}, lng),
    };
    const title = t("notifications.workdayLimit", vars, lng);
    const detail = t("notifications.workdayLimitDetail", vars, lng);

    await this.createManyNotifications(
      recipients.map((r) => ({ userId: r.id, type: "WORKDAY_LIMIT", title, detail }))
    );
    for (const r of recipients) {
      broadcastToUser(r.id, {
        type: "WORKDAY_LIMIT",
        title,
        detail,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
      const { subject, html } = workdayLimitEmail({ language: lng, ...input });
      void enqueueEmail({
        to: r.email,
        subject,
        html,
        action: "nom.workday_limit",
        entityType: "WorkdayLimitAlert",
      });
    }
    return { count: recipients.length, recipientIds: recipients.map((r) => r.id) };
  }

  async notifyDocumentUploaded(
    input: NotifyDocumentUploadedInput
  ): Promise<NotifyRecipientSummary> {
    const recipients = await this.resolveAdminHrRecipients(input.actorId);
    if (recipients.length === 0) {
      return { count: 0, recipientIds: [] };
    }

    const actor = await this.db.user.findUnique({
      where: { id: input.actorId },
      select: { name: true },
    });
    const lng = await systemLanguage();
    const actorName = actor?.name ?? t("labels.administrator", {}, lng);

    const notifications: CreateNotificationInput[] = recipients.map((r) => ({
      userId: r.id,
      type: "EMPLOYEE_DOC_UPLOADED",
      title: t("notifications.documentUploaded", { name: input.userName }, lng),
      detail: t(
        "notifications.documentUploadedDetail",
        { type: input.typeName, document: input.documentName, actor: actorName },
        lng
      ),
    }));

    await this.createManyNotifications(notifications);

    for (const n of notifications) {
      broadcastToUser(n.userId, {
        type: n.type,
        title: n.title,
        detail: n.detail,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return { count: notifications.length, recipientIds: recipients.map((r) => r.id) };
  }
}