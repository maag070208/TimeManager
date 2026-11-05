import { z } from "zod";
import { registry } from "@core/swagger/registry";

/** Una checada derivada de un evento ISAPI; el API deriva `method` del `minor`. */
export const AgentPunchSchema = registry.register(
  "AgentPunch",
  z
    .object({
      serialNo: z.number().int().positive(),
      employeeNumber: z.string().min(1).max(64),
      name: z.string().max(128).optional(),
      minor: z.number().int().min(0).max(999),
      occurredAt: z.string().datetime({ offset: true }),
    })
    .openapi("AgentPunch")
);

export const AgentPunchesBodySchema = registry.register(
  "AgentPunchesBody",
  z
    .object({
      clockSerial: z.string().min(1).max(64),
      punches: z.array(AgentPunchSchema).min(1).max(500),
      lastSerialNo: z.number().int().nonnegative().optional(),
    })
    .openapi("AgentPunchesBody")
);

export const AgentRegisterBodySchema = registry.register(
  "AgentRegisterBody",
  z
    .object({
      name: z.string().max(120).optional(),
      version: z.string().max(64).optional(),
      platform: z.string().max(64).optional(),
    })
    .openapi("AgentRegisterBody")
);

export const AgentJobResultBodySchema = registry.register(
  "AgentJobResultBody",
  z
    .object({
      ok: z.boolean(),
      result: z.unknown().optional(),
      error: z.string().max(2000).optional(),
    })
    .openapi("AgentJobResultBody")
);

export const AgentHeartbeatBodySchema = registry.register(
  "AgentHeartbeatBody",
  z
    .object({
      version: z.string().max(64).optional(),
      lastSyncAt: z.string().datetime({ offset: true }).optional(),
      pendingPunches: z.number().int().nonnegative().optional(),
      clocks: z
        .array(
          z.object({
            serialNumber: z.string().max(64),
            ok: z.boolean(),
            error: z.string().max(500).optional(),
          })
        )
        .max(20)
        .optional(),
    })
    .openapi("AgentHeartbeatBody")
);

export const AgentConfigSchema = registry.register(
  "AgentConfig",
  z
    .object({
      agent: z.object({ id: z.string(), name: z.string(), version: z.string().nullable() }),
      tenant: z.object({ id: z.string(), name: z.string(), timezone: z.string() }),
      sync: z.object({
        chunkSeconds: z.number(),
        jobsPollSeconds: z.number(),
        heartbeatSeconds: z.number(),
      }),
      clocks: z.array(
        z.object({
          serialNumber: z.string(),
          name: z.string().nullable(),
          url: z.string(),
          countsAttendance: z.boolean(),
          writeEnabled: z.boolean(),
          lastSerialNo: z.number(),
          syncedAt: z.string().nullable(),
          credentials: z.object({ username: z.string(), password: z.string() }).nullable(),
        })
      ),
    })
    .openapi("AgentConfig")
);

export const AgentTokenResponseSchema = registry.register(
  "AgentTokenResponse",
  z
    .object({
      token: z.string(),
      agentId: z.string(),
      tenantId: z.string(),
      rotatedAt: z.string(),
    })
    .openapi("AgentTokenResponse")
);

export const AgentPunchesResponseSchema = registry.register(
  "AgentPunchesResponse",
  z
    .object({
      received: z.number(),
      stored: z.number(),
      duplicates: z.number(),
      cursor: z.number(),
    })
    .openapi("AgentPunchesResponse")
);

export const AgentJobSchema = registry.register(
  "AgentJob",
  z
    .object({
      id: z.string(),
      clockSerial: z.string().nullable(),
      type: z.string(),
      payload: z.record(z.unknown()),
      status: z.string(),
      attempts: z.number(),
      maxAttempts: z.number(),
      availableAt: z.string(),
      claimedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
      result: z.unknown().nullable(),
      error: z.string().nullable(),
      createdAt: z.string(),
    })
    .openapi("AgentJob")
);

export const AgentJobsResponseSchema = registry.register(
  "AgentJobsResponse",
  z.object({ jobs: z.array(AgentJobSchema) }).openapi("AgentJobsResponse")
);

export const AgentHeartbeatResponseSchema = registry.register(
  "AgentHeartbeatResponse",
  z
    .object({
      serverTime: z.string(),
      nextJobsInMs: z.number(),
      pendingJobs: z.number(),
    })
    .openapi("AgentHeartbeatResponse")
);
