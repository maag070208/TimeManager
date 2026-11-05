import { prismaClient } from "@core/config/database";
import { logger } from "@core/utils/logger";
import type { AuditLogger } from "@modules/users/services/user.service";
import type { NotificationPort } from "@modules/notifications";
import { NomSettingsService } from "./services/nom-settings.service";
import { PunchAdjustmentsService } from "./services/punch-adjustments.service";
import { WorkdayAlertsService, type WorkdayCalculator } from "./services/workday-alerts.service";
import { RetentionService } from "./services/retention.service";
import { StpsExportService } from "./services/stps-export.service";
import { RemotePunchService } from "./services/remote-punch.service";
import { TeleworkService } from "./services/telework.service";
import { WeeklyOvertimeService } from "./services/weekly-overtime.service";
import { HolidayService } from "./services/holiday.service";
import { WorkRecordService } from "./services/work-record.service";
import { NomController } from "./controllers/nom.controller";
import { createNomRouter } from "./routes/nom.routes";

export { NomSettingsService, weeklyLimitForYear } from "./services/nom-settings.service";
export { PunchAdjustmentsService } from "./services/punch-adjustments.service";
export { WorkdayAlertsService } from "./services/workday-alerts.service";
export { RetentionService, retentionCutoff } from "./services/retention.service";
export { StpsExportService } from "./services/stps-export.service";
export { RemotePunchService } from "./services/remote-punch.service";
export { TeleworkService } from "./services/telework.service";
export { WeeklyOvertimeService } from "./services/weekly-overtime.service";
export { HolidayService, legalHolidays } from "./services/holiday.service";
export { WorkRecordService } from "./services/work-record.service";
export { classifyWeeklyOvertime, OVERTIME_ENGINE_VERSION } from "@modules/overtime/services/weekly-overtime-engine";

type SysConfigReader = (key: string) => Promise<string | null>;

export interface NomModuleDeps {
  calculator: WorkdayCalculator;
  notifications: NotificationPort;
  audit?: AuditLogger;
  sysConfig?: SysConfigReader;
}

const ALERT_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

export const createNomModule = (deps: NomModuleDeps) => {
  const settings = new NomSettingsService(prismaClient, deps.sysConfig, deps.audit);
  const adjustments = new PunchAdjustmentsService(prismaClient, deps.audit);
  const alerts = new WorkdayAlertsService(
    prismaClient,
    deps.calculator,
    settings,
    deps.notifications,
    deps.audit
  );
  const retention = new RetentionService(prismaClient, settings, deps.audit);
  const remotePunches = new RemotePunchService(prismaClient, settings, deps.audit);
  const telework = new TeleworkService(prismaClient, settings, deps.notifications, deps.audit);
  const holidays = new HolidayService(prismaClient, deps.audit);
  const record = new WorkRecordService(prismaClient, deps.audit);
  const weeklyOvertime = new WeeklyOvertimeService(
    prismaClient,
    deps.calculator,
    deps.audit,
    holidays
  );
  const exporter = new StpsExportService(prismaClient, deps.calculator, weeklyOvertime);
  const controller = new NomController(
    settings,
    adjustments,
    alerts,
    retention,
    exporter,
    remotePunches,
    telework,
    weeklyOvertime,
    holidays,
    record
  );
  return {
    router: createNomRouter(controller),
    settings,
    adjustments,
    alerts,
    retention,
    exporter,
    remotePunches,
    telework,
    weeklyOvertime,
    holidays,
    record,
    /**
     * Worker NOM: barrido horario de límites de jornada (ayer) y archivado
     * diario de los clientes con retención configurada. Lo arranca `src/index.ts`.
     */
    startWorker: () => {
      let stopped = false;
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const runOnce = async (job: "alerts" | "retention") => {
        if (stopped) return;
        try {
          if (job === "alerts") await alerts.scanAllTenants();
          else await retention.archiveAllTenants();
        } catch (error) {
          logger.error(`[nom] ${job} worker failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      timers.push(setTimeout(() => void runOnce("alerts"), FIRST_RUN_DELAY_MS));
      timers.push(setTimeout(() => void runOnce("retention"), FIRST_RUN_DELAY_MS * 2));
      timers.push(setInterval(() => void runOnce("alerts"), ALERT_INTERVAL_MS));
      timers.push(setInterval(() => void runOnce("retention"), RETENTION_INTERVAL_MS));
      return () => {
        stopped = true;
        for (const timer of timers) {
          clearTimeout(timer);
          clearInterval(timer);
        }
      };
    },
  };
};

export default createNomModule;
