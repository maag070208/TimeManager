import { prismaClient } from "@core/config/database";
import type { AuditLogger } from "@modules/users/services/user.service";
import { PlanService } from "./services/plan.service";
import { PlanController } from "./controllers/plan.controller";
import { createPlanRouter } from "./routes/plan.routes";

export { PlanService } from "./services/plan.service";

export const createPlansModule = (audit?: AuditLogger) => {
  const service = new PlanService(prismaClient, audit);
  return { router: createPlanRouter(new PlanController(service)), service };
};

export default createPlansModule;
