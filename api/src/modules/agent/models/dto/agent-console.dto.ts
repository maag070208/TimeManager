import { z } from "zod";
import { registry } from "@core/swagger/registry";
import { AgentJobSchema } from "./agent.dto";

/** Alta de un agente desde la consola de plataforma (F3-12). */
export const AgentAdminCreateBodySchema = registry.register(
  "AgentAdminCreateBody",
  z
    .object({
      name: z.string().min(1).max(120),
    })
    .openapi("AgentAdminCreateBody")
);

export const AgentAdminUpdateBodySchema = registry.register(
  "AgentAdminUpdateBody",
  z
    .object({
      active: z.boolean(),
    })
    .openapi("AgentAdminUpdateBody")
);

export const AgentAdminSchema = registry.register(
  "AgentAdmin",
  z
    .object({
      id: z.string(),
      name: z.string(),
      version: z.string().nullable(),
      active: z.boolean(),
      lastSeenAt: z.string().nullable(),
      lastSyncAt: z.string().nullable(),
      createdAt: z.string(),
    })
    .openapi("AgentAdmin")
);

export const AgentAdminCreatedSchema = registry.register(
  "AgentAdminCreated",
  z
    .object({
      agent: AgentAdminSchema,
      /** Token de dispositivo en claro: se muestra UNA sola vez. */
      token: z.string(),
    })
    .openapi("AgentAdminCreated")
);

/** Alta de persona en el reloj (la ejecuta el agente vía trabajo PERSON_ADD). */
export const AgentPersonPayloadSchema = z.object({
  employeeNumber: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  gender: z.string().max(20).optional(),
});

/** Baja de persona del reloj (PERSON_REMOVE). */
export const AgentPersonRemovePayloadSchema = z.object({
  employeeNumber: z.string().min(1).max(64),
});

/** Alta de tarjeta (CARD_ADD). */
export const AgentCardPayloadSchema = z.object({
  employeeNumber: z.string().min(1).max(64),
  cardNo: z.string().min(1).max(64),
});

/** Trabajos que el panel puede encolar para el agente local. */
export const AgentEnqueueJobBodySchema = registry.register(
  "AgentEnqueueJobBody",
  z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("SYNC"),
        clockSerial: z.string().min(1).max(64),
        payload: z.record(z.unknown()).optional(),
      }),
      z.object({
        type: z.literal("PERSON_ADD"),
        clockSerial: z.string().min(1).max(64),
        payload: AgentPersonPayloadSchema,
      }),
      z.object({
        type: z.literal("PERSON_REMOVE"),
        clockSerial: z.string().min(1).max(64),
        payload: AgentPersonRemovePayloadSchema,
      }),
      z.object({
        type: z.literal("CARD_ADD"),
        clockSerial: z.string().min(1).max(64),
        payload: AgentCardPayloadSchema,
      }),
    ])
    .openapi("AgentEnqueueJobBody")
);

export const AgentRecentJobsSchema = registry.register(
  "AgentRecentJobs",
  z.object({ jobs: z.array(AgentJobSchema) }).openapi("AgentRecentJobs")
);

export type AgentAdminCreateBody = z.infer<typeof AgentAdminCreateBodySchema>;
export type AgentAdminUpdateBody = z.infer<typeof AgentAdminUpdateBodySchema>;
export type AgentEnqueueJobBody = z.infer<typeof AgentEnqueueJobBodySchema>;
