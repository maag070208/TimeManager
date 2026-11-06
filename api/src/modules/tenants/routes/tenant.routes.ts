import { Router } from "express";
import {
  authenticate,
  requiresPermission,
  requiresPlatform,
} from "@core/middlewares/auth.middleware";
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
    summary: "Create client with its CLIENT_ADMIN, plan and template catalogs (ADMIN)",
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
    summary: "Update client: status (ACTIVE/SUSPENDED), name, timezone, planId (ADMIN)",
    security: bearer,
    parameters: idParam,
    request: { body: { required: true, content: { "application/json": { schema: TenantUpdateDto } } } },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: TenantSchema } } },
      404: { description: "Not found" },
    },
  });

  registerPath({
    method: "post",
    path: "/tenants/{id}/impersonate",
    tags: ["Tenants"],
    summary: "Support enters as a client (F3-03); records TENANT_IMPERSONATED",
    description:
      "Registra en la bitácora de plataforma quién entró como el cliente. El personal de soporte sigue operando con `X-Tenant-Id`; este endpoint solo deja el evento de auditoría.",
    security: bearer,
    parameters: idParam,
    responses: {
      200: { description: "Client to operate as", content: { "application/json": { schema: TenantSchema } } },
      400: { description: "Client not active" },
      404: { description: "Not found" },
    },
  });

  router.use(authenticate, requiresPlatform);
  router.get("/", requiresPermission("tenants.view"), asyncHandler(controller.list));
  router.get("/:id", requiresPermission("tenants.view"), asyncHandler(controller.getOne));
  router.post("/", requiresPermission("tenants.manage"), asyncHandler(controller.create));
  router.patch("/:id", requiresPermission("tenants.manage"), asyncHandler(controller.update));
  router.get("/:id/payments", requiresPermission("tenants.view"), asyncHandler(controller.listPayments));
  router.post("/:id/payments", requiresPermission("tenants.manage"), asyncHandler(controller.createPayment));
  router.patch(
    "/:id/payments/:paymentId",
    requiresPermission("tenants.manage"),
    asyncHandler(controller.updatePayment)
  );

  router.post(
    "/:id/impersonate",
    requiresPermission("tenants.view"),
    asyncHandler(controller.impersonate)
  );

  return router;
};
