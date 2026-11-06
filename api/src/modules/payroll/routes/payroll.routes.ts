import { Router } from "express";
import { authenticate, requiresPermission } from "@core/middlewares/auth.middleware";
import { asyncHandler } from "@core/utils/asyncHandler";
import type { PayrollController } from "../controllers/payroll.controller";

export const createPayrollRouter = (controller: PayrollController): Router => {
  const router = Router();
  router.use(authenticate);
  router.get("/settings", requiresPermission("payroll.view"), asyncHandler(controller.settings));
  router.put("/settings", requiresPermission("payroll.close"), asyncHandler(controller.updateSettings));
  router.post("/calculate", requiresPermission("payroll.view"), asyncHandler(controller.calculate));
  return router;
};
