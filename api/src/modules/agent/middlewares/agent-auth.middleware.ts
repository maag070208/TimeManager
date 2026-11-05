import type { NextFunction, Request, Response } from "express";
import { prismaClient } from "@core/config/database";
import { HttpError } from "@core/middlewares/error.middleware";
import { runWithRlsBypass, runWithTenant } from "@core/tenancy";
import { hashAgentToken, agentTokenFromRequest } from "../services/agent-token.service";
import type { AgentSession } from "../models/entity/agent.entity";

declare global {
  namespace Express {
    interface Request {
      /** Agente autenticado por token de dispositivo (nunca un JWT de usuario). */
      agent?: AgentSession;
    }
  }
}

/**
 * Autenticación de agentes por token de dispositivo (F1B-17), separada del
 * `authenticate` de usuarios:
 *
 * - El token del header se hashea (SHA-256) y se busca el agente; solo un
 *   agente `active` y de un cliente `ACTIVE` pasa.
 * - Deja la petición dentro del contexto de su cliente (`runWithTenant`), así
 *   la extensión de Prisma filtra/inyecta `tenantId` en todos los queries del
 *   agente: un agente no puede tocar relojes ni trabajos de otro cliente.
 * - Revocable: `UPDATE agents SET active = false` corta el acceso en la
 *   siguiente petición; rotar el token invalida el anterior.
 */
export const authenticateAgent = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = agentTokenFromRequest(req);
  if (!token) throw new HttpError(401, "TOKEN_MISSING");

  const tokenHash = hashAgentToken(token);

  void (async () => {
    // Pre-contexto: el agente se busca por hash del token antes de conocer el
    // cliente; RLS lo permite solo con el bypass controlado (F1B-01).
    const agent = await runWithRlsBypass(() =>
      prismaClient.agent.findUnique({
        where: { tokenHash },
        select: { id: true, tenantId: true, name: true, active: true },
      })
    );
    if (!agent || !agent.active) throw new HttpError(401, "INVALID_AGENT_TOKEN");

    const tenant = await prismaClient.tenant.findUnique({
      where: { id: agent.tenantId },
      select: { id: true, status: true },
    });
    if (!tenant || tenant.status !== "ACTIVE") throw new HttpError(403, "TENANT_SUSPENDED");

    req.agent = { id: agent.id, tenantId: agent.tenantId, name: agent.name };
    await runWithTenant(agent.tenantId, () => next());
  })().catch(next);
};
