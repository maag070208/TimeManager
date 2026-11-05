import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { env as config } from "@core/config/env.config";
import { metricsContentType, refreshOperationalGauges, renderMetrics } from "@core/observability/metrics";
import { newRequestId, runWithRequestContext, setRequestPrincipal } from "@core/observability/request-context";
import { verifyToken } from "@core/utils/security";

/**
 * Middlewares de producción (F1C-03, F4-02, F4-03): correlación de peticiones,
 * rate limiting en memoria (Redis después) y exposición protegida de métricas.
 */

/** Acepta un `X-Request-Id` del proxy o genera uno; lo devuelve en la respuesta. */
export const requestContextMiddleware = () => (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.trim() !== "" && incoming.length <= 128
      ? incoming.trim()
      : newRequestId();
  res.setHeader("X-Request-Id", requestId);
  runWithRequestContext({ requestId }, next);
};

const rateLimitHandler = (_req: Request, res: Response): void => {
  res.status(429).json({
    error: "TooManyRequests",
    code: "TOO_MANY_REQUESTS",
    message: "Demasiadas peticiones; intenta de nuevo más tarde",
  });
};

const baseOptions = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.RATE_LIMIT_DISABLED,
  handler: rateLimitHandler,
  // En local/E2E sin proxy no hay X-Forwarded-For: no advertir por ello.
  validate: { xForwardedForHeader: false, trustProxy: false } as const,
};

/** Login: ventana larga y tope bajo (protege fuerza bruta). */
export const loginRateLimiter = rateLimit({
  ...baseOptions,
  limit: config.RATE_LIMIT_LOGIN_MAX,
});

/** `/query` (tablas server-side) y sync: tope alto por IP/cliente. */
export const queryRateLimiter = rateLimit({
  ...baseOptions,
  limit: config.RATE_LIMIT_QUERY_MAX,
});

/** Aplica el tope de consultas solo a las rutas que terminan en `/query` o `/sync`. */
export const queryPathsRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const path = req.path;
  if (path.endsWith("/query") || path.endsWith("/sync") || path.endsWith("/import")) {
    queryRateLimiter(req, res, next);
    return;
  }
  next();
};

/**
 * `GET /metrics`: con `METRICS_TOKEN` exige `Authorization: Bearer <token>`;
 * sin token configurado acepta un JWT de plataforma (ADMIN/SUPPORT).
 */
export const metricsAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (config.METRICS_TOKEN) {
    if (header === `Bearer ${config.METRICS_TOKEN}`) {
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized", code: "TOKEN_MISSING" });
    return;
  }
  if (!header) {
    res.status(401).json({ error: "Unauthorized", code: "TOKEN_MISSING" });
    return;
  }
  try {
    const token = header.replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token);
    const role = String(payload.role ?? "");
    if (role === "ADMIN" || role === "SUPPORT") {
      setRequestPrincipal({ userId: payload.id ?? null, tenantId: payload.tenantId ?? null });
      next();
      return;
    }
  } catch {
    // Token inválido o expirado: cae al 403 de abajo.
  }
  res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
};

/** Handler de `/metrics` con gauges operativos refrescados al vuelo. */
export const metricsHandler = (
  readers?: { emailQueueDepth: () => Promise<number>; queueDepths?: () => Promise<Record<string, number>>; isWorkerLeader?: () => boolean }
) => async (_req: Request, res: Response): Promise<void> => {
  if (readers) await refreshOperationalGauges(readers);
  res.setHeader("Content-Type", metricsContentType());
  res.status(200).end(await renderMetrics());
};
