import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { tenantTransaction } from "@core/tenancy";
import { localDateKey } from "@core/utils/timezone";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { RemotePunchDto, RemotePunchInput } from "../models/entity/nom.entity";
import { assertPunchSequence } from "./punch-sequence";
import type { NomSettingsService } from "./nom-settings.service";

type Row = Prisma.RemotePunchGetPayload<Record<string, never>>;

/**
 * Marcaje remoto (F2-07): inicio/fin de jornada desde la web/app, sin reloj,
 * para home office o campo.
 *
 * - `occurredAt` es la hora del SERVIDOR (autoritativa); `clientReportedAt` se
 *   guarda solo como auditoría de reintentos offline.
 * - Idempotente por `clientEventId` (obligatorio): un reintento de red devuelve
 *   el marcaje ya creado (`created: false`) en lugar de duplicarlo.
 * - La secuencia del día y el insert van en una transacción con un lock por
 *   usuario (`pg_advisory_xact_lock`): dos checadas simultáneas de la misma
 *   persona se serializan y no leen el mismo estado anterior.
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
      select: { id: true, name: true, tenantId: true, checkinMode: true, tenant: { select: { timezone: true } } },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    if (!user.tenantId) throw new HttpError(400, "TENANT_REQUIRED");

    if (user.checkinMode === "CLOCK") {
      throw new HttpError(403, "REMOTE_PUNCH_NOT_ALLOWED");
    }
    const config = await this.settings.resolve(user.tenantId);
    if (!config.remotePunchEnabled) throw new HttpError(403, "REMOTE_PUNCH_DISABLED");

    // D-4: si el cliente lo exige, no hay checada web sin acuerdo de método
    // aceptado que incluya REMOTE (prueba de dos partes; la firma patronal se
    // valida aparte cuando el cliente la exige).
    if (config.blockRemoteWithoutAgreement) {
      const agreement = await this.db.workRecordAgreement.findUnique({
        where: { userId: user.id },
        select: { methods: true, acceptedAt: true },
      });
      const methods = Array.isArray(agreement?.methods) ? (agreement.methods as string[]) : [];
      if (!agreement?.acceptedAt || !methods.includes("REMOTE")) {
        throw new HttpError(403, "REMOTE_AGREEMENT_REQUIRED");
      }
    }

    // NOM-037 5.4/5.5: si la Comisión validó el lugar como NO_APTO, no se
    // permite marcar desde ese lugar.
    const registration = await this.db.teleworkRegistration.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (registration) {
      const lastValidation = await this.db.teleworkChecklist.findFirst({
        where: { userId: user.id, validatedAt: { not: null } },
        orderBy: { validatedAt: "desc" },
        select: { result: true },
      });
      if (lastValidation?.result === "NO_APTO") {
        throw new HttpError(403, "TELEWORK_WORKPLACE_NOT_APPROVED");
      }
    }

    const hasLat = input.latitude !== undefined;
    const hasLng = input.longitude !== undefined;
    if (hasLat !== hasLng) throw new HttpError(400, "INVALID_GEO_POINT");

    const clientReportedAt = input.clientReportedAt ? new Date(input.clientReportedAt) : null;
    if (clientReportedAt && Number.isNaN(clientReportedAt.getTime())) {
      throw new HttpError(400, "INVALID_ADJUSTMENT_DATE");
    }

    const timezone = user.tenant?.timezone ?? "America/Mexico_City";
    const { row, created } = await this.insertSerialized(userId, input, timezone, clientReportedAt);

    if (created) {
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
          clientEventId: input.clientEventId,
          note: input.note ?? null,
        },
      });
    }

    return { punch: this.toDto(row), created };
  }

  /**
   * Idempotencia + secuencia + inserción, serializadas por usuario.
   *
   * `pg_advisory_xact_lock` sobre el usuario hace que dos checadas simultáneas
   * del mismo trabajador no lean el mismo estado anterior: la segunda espera al
   * COMMIT de la primera y ve su fila. El lock se libera solo al cerrar la
   * transacción (COMMIT o ROLLBACK), así que no hay fuga si algo falla.
   */
  private async insertSerialized(
    userId: string,
    input: RemotePunchInput,
    timezone: string,
    clientReportedAt: Date | null
  ): Promise<{ row: Row; created: boolean }> {
    try {
      return await tenantTransaction(this.db, async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          userId
        );

        // El id lo genera el cliente: uno ajeno no devuelve la checada de otra persona.
        const existing = await tx.remotePunch.findUnique({
          where: { clientEventId: input.clientEventId },
        });
        if (existing && existing.userId !== userId) throw new HttpError(409, "CLIENT_EVENT_ID_TAKEN");
        if (existing) return { row: existing, created: false };

        // Secuencia del día: entrada → (comida → regreso) → salida, una sola vez.
        // Tras la salida el día queda cerrado. Al cambiar de día la secuencia
        // arranca de nuevo, aunque ayer no se haya marcado salida.
        const last = await tx.remotePunch.findFirst({
          where: { userId },
          orderBy: { occurredAt: "desc" },
        });
        const lastIsToday = last ? localDateKey(last.occurredAt, timezone) === localDateKey(new Date(), timezone) : false;
        assertPunchSequence(input.type, last?.type ?? null, lastIsToday);

        const row = await tx.remotePunch.create({
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
            clientEventId: input.clientEventId,
          },
        });
        return { row, created: true };
      });
    } catch (error) {
      // El índice único de clientEventId es global: un id usado en otro cliente
      // choca antes de que el lookup lo vea. Mismo desenlace que antes.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.db.remotePunch.findUnique({
          where: { clientEventId: input.clientEventId },
        });
        if (existing && existing.userId !== userId) throw new HttpError(409, "CLIENT_EVENT_ID_TAKEN");
        if (existing) return { row: existing, created: false };
        // El id ya existe pero la fila no es visible (otro cliente con RLS):
        // el único `clientEventId` de la tabla es global, así que es un id ajeno.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "CLIENT_EVENT_ID_TAKEN");
        }
      }
      throw error;
    }
  }
}
