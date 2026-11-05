import { prismaClient } from "@core/config/database";
import type { AuditLogger } from "@modules/users/services/user.service";
import { TenantService } from "./services/tenant.service";
import { TenantController } from "./controllers/tenant.controller";
import { createTenantRouter } from "./routes/tenant.routes";

export { TenantService } from "./services/tenant.service";

export const createTenantsModule = (audit?: AuditLogger) => {
  const service = new TenantService(prismaClient, audit);
  return { router: createTenantRouter(new TenantController(service)), service };
};

export default createTenantsModule;
