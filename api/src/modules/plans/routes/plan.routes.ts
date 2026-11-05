import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, requiresPermission } from "@core/middlewares/auth.middleware";
import { HttpError } from "@core/middlewares/error.middleware";
import { asyncHandler } from "@core/utils/asyncHandler";
import { registerPath } from "@core/swagger/registry";
import { PlanCreateDto, PlanSchema, PlanUpdateDto } from "../models/dto/plan.dto";
import type { PlanController } from "../controllers/plan.controller";

const bearer = [{ bearerAuth: [] }];
const idParam = [{ in: "path" as const, name: "id", required: true, schema: { type: "string" as const } }];

/**
 * Solo personal de plataforma (usuario sin cliente): una excepción de permiso a
 * un usuario de cliente no debe abrirle el catálogo de planes.
 */
const requiresPlatform = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.tenantId) throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
  next();
};

export const createPlanRouter = (controller: PlanController): Router => {
  const router = Router();

  registerPath({
    method: "get",
    path: "/plans",
    tags: ["Plans"],
    summary: "List plans (ADMIN/SUPPORT)",
    security: bearer,
    parameters: [{ in: "query", name: "includeInactive", required: false, schema: { type: "boolean" } }],
    responses: {
      200: { description: "Plans", content: { "application/json": { schema: PlanSchema.array() } } },
    },
  });
  registerPath({
    method: "get",
    path: "/plans/{id}",
    tags: ["Plans"],
    summary: "Get plan (ADMIN/SUPPORT)",
    security: bearer,
    parameters: idParam,
    responses: {
      200: { description: "Plan", content: { "application/json": { schema: PlanSchema } } },
      404: { description: "Not found" },
    },
  });
  registerPath({
    method: "post",
    path: "/plans",
    tags: ["Plans"],
    summary: "Create plan (ADMIN)",
    security: bearer,
    request: { body: { required: true, content: { "application/json": { schema: PlanCreateDto } } } },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: PlanSchema } } },
      409: { description: "Key taken" },
    },
  });
  registerPath({
    method: "patch",
    path: "/plans/{id}",
    tags: ["Plans"],
    summary: "Update plan: name, limits, price, order, active (ADMIN)",
    security: bearer,
    parameters: idParam,
    request: { body: { required: true, content: { "application/json": { schema: PlanUpdateDto } } } },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: PlanSchema } } },
      404: { description: "Not found" },
    },
  });
  registerPath({
    method: "delete",
    path: "/plans/{id}",
    tags: ["Plans"],
    summary: "Deactivate plan (ADMIN; clients keep it)",
    security: bearer,
    parameters: idParam,
    responses: {
      200: { description: "Deactivated", content: { "application/json": { schema: PlanSchema } } },
      404: { description: "Not found" },
    },
  });

  router.use(authenticate, requiresPlatform);
  router.get("/", requiresPermission("plans.view"), asyncHandler(controller.list));
  router.get("/:id", requiresPermission("plans.view"), asyncHandler(controller.getOne));
  router.post("/", requiresPermission("plans.manage"), asyncHandler(controller.create));
  router.patch("/:id", requiresPermission("plans.manage"), asyncHandler(controller.update));
  router.delete("/:id", requiresPermission("plans.manage"), asyncHandler(controller.remove));

  return router;
};
