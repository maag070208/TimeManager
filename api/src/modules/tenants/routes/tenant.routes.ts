import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, requiresPermission } from "@core/middlewares/auth.middleware";
import { HttpError } from "@core/middlewares/error.middleware";
import { asyncHandler } from "@core/utils/asyncHandler";
import { registerPath } from "@core/swagger/registry";
import {
  TenantCreateDto,
  TenantCreatedSchema,
  TenantSchema,
  TenantUpdateDto,
} from "../models/dto/tenant.dto";
import type { TenantController } from "../controllers/tenant.controller";

const bearer = [{ bearerAuth: [] }];
const idParam = [{ in: "path" as const, name: "id", required: true, schema: { type: "string" as const } }];

/**
 * Solo personal de plataforma (usuario sin cliente). El permiso no basta: una
 * excepción de permiso a un usuario de cliente no debe abrirle la lista de clientes.
 */
const requiresPlatform = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.tenantId) throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
  next();
};

export const createTenantRouter = (controller: TenantController): Router => {
  const router = Router();

  registerPath({
    method: "get",
    path: "/tenants",
    tags: ["Tenants"],
    summary: "List clients (ADMIN/SUPPORT)",
    security: bearer,
    responses: {
      200: { description: "Clients", content: { "application/json": { schema: TenantSchema.array() } } },
    },
  });
  registerPath({
    method: "get",
    path: "/tenants/{id}",
    tags: ["Tenants"],
    summary: "Get client (ADMIN/SUPPORT)",
    security: bearer,
    parameters: idParam,
    responses: {
      200: { description: "Client", content: { "application/json": { schema: TenantSchema } } },
      404: { description: "Not found" },
    },
  });
  registerPath({
    method: "post",
    path: "/tenants",
    tags: ["Tenants"],
    summary: "Create client with its CLIENT_ADMIN and template catalogs (ADMIN)",
    description:
      "Without admin.password the API generates a provisional one and returns it once in `temporaryPassword`.",
    security: bearer,
    request: { body: { required: true, content: { "application/json": { schema: TenantCreateDto } } } },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: TenantCreatedSchema } } },
      409: { description: "Slug taken" },
    },
  });
  registerPath({
    method: "patch",
    path: "/tenants/{id}",
    tags: ["Tenants"],
    summary: "Update client: status (ACTIVE/SUSPENDED), name, timezone, plan (ADMIN)",
    security: bearer,
    parameters: idParam,
    request: { body: { required: true, content: { "application/json": { schema: TenantUpdateDto } } } },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: TenantSchema } } },
      404: { description: "Not found" },
    },
  });

  router.use(authenticate, requiresPlatform);
  router.get("/", requiresPermission("tenants.view"), asyncHandler(controller.list));
  router.get("/:id", requiresPermission("tenants.view"), asyncHandler(controller.getOne));
  router.post("/", requiresPermission("tenants.manage"), asyncHandler(controller.create));
  router.patch("/:id", requiresPermission("tenants.manage"), asyncHandler(controller.update));

  return router;
};
