import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, requiresAnyPermission, requiresPermission } from "@core/middlewares/auth.middleware";
import { HttpError } from "@core/middlewares/error.middleware";
import { asyncHandler } from "@core/utils/asyncHandler";
import { registerPath } from "@core/swagger/registry";
import { authenticateAgent } from "../middlewares/agent-auth.middleware";
import {
  AgentConfigSchema,
  AgentHeartbeatResponseSchema,
  AgentJobSchema,
  AgentJobsResponseSchema,
  AgentPunchesResponseSchema,
  AgentTokenResponseSchema,
} from "../models/dto/agent.dto";
import {
  AgentAdminCreatedSchema,
  AgentAdminSchema,
  AgentRecentJobsSchema,
} from "../models/dto/agent-console.dto";
import type { AgentController } from "../controllers/agent.controller";

const agentAuth = [{ bearerAuth: [] }];

/**
 * Solo personal de plataforma (usuario sin cliente). Gestiona agentes de
 * CUALQUIER cliente eligiéndolo con `X-Tenant-Id`, como `/tenants`.
 */
const requiresPlatformStaff = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.tenantId) throw new HttpError(403, "INSUFFICIENT_PERMISSIONS");
  next();
};

const PLATFORM_AGENT_PERMISSIONS = ["tenants.manage", "time_clocks.manage"] as const;
const JOB_READ_PERMISSIONS = ["time_clock.write", "time_clocks.manage", "time_clock.view"] as const;
const idParam = [{ in: "path" as const, name: "id", required: true, schema: { type: "string" as const } }];

const TOKEN_DESCRIPTION =
  "Token de dispositivo del agente (no es un JWT de usuario). Se emite una sola " +
  "vez al dar de alta el agente y se rota con `POST /agent/token`; revocar = " +
  "desactivar el agente en la consola de plataforma.";

export const createAgentRouter = (controller: AgentController): Router => {
  const router = Router();

  registerPath({
    method: "post",
    path: "/agent/register",
    tags: ["Agente"],
    summary: "Register the local agent (first connection and each startup)",
    description: TOKEN_DESCRIPTION,
    security: agentAuth,
    responses: {
      200: { description: "Agent and tenant summary" },
      401: { description: "Missing, invalid, rotated or revoked device token" },
      403: { description: "Client suspended" },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/token",
    tags: ["Agente"],
    summary: "Rotate the agent device token",
    description: `${TOKEN_DESCRIPTION} El token anterior deja de funcionar en la siguiente petición.`,
    security: agentAuth,
    responses: {
      200: {
        description: "New device token (shown only once)",
        content: { "application/json": { schema: AgentTokenResponseSchema } },
      },
      401: { description: "Missing, invalid, rotated or revoked device token" },
    },
  });

  registerPath({
    method: "get",
    path: "/agent/config",
    tags: ["Agente"],
    summary: "Clocks with credentials (decrypted) and sync cadence for this agent",
    description: `${TOKEN_DESCRIPTION} Las credenciales del reloj solo se entregan al agente autenticado.`,
    security: agentAuth,
    responses: {
      200: {
        description: "Agent config",
        content: { "application/json": { schema: AgentConfigSchema } },
      },
      401: { description: "Invalid device token" },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/punches",
    tags: ["Agente"],
    summary: "Upload a chunk of punches (idempotent per clockSerial+serialNo)",
    description:
      "Reintentos y chunks repetidos no duplican: el `@@unique(clockSerial, serialNo)` " +
      "descarta las filas ya guardadas y el avance del cursor del reloj es monótono.",
    security: agentAuth,
    responses: {
      200: {
        description: "Chunk ingested",
        content: { "application/json": { schema: AgentPunchesResponseSchema } },
      },
      400: { description: "Validation error" },
      404: { description: "Clock not registered for this client (AGENT_CLOCK_NOT_FOUND)" },
    },
  });

  registerPath({
    method: "get",
    path: "/agent/jobs",
    tags: ["Agente"],
    summary: "Claim pending jobs (poll)",
    description:
      "Reclama hasta `limit` trabajos PENDING (por defecto 5, tope 10) y los marca " +
      "RUNNING con un intento más. Los trabajos con `agentId` solo los ve ese agente.",
    security: agentAuth,
    parameters: [
      { in: "query", name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 10 } },
    ],
    responses: {
      200: {
        description: "Claimed jobs",
        content: { "application/json": { schema: AgentJobsResponseSchema } },
      },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/jobs/{id}/result",
    tags: ["Agente"],
    summary: "Report a job result",
    description:
      "Si falla y le quedan intentos, el trabajo vuelve a PENDING con backoff " +
      "exponencial; al agotar `maxAttempts` queda FAILED.",
    security: agentAuth,
    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
    responses: {
      200: {
        description: "Updated job",
        content: { "application/json": { schema: AgentJobSchema } },
      },
      404: { description: "Job not found for this client (AGENT_JOB_NOT_FOUND)" },
      409: { description: "Job is not RUNNING for this agent (AGENT_JOB_NOT_CLAIMED)" },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/heartbeat",
    tags: ["Agente"],
    summary: "Agent heartbeat (health and last sync)",
    description: TOKEN_DESCRIPTION,
    security: agentAuth,
    responses: {
      200: {
        description: "Server time and pending jobs",
        content: { "application/json": { schema: AgentHeartbeatResponseSchema } },
      },
    },
  });

  // ── Consola de plataforma (F3-12) y panel de relojes (F3-07) ─────────
  // Usuarios con JWT (no token de dispositivo). Van ANTES del
  // `router.use(authenticateAgent)` para no compartir middleware.

  registerPath({
    method: "get",
    path: "/agent/agents",
    tags: ["Agente"],
    summary: "List the client's local agents (platform staff)",
    description: "Agentes del cliente elegido con `X-Tenant-Id`. No devuelve el hash ni el token.",
    security: agentAuth,
    responses: {
      200: { description: "Agents", content: { "application/json": { schema: AgentAdminSchema.array() } } },
      403: { description: "Not platform staff or missing permission" },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/agents",
    tags: ["Agente"],
    summary: "Create a local agent and return its device token once (platform staff)",
    description: "El token en claro se muestra una sola vez; en BD queda su hash SHA-256.",
    security: agentAuth,
    responses: {
      201: { description: "Agent created", content: { "application/json": { schema: AgentAdminCreatedSchema } } },
      400: { description: "No client selected (TENANT_REQUIRED)" },
      403: { description: "Not platform staff or missing permission" },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/agents/{id}/token",
    tags: ["Agente"],
    summary: "Rotate an agent device token (platform staff)",
    description: "El token anterior deja de funcionar de inmediato; el nuevo se muestra una sola vez.",
    security: agentAuth,
    parameters: idParam,
    responses: {
      200: { description: "New token", content: { "application/json": { schema: AgentAdminCreatedSchema } } },
      404: { description: "Agent not found (AGENT_NOT_FOUND)" },
    },
  });

  registerPath({
    method: "patch",
    path: "/agent/agents/{id}",
    tags: ["Agente"],
    summary: "Revoke or reactivate an agent (platform staff)",
    description: "`active=false` corta el acceso del agente en su siguiente petición.",
    security: agentAuth,
    parameters: idParam,
    responses: {
      200: { description: "Updated agent", content: { "application/json": { schema: AgentAdminSchema } } },
      404: { description: "Agent not found (AGENT_NOT_FOUND)" },
    },
  });

  registerPath({
    method: "post",
    path: "/agent/jobs",
    tags: ["Agente"],
    summary: "Enqueue a job for the client's local agent (clock panel)",
    description:
      "Tipos: `SYNC`, `PERSON_ADD`, `PERSON_REMOVE`, `CARD_ADD`. Requiere `time_clock.write`; " +
      "las escrituras exigen el reloj con escritura habilitada (si no, 403 TIME_CLOCK_READ_ONLY).",
    security: agentAuth,
    responses: {
      201: { description: "Job enqueued", content: { "application/json": { schema: AgentJobSchema } } },
      403: { description: "Missing permission or the clock is read-only" },
      404: { description: "Clock not found for this client (TIME_CLOCK_NOT_FOUND)" },
    },
  });

  registerPath({
    method: "get",
    path: "/agent/jobs/recent",
    tags: ["Agente"],
    summary: "Recent jobs of the client (clock panel status)",
    security: agentAuth,
    parameters: [{ in: "query", name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 50 } }],
    responses: {
      200: { description: "Recent jobs", content: { "application/json": { schema: AgentRecentJobsSchema } } },
    },
  });

  router.get(
    "/agents",
    authenticate,
    requiresPlatformStaff,
    requiresAnyPermission(PLATFORM_AGENT_PERMISSIONS),
    asyncHandler(controller.listAgents)
  );
  router.post(
    "/agents",
    authenticate,
    requiresPlatformStaff,
    requiresAnyPermission(PLATFORM_AGENT_PERMISSIONS),
    asyncHandler(controller.createAgent)
  );
  router.post(
    "/agents/:id/token",
    authenticate,
    requiresPlatformStaff,
    requiresAnyPermission(PLATFORM_AGENT_PERMISSIONS),
    asyncHandler(controller.rotateAgentToken)
  );
  router.patch(
    "/agents/:id",
    authenticate,
    requiresPlatformStaff,
    requiresAnyPermission(PLATFORM_AGENT_PERMISSIONS),
    asyncHandler(controller.setAgentActive)
  );
  router.post(
    "/jobs",
    authenticate,
    requiresPermission("time_clock.write"),
    asyncHandler(controller.enqueueJob)
  );
  router.get(
    "/jobs/recent",
    authenticate,
    requiresAnyPermission(JOB_READ_PERMISSIONS),
    asyncHandler(controller.recentJobs)
  );

  router.use(authenticateAgent);

  router.post("/register", asyncHandler(controller.register));
  router.post("/token", asyncHandler(controller.rotateToken));
  router.get("/config", asyncHandler(controller.config));
  router.post("/punches", asyncHandler(controller.punches));
  router.get("/jobs", asyncHandler(controller.jobs));
  router.post("/jobs/:id/result", asyncHandler(controller.jobResult));
  router.post("/heartbeat", asyncHandler(controller.heartbeat));

  return router;
};
