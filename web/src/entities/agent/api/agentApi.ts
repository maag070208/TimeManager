import { api } from "@shared/api/client";
import type {
  AgentAdmin,
  AgentJob,
  AgentTokenResult,
  EnqueueAgentJobInput,
} from "../model/types";

/**
 * Consola del agente local. En la consola de plataforma el cliente se elige por
 * `X-Tenant-Id` (no hay que "entrar" al cliente para gestionar su agente).
 */
const tenantHeaders = (tenantId?: string) =>
  tenantId ? { headers: { "X-Tenant-Id": tenantId } } : undefined;

export const agentApi = {
  list: (tenantId?: string) =>
    api.get<{ agents: AgentAdmin[] }>("/agent/agents", tenantHeaders(tenantId)),

  /** Alta: devuelve el token en claro UNA sola vez. */
  create: (name: string, tenantId?: string) =>
    api.post<AgentTokenResult>("/agent/agents", { name }, tenantHeaders(tenantId)),

  /** Rotación: invalida el token anterior y devuelve uno nuevo. */
  rotate: (id: string, tenantId?: string) =>
    api.post<AgentTokenResult>(`/agent/agents/${id}/token`, undefined, tenantHeaders(tenantId)),

  setActive: (id: string, active: boolean, tenantId?: string) =>
    api.patch<AgentAdmin>(`/agent/agents/${id}`, { active }, tenantHeaders(tenantId)),

  /** Encola un trabajo para el agente del cliente en contexto. */
  enqueue: (input: EnqueueAgentJobInput) => api.post<AgentJob>("/agent/jobs", input),

  recentJobs: (limit = 20) =>
    api.get<{ jobs: AgentJob[] }>(`/agent/jobs/recent?limit=${limit}`),
};
