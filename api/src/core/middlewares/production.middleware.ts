import type { NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
  const context = { requestId, ip: req.ip ?? null, userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null, queries: 0 };
  // El log de la petición (morgan) lee de aquí cuántas consultas hizo.
  res.locals.requestContext = context;
  runWithRequestContext(context, next);
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

/** Rutas caras/ingesta con tope además del de IP: /query, sync, import, ingest y push del agente. */
const RATE_LIMITED_SUFFIXES = ["/query", "/sync", "/import", "/ingest", "/punches"];

/**
 * Subidas con multer en memoria (`POST /hr/:id/documents`, `POST /hr/:id/photo`).
 * Solo se limitan las escrituras: los GET de descarga (`/:id/documents/:docId/download`,
 * `/photo/raw`) no pasan por aquí o no terminan en estos sufijos, para no
 * devolver 429 al pintar fotos en una lista.
 */
const RATE_LIMITED_UPLOAD_SUFFIXES = ["/documents", "/photo"];

/** `true` si la ruta lleva tope de rate limit (en subidas, solo escrituras). */
export const isRateLimitedPath = (path: string, method: string): boolean => {
  if (RATE_LIMITED_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true;
  return method === "POST" && RATE_LIMITED_UPLOAD_SUFFIXES.some((suffix) => path.endsWith(suffix));
};

/** Aplica el tope a las rutas caras/ingesta y a las subidas. */
export const queryPathsRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (isRateLimitedPath(req.path, req.method)) {
    queryRateLimiter(req, res, next);
    return;
  }
  next();
};

/**
 * Clave del rate limit por cliente (F4-02): `tenant:<id>` si el token (aún sin
 * validar contra la BD: aquí solo se limita) trae cliente; si no,
 * `ip:<ip>` (plataforma sin cliente y anónimos). Barato: no toca la BD.
 */
export const tenantRateLimitKey = (req: Pick<Request, "headers" | "ip">): string => {
  const header = req.headers.authorization;
  if (typeof header === "string") {
    try {
      const token = header.replace(/^Bearer\s+/i, "").trim();
      const payload = verifyToken(token) as { tenantId?: string | null };
      if (typeof payload.tenantId === "string" && payload.tenantId !== "") {
        return `tenant:${payload.tenantId}`;
      }
    } catch {
      // Token inválido/vencido: se limita por IP; `authenticate` responderá 401.
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

/** Tope por cliente (independiente del de IP). */
export const tenantQueryRateLimiter = rateLimit({
  ...baseOptions,
  limit: config.RATE_LIMIT_PER_TENANT,
  keyGenerator: tenantRateLimitKey,
  validate: {
    ...baseOptions.validate,
    keyGeneratorIpFallback: false,
  },
});

export const tenantQueryPathsRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (isRateLimitedPath(req.path, req.method)) {
    tenantQueryRateLimiter(req, res, next);
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
