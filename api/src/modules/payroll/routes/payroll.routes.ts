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
  router.get("/positions", requiresPermission("payroll.view"), asyncHandler(controller.positions));
  router.post("/positions", requiresPermission("payroll.close"), asyncHandler(controller.createPosition));
  router.patch("/positions/:id", requiresPermission("payroll.close"), asyncHandler(controller.updatePosition));
  router.put("/positions/:id/assign", requiresPermission("payroll.close"), asyncHandler(controller.assignPosition));
  return router;
};
