import { Prisma, type PrismaClient } from "@prisma/client";
import { openLocation, sealLocation } from "./punch-location";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { tenantTransaction } from "@core/tenancy";
import { tenantPunchChannels } from "@core/utils/tenant-punch-channels";
import { localDateKey, localDayRange } from "@core/utils/timezone";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { RemotePunchDto, RemotePunchInput } from "../models/entity/nom.entity";
import type { RemotePunchSource } from "@prisma/client";
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
    const location = openLocation(row);
    return {
      id: row.id,
      type: row.type,
      source: row.source,
      workMode: row.workMode,
      occurredAt: row.occurredAt.toISOString(),
      clientReportedAt: row.clientReportedAt?.toISOString() ?? null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async record(
    userId: string,
    input: RemotePunchInput,
    actor: { id: string; name?: string | null },
    source: RemotePunchSource = "WEB"
  ): Promise<{ punch: RemotePunchDto; created: boolean }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, tenantId: true, tenant: { select: { timezone: true } } },
    });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND");
    if (!user.tenantId) throw new HttpError(400, "TENANT_REQUIRED");

    // Las lecturas previas son independientes: un solo viaje en paralelo.
    const [channels, config, agreement, registration, lastValidation] = await Promise.all([
      tenantPunchChannels(user.tenantId),
      this.settings.resolve(user.tenantId),
      this.db.workRecordAgreement.findUnique({
        where: { userId: user.id },
        select: { methods: true, acceptedAt: true },
      }),
      this.db.teleworkRegistration.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        select: { id: true, mode: true },
      }),
      this.db.teleworkChecklist.findFirst({
        where: { userId: user.id, validatedAt: { not: null } },
        orderBy: { validatedAt: "desc" },
        select: { result: true },
      }),
    ]);

    // Canal habilitado por el cliente (WEB/APP). El reloj no pasa por aquí.
    if (!channels.includes(source)) {
      throw new HttpError(403, "PUNCH_CHANNEL_DISABLED");
    }
    if (!config.remotePunchEnabled) throw new HttpError(403, "REMOTE_PUNCH_DISABLED");
    // Ubicación apagada por el cliente: se descarta aunque el dispositivo la mande.
    if (!config.remoteGeolocationEnabled) {
      input = { ...input, latitude: undefined, longitude: undefined, gpsAccuracyMeters: undefined };
    }

    // D-4: si el cliente lo exige, no hay checada web sin acuerdo de método
    // aceptado que incluya REMOTE (prueba de dos partes; la firma patronal se
    // valida aparte cuando el cliente la exige).
    if (config.blockRemoteWithoutAgreement) {
      const methods = Array.isArray(agreement?.methods) ? (agreement.methods as string[]) : [];
      if (!agreement?.acceptedAt || !methods.includes("REMOTE")) {
        throw new HttpError(403, "REMOTE_AGREEMENT_REQUIRED");
      }
    }

    // La modalidad la define el registro de teletrabajo de RH, no cada marcaje;
    // sin registro la checada web se asienta como remota. Un cliente que la
    // mande explícita (app móvil anterior) se respeta.
    input = { ...input, workMode: input.workMode ?? registration?.mode };
    // NOM-037 5.4/5.5: si la Comisión validó el lugar como NO_APTO, no se
    // permite marcar desde ese lugar.
    if (registration && lastValidation?.result === "NO_APTO") {
      throw new HttpError(403, "TELEWORK_WORKPLACE_NOT_APPROVED");
    }

    const hasLat = input.latitude !== undefined;
    const hasLng = input.longitude !== undefined;
    if (hasLat !== hasLng) throw new HttpError(400, "INVALID_GEO_POINT");

    const clientReportedAt = input.clientReportedAt ? new Date(input.clientReportedAt) : null;
    if (clientReportedAt && Number.isNaN(clientReportedAt.getTime())) {
      throw new HttpError(400, "INVALID_ADJUSTMENT_DATE");
    }

    const timezone = user.tenant?.timezone ?? "America/Mexico_City";
    const { row, created } = await this.insertSerialized(userId, input, timezone, clientReportedAt, config.lunchPunchEnabled, source);

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
          hasGeolocation: row.location !== null,
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

  /** ¿La persona ya checó hoy en el reloj? (sus números vinculados en `time_clock_employees`). */
  private async hasClockPunchesToday(
    tx: Prisma.TransactionClient,
    userId: string,
    timezone: string
  ): Promise<boolean> {
    const links = await tx.timeClockEmployee.findMany({
      where: { userId },
      select: { employeeNumber: true },
    });
    if (links.length === 0) return false;
    const { start, end } = localDayRange(localDateKey(new Date(), timezone), timezone);
    const punch = await tx.timeClockPunch.findFirst({
      where: {
        employeeNumber: { in: links.map((link) => link.employeeNumber) },
        method: { not: "OTHER" },
        occurredAt: { gte: start, lt: end },
      },
      select: { id: true },
    });
    return punch !== null;
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
    clientReportedAt: Date | null,
    lunchEnabled: boolean,
    source: RemotePunchSource
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

        // Mix de canales (reloj + web/app): si hoy la persona ya tiene checadas
        // del reloj, la secuencia remota NO manda. La checada del reloj no dice
        // si fue entrada o salida, así que la web/app no puede adivinar el paso
        // que toca y bloquearla la dejaría sin poder cerrar el día. Se conservan
        // la idempotencia, el canal habilitado, la geolocalización y los candados
        // de acuerdo/teletrabajo; solo se omite la secuencia.
        if (!(await this.hasClockPunchesToday(tx, userId, timezone))) {
          // Secuencia del día: entrada → (comida → regreso) → salida, una sola vez.
          // Tras la salida el día queda cerrado. Al cambiar de día la secuencia
          // arranca de nuevo, aunque ayer no se haya marcado salida.
          const last = await tx.remotePunch.findFirst({
            where: { userId },
            orderBy: { occurredAt: "desc" },
          });
          const lastIsToday = last ? localDateKey(last.occurredAt, timezone) === localDateKey(new Date(), timezone) : false;
          assertPunchSequence(input.type, last?.type ?? null, lastIsToday, lunchEnabled);
        }

        const row = await tx.remotePunch.create({
          data: {
            userId,
            type: input.type,
            source,
            workMode: input.workMode ?? "REMOTO",
            occurredAt: new Date(),
            clientReportedAt,
            location: sealLocation(input),
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
