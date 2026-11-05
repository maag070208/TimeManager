import type { Request, Response } from "express";
import {
  AgentHeartbeatBodySchema,
  AgentJobResultBodySchema,
  AgentPunchesBodySchema,
  AgentRegisterBodySchema,
} from "../models/dto/agent.dto";
import {
  AgentAdminCreateBodySchema,
  AgentAdminUpdateBodySchema,
  AgentEnqueueJobBodySchema,
} from "../models/dto/agent-console.dto";
import type { AgentService } from "../services/agent.service";

/**
 * Endpoints del agente local (F1B-13/15/16/17). No usan `authenticate` de
 * usuarios: el middleware del router valida el token de dispositivo y deja
 * `req.agent` + el contexto del cliente.
 */
const actorOf = (req: Request): { id?: string; username?: string } => ({
  id: req.user?.id,
  username: req.user?.username,
});

export class AgentController {
  constructor(private readonly service: AgentService) {}

  register = async (req: Request, res: Response) => {
    const body = AgentRegisterBodySchema.parse(req.body ?? {});
    res.json(await this.service.register(req.agent!, body));
  };

  rotateToken = async (req: Request, res: Response) => {
    res.json(await this.service.rotateToken(req.agent!));
  };

  config = async (req: Request, res: Response) => {
    res.json(await this.service.config(req.agent!));
  };

  punches = async (req: Request, res: Response) => {
    const body = AgentPunchesBodySchema.parse(req.body);
    res.json(await this.service.ingestPunches(req.agent!, body));
  };

  jobs = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);
    const jobs = await this.service.claimJobs(
      req.agent!,
      Number.isFinite(limit) ? limit : 5
    );
    res.json({ jobs });
  };

  jobResult = async (req: Request, res: Response) => {
    const body = AgentJobResultBodySchema.parse(req.body);
    res.json(await this.service.submitJobResult(req.agent!, req.params.id, body));
  };

  heartbeat = async (req: Request, res: Response) => {
    const body = AgentHeartbeatBodySchema.parse(req.body ?? {});
    res.json(await this.service.heartbeat(req.agent!, body));
  };

  // ── Consola de plataforma (F3-12) y panel de relojes (F3-07) ──────────

  listAgents = async (req: Request, res: Response) => {
    void req;
    res.json({ agents: await this.service.listAgents() });
  };

  createAgent = async (req: Request, res: Response) => {
    const body = AgentAdminCreateBodySchema.parse(req.body);
    res.status(201).json(await this.service.createAgent(body.name, actorOf(req)));
  };

  rotateAgentToken = async (req: Request, res: Response) => {
    res.json(await this.service.rotateTokenForConsole(req.params.id, actorOf(req)));
  };

  setAgentActive = async (req: Request, res: Response) => {
    const body = AgentAdminUpdateBodySchema.parse(req.body);
    res.json(await this.service.setAgentActive(req.params.id, body.active, actorOf(req)));
  };

  enqueueJob = async (req: Request, res: Response) => {
    const body = AgentEnqueueJobBodySchema.parse(req.body);
    const job = await this.service.enqueuePanelJob(
      {
        type: body.type,
        clockSerial: body.clockSerial,
        payload: (body.payload ?? {}) as Record<string, unknown>,
      },
      actorOf(req)
    );
    res.status(201).json(job);
  };

  recentJobs = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 20);
    res.json({ jobs: await this.service.recentJobs(Number.isFinite(limit) ? limit : 20) });
  };
}
