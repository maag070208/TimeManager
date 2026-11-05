import { prismaClient } from "@core/config/database";
import type { EmployeeRecordsService } from "@modules/hr";
import type { WeeklyAttendanceService } from "@modules/schedules/services/weekly-attendance.service";
import { PeopleDashboardService } from "./services/people-dashboard.service";
import { DashboardController } from "./controllers/dashboard.controller";
import { createDashboardRouter } from "./routes/dashboard.routes";

export interface DashboardModuleDeps {
  records: EmployeeRecordsService;
  weeklyAttendance: WeeklyAttendanceService;
  sysConfig?: (key: string) => Promise<string | null>;
}

export const createDashboardModule = (deps: DashboardModuleDeps) => {
  const people = new PeopleDashboardService(deps.records, deps.weeklyAttendance, prismaClient, deps.sysConfig);
  const controller = new DashboardController(people);
  return createDashboardRouter(controller);
};

export default createDashboardModule;
