import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";

/**
 * Token de dispositivo del agente (F1B-17). En BD solo se guarda el hash
 * SHA-256: el token en claro se muestra una sola vez (alta o rotación) y es
 * revocable desactivando el agente o rotándolo.
 */
export const AGENT_TOKEN_PREFIX = "tma_";

export const hashAgentToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** Token nuevo (256 bits) y el hash que se persiste. */
export const createAgentToken = (): { token: string; tokenHash: string } => {
  const token = `${AGENT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashAgentToken(token) };
};

/** Token del `Authorization: Bearer …` o del header `X-Agent-Token` (compatibilidad). */
export const agentTokenFromRequest = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header) {
    const [scheme, value] = header.split(" ");
    if (scheme === "Bearer" && value?.trim()) return value.trim();
  }
  const custom = req.headers["x-agent-token"];
  return typeof custom === "string" && custom.trim() !== "" ? custom.trim() : null;
};
