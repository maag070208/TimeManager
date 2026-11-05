import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { RemotePunchDto, RemotePunchInput } from "../models/entity/nom.entity";
import type { NomSettingsService } from "./nom-settings.service";

type Row = Prisma.RemotePunchGetPayload<Record<string, never>>;

/**
 * Marcaje remoto (F2-07): inicio/fin de jornada desde la web/app, sin reloj,
 * para home office o campo.
 *
 * - `occurredAt` es la hora del SERVIDOR (autoritativa); `clientReportedAt` se
 *   guarda solo como auditoría de reintentos offline.
 * - Idempotente por `clientEventId`: un reintento de red devuelve el marcaje ya
 *   creado (`created: false`) en lugar de duplicarlo.
 * - La geolocalización es OPCIONAL y se guarda únicamente en el registro del
 *   marcaje: **no hay rastreo continuo** (la ubicación no se consulta fuera de
 *   ese instante).
 * - El registro es append-only (trigger de BD); las correcciones van por el
 *   flujo de discrepancia/ajuste del trabajador.
 */
export class RemotePunchService {
  constructor(
    private readonly db: PrismaClient = prismaClient,
    private readonly settings: NomSettingsService,
    private readonly audit?: AuditLogger
  ) {}

  private toDto(row: Row): RemotePunchDto {
    return {
      id: row.id,
      type: row.type,
      workMode: row.workMode,
      occurredAt: row.occurredAt.toISOString(),
      clientReportedAt: row.clientReportedAt?.toISOString() ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async record(
    userId: string,
    input: RemotePunchInput,
    actor: { id: string; name?: string | null }
  ): Promise<{ punch: RemotePunchDto; created: boolean }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, tenantId: true },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    if (!user.tenantId) throw new HttpError(400, "TENANT_REQUIRED");

    const config = await this.settings.resolve(user.tenantId);
    if (!config.remotePunchEnabled) throw new HttpError(403, "REMOTE_PUNCH_DISABLED");

    const hasLat = input.latitude !== undefined;
    const hasLng = input.longitude !== undefined;
    if (hasLat !== hasLng) throw new HttpError(400, "INVALID_GEO_POINT");

    if (input.clientEventId) {
      const existing = await this.db.remotePunch.findUnique({
        where: { clientEventId: input.clientEventId },
      });
      if (existing) return { punch: this.toDto(existing), created: false };
    }

    // Secuencia: no dos entradas o dos salidas seguidas (contra el último remoto).
    const last = await this.db.remotePunch.findFirst({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    });
    if (last && last.type === input.type) {
      throw new HttpError(409, "INVALID_PUNCH_SEQUENCE", { type: input.type });
    }

    const clientReportedAt = input.clientReportedAt ? new Date(input.clientReportedAt) : null;
    if (clientReportedAt && Number.isNaN(clientReportedAt.getTime())) {
      throw new HttpError(400, "INVALID_ADJUSTMENT_DATE");
    }

    let row: Row;
    try {
      row = await this.db.remotePunch.create({
        data: {
          userId,
          type: input.type,
          workMode: input.workMode ?? "REMOTO",
          occurredAt: new Date(),
          clientReportedAt,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          gpsAccuracyMeters: input.gpsAccuracyMeters ?? null,
          note: input.note ?? null,
          clientEventId: input.clientEventId ?? null,
        },
      });
    } catch (error) {
      // Carrera entre reintentos con el mismo clientEventId.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        input.clientEventId
      ) {
        const existing = await this.db.remotePunch.findUnique({
          where: { clientEventId: input.clientEventId },
        });
        if (existing) return { punch: this.toDto(existing), created: false };
      }
      throw error;
    }

    await this.audit?.({
      action: "REMOTE_PUNCH_RECORDED",
      entityType: "RemotePunch",
      entityId: row.id,
      userId: actor.id,
      userName: actor.name ?? undefined,
      newState: {
        type: row.type,
        workMode: row.workMode,
        occurredAt: row.occurredAt.toISOString(),
        hasGeolocation: row.latitude !== null,
      },
      metadata: {
        employeeId: userId,
        clientEventId: input.clientEventId ?? null,
        note: input.note ?? null,
      },
    });

    return { punch: this.toDto(row), created: true };
  }
}
