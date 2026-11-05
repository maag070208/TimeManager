import type { Request, Response } from "express";
import type { PunchAdjustmentStatus, WorkdayAlertScope } from "@prisma/client";
import { HttpError } from "@core/middlewares/error.middleware";
import { currentTenantId } from "@core/tenancy";
import { isReportPeriod } from "@core/utils/timezone";
import {
  AdjustmentCreateDto,
  AdjustmentDecisionDto,
  AlertScanDto,
  ArchiveDto,
  DiscrepancyCreateDto,
  NomSettingsUpdateDto,
  OutOfHoursContactDto,
  PunchQueryDto,
  RemotePunchDto,
  TeleworkAcceptDto,
  TeleworkChecklistDto,
  TeleworkPolicyDto,
  TeleworkRegistrationDto,
  TeleworkRegistrationUpdateDto,
} from "../models/dto/nom.dto";
import type { NomSettingsService } from "../services/nom-settings.service";
import type { PunchAdjustmentsService } from "../services/punch-adjustments.service";
import type { WorkdayAlertsService } from "../services/workday-alerts.service";
import type { RetentionService } from "../services/retention.service";
import type { StpsExportService } from "../services/stps-export.service";
import type { RemotePunchService } from "../services/remote-punch.service";
import type { TeleworkService } from "../services/telework.service";
import type { WeeklyOvertimeService } from "../services/weekly-overtime.service";
import type { HolidayService } from "../services/holiday.service";
import type { WorkRecordService } from "../services/work-record.service";

const tenantIdOrThrow = (): string => {
  const tenantId = currentTenantId();
  if (!tenantId) throw new HttpError(400, "TENANT_REQUIRED");
  return tenantId;
};

const actorOf = (req: Request): { id: string; name: string } => ({
  id: req.user!.id,
  name: req.user!.username,
});

/** Endpoints NOM: configuración, ajustes de checadas, alertas, retención y export. */
export class NomController {
  constructor(
    private readonly settings: NomSettingsService,
    private readonly adjustments: PunchAdjustmentsService,
    private readonly alerts: WorkdayAlertsService,
    private readonly retention: RetentionService,
    private readonly exporter: StpsExportService,
    private readonly remotePunches: RemotePunchService,
    private readonly telework: TeleworkService,
    private readonly weeklyOvertime: WeeklyOvertimeService,
    private readonly holidays: HolidayService,
    private readonly record: WorkRecordService
  ) {}

  getConfig = async (_req: Request, res: Response) => {
    res.json(await this.settings.resolve(tenantIdOrThrow()));
  };

  updateConfig = async (req: Request, res: Response) => {
    const input = NomSettingsUpdateDto.parse(req.body);
    res.json(await this.settings.update(tenantIdOrThrow(), actorOf(req), input));
  };

  createAdjustment = async (req: Request, res: Response) => {
    const input = AdjustmentCreateDto.parse(req.body);
    const data = await this.adjustments.create(req.params.punchId, input, actorOf(req));
    res.status(201).json(data);
  };

  punchHistory = async (req: Request, res: Response) => {
    res.json(await this.adjustments.history(req.params.punchId));
  };

  listAdjustments = async (req: Request, res: Response) => {
    const status: PunchAdjustmentStatus | undefined =
      req.query.status === "PENDING" || req.query.status === "APPROVED" || req.query.status === "REJECTED"
        ? req.query.status
        : undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await this.adjustments.list({ status, limit }));
  };

  decide = (decision: "APPROVE" | "REJECT") => async (req: Request, res: Response) => {
    const input = AdjustmentDecisionDto.parse(req.body ?? {});
    res.json(await this.adjustments.decide(req.params.id, decision, input.note, actorOf(req)));
  };

  listAlerts = async (req: Request, res: Response) => {
    const scope: WorkdayAlertScope | undefined =
      req.query.scope === "DAY" || req.query.scope === "WEEK" ? req.query.scope : undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await this.alerts.list({ scope, limit }));
  };

  scanAlerts = async (req: Request, res: Response) => {
    const input = AlertScanDto.parse(req.body ?? {});
    res.json(await this.alerts.scan(tenantIdOrThrow(), input));
  };




  myRecordAgreement = async (req: Request, res: Response) => {
    res.json(await this.record.agreementFor(req.user!.id));
  };

  acceptRecordAgreement = async (req: Request, res: Response) => {
    res.json(
      await this.record.acceptAgreement(
        tenantIdOrThrow(),
        req.user!.id,
        {
          methods: req.body?.methods,
          roundingPolicy: req.body?.roundingPolicy ?? null,
          correctionRules: req.body?.correctionRules ?? null,
        },
        { ...actorOf(req), ip: req.ip ?? null }
      )
    );
  };

  myAcknowledgments = async (req: Request, res: Response) => {
    res.json(await this.record.myAcknowledgments(req.user!.id));
  };

  acknowledgeRecord = async (req: Request, res: Response) => {
    res.status(201).json(
      await this.record.acknowledge(
        tenantIdOrThrow(),
        req.user!.id,
        {
          periodStart: String(req.body?.periodStart ?? ""),
          periodEnd: String(req.body?.periodEnd ?? ""),
          accept: req.body?.accept !== false,
          note: typeof req.body?.note === "string" ? req.body.note : null,
        },
        { ...actorOf(req), ip: req.ip ?? null }
      )
    );
  };

  listRecordAgreements = async (_req: Request, res: Response) => {
    res.json(await this.record.listAgreements(tenantIdOrThrow()));
  };

  listRecordAcknowledgments = async (_req: Request, res: Response) => {
    res.json(await this.record.listAcknowledgments(tenantIdOrThrow()));
  };

  listHolidays = async (req: Request, res: Response) => {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new HttpError(400, "INVALID_REPORT_DATE");
    }
    res.json(await this.holidays.list(tenantIdOrThrow(), year));
  };

  createHoliday = async (req: Request, res: Response) => {
    const date = typeof req.body?.date === "string" ? req.body.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "INVALID_REPORT_DATE");
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 3) throw new HttpError(400, "INVALID_HOLIDAY_NAME");
    const kind = req.body?.kind === "OBLIGATORIO" ? "OBLIGATORIO" : "CONVENIO";
    res.status(201).json(await this.holidays.create(tenantIdOrThrow(), { date, name, kind }, actorOf(req)));
  };

  deleteHoliday = async (req: Request, res: Response) => {
    res.json(await this.holidays.remove(tenantIdOrThrow(), req.params.id, actorOf(req)));
  };

  listWeeklyOvertime = async (req: Request, res: Response) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, "INVALID_REPORT_DATE");
    }
    res.json(await this.weeklyOvertime.computeWeek(tenantIdOrThrow(), date));
  };

  recalculateWeeklyOvertime = async (req: Request, res: Response) => {
    const date = typeof req.body?.date === "string" ? req.body.date : undefined;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, "INVALID_REPORT_DATE");
    }
    res.json(await this.weeklyOvertime.computeWeek(tenantIdOrThrow(), date));
  };

  confirmWeeklyOvertime = async (req: Request, res: Response) => {
    res.json(await this.weeklyOvertime.confirm(tenantIdOrThrow(), req.params.id, actorOf(req)));
  };

  getRetention = async (_req: Request, res: Response) => {
    res.json(await this.retention.config(tenantIdOrThrow()));
  };

  archive = async (req: Request, res: Response) => {
    const input = ArchiveDto.parse(req.body ?? {});
    const contextTenant = tenantIdOrThrow();
    // Solo el personal de plataforma puede archivar un cliente distinto al del contexto.
    const tenantId = input.tenantId ?? contextTenant;
    if (tenantId !== contextTenant && req.user!.tenantId !== null) {
      throw new HttpError(403, "FORBIDDEN");
    }
    const result = await this.retention.archiveTenant(tenantId, { dryRun: input.dryRun });
    if (!result) throw new HttpError(400, "INVALID_RETENTION_MONTHS", { min: 1, max: 120 });
    res.json(result);
  };

  exportStps = async (req: Request, res: Response) => {
    const period = String(req.query.period ?? "MONTH").toUpperCase();
    if (!isReportPeriod(period)) throw new HttpError(400, "INVALID_REPORT_PERIOD");
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    if (!date) throw new HttpError(400, "INVALID_REPORT_DATE");
    const format = req.query.format === "json" ? "json" : "csv";
    const result = await this.exporter.export(tenantIdOrThrow(), {
      period,
      date,
      format,
      actorId: req.user!.id,
    });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("X-Content-SHA256", result.sha256);
    res.send(result.body);
  };

  myPunches = async (req: Request, res: Response) => {
    const query = PunchQueryDto.parse(req.query);
    res.json(await this.adjustments.myPunches(req.user!.id, query));
  };

  myDiscrepancies = async (req: Request, res: Response) => {
    res.json(await this.adjustments.myDiscrepancies(req.user!.id));
  };

  reportDiscrepancy = async (req: Request, res: Response) => {
    const input = DiscrepancyCreateDto.parse(req.body);
    const data = await this.adjustments.reportDiscrepancy(req.user!.id, input);
    res.status(201).json(data);
  };

  // ── F2-07 marcaje remoto ─────────────────────────────────────────────────

  remotePunch = async (req: Request, res: Response) => {
    const input = RemotePunchDto.parse(req.body);
    const result = await this.remotePunches.record(req.user!.id, input, actorOf(req));
    res.status(result.created ? 201 : 200).json(result);
  };

  // ── F2-08 NOM-037 teletrabajo ────────────────────────────────────────────

  getTeleworkPolicy = async (_req: Request, res: Response) => {
    res.json(await this.telework.getPolicy(tenantIdOrThrow()));
  };

  updateTeleworkPolicy = async (req: Request, res: Response) => {
    const input = TeleworkPolicyDto.parse(req.body);
    const config = await this.telework.updatePolicy(tenantIdOrThrow(), actorOf(req), input);
    res.json(config.policy);
  };

  listTeleworkRegistrations = async (_req: Request, res: Response) => {
    res.json(await this.telework.listRegistrations());
  };

  registerTelework = async (req: Request, res: Response) => {
    const input = TeleworkRegistrationDto.parse(req.body);
    res.status(201).json(await this.telework.register(input, actorOf(req)));
  };

  updateTeleworkRegistration = async (req: Request, res: Response) => {
    const input = TeleworkRegistrationUpdateDto.parse(req.body);
    res.json(await this.telework.updateRegistration(req.params.id, input, actorOf(req)));
  };

  listTeleworkChecklists = async (_req: Request, res: Response) => {
    res.json(await this.telework.listChecklists());
  };

  listOutOfHoursContacts = async (_req: Request, res: Response) => {
    res.json(await this.telework.listOutOfHoursContacts());
  };

  registerOutOfHoursContact = async (req: Request, res: Response) => {
    const input = OutOfHoursContactDto.parse(req.body);
    res.status(201).json(await this.telework.registerOutOfHoursContact(input, actorOf(req)));
  };

  myTelework = async (req: Request, res: Response) => {
    res.json(await this.telework.me(req.user!.id));
  };

  acceptTeleworkPolicy = async (req: Request, res: Response) => {
    const input = TeleworkAcceptDto.parse(req.body);
    res.json(await this.telework.acceptPolicy(req.user!.id, input, actorOf(req)));
  };

  submitTeleworkChecklist = async (req: Request, res: Response) => {
    const input = TeleworkChecklistDto.parse(req.body);
    res.status(201).json(await this.telework.submitChecklist(req.user!.id, input, actorOf(req)));
  };
}
