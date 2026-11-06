import { prismaClient } from "@core/config/database";
import type { AuditLogger } from "@modules/users/services/user.service";
import { PayrollSettingsService } from "./services/payroll-settings.service";
import { PayrollController } from "./controllers/payroll.controller";
import { createPayrollRouter } from "./routes/payroll.routes";

export { PayrollSettingsService } from "./services/payroll-settings.service";
export * from "./services/payroll-engine";

export const createPayrollModule = (audit?: AuditLogger) => {
  const service = new PayrollSettingsService(prismaClient, audit);
  return { router: createPayrollRouter(new PayrollController(service)), service };
};

export default createPayrollModule;
