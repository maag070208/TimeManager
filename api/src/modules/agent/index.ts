import { prismaClient } from "@core/config/database";
import { AgentService, type AuditLogger } from "./services/agent.service";
import { TableAgentJobQueue, type AgentJobQueue } from "./services/agent-job-queue";
import { AgentController } from "./controllers/agent.controller";
import { createAgentRouter } from "./routes/agent.routes";

export { AgentService } from "./services/agent.service";
export type { AuditLogger } from "./services/agent.service";
export { TableAgentJobQueue, retryDelayMs } from "./services/agent-job-queue";
export type { AgentJobQueue } from "./services/agent-job-queue";
export { createAgentToken, hashAgentToken } from "./services/agent-token.service";
export type {
  AgentConfig,
  AgentPunchesInput,
  AgentPunchesResult,
  AgentJobRecord,
  EnqueueAgentJobInput,
} from "./models/entity/agent.entity";

/**
 * Módulo del agente local (CheckLab Agent): credencial de dispositivo por
 * cliente, ingesta idempotente de checadas y cola de trabajos hacia el reloj.
 *
 * @param audit Puerto de auditoría opcional (DIP): registra alta, rotación de
 * token y resultados de trabajos.
 */
export const createAgentModule = (audit?: AuditLogger) => {
  const jobs: AgentJobQueue = new TableAgentJobQueue(prismaClient);
  const service = new AgentService(prismaClient, jobs, audit);
  const controller = new AgentController(service);
  return { router: createAgentRouter(controller), service, jobs };
};

export default createAgentModule;
