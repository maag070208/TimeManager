import type { NextFunction, Request, Response } from "express";
import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from "prom-client";
import { logger } from "@core/utils/logger";

/**
 * Métricas Prometheus (F4-03): latencia por ruta/método/estado, totales,
 * errores, profundidad de la cola de correo y de pg-boss. Se exponen en
 * `GET /metrics` (protegido: token `METRICS_TOKEN` o JWT de ADMIN/SUPPORT).
 */
let defaultsCollected = false;
const collectDefaults = (): void => {
  if (defaultsCollected) return;
  defaultsCollected = true;
  collectDefaultMetrics({ register, prefix: "timemanager_" });
};

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "HTTP requests processed",
  labelNames: ["method", "route", "status"] as const,
});

export const httpErrorsTotal = new Counter({
  name: "http_errors_total",
  help: "HTTP responses with status >= 500",
  labelNames: ["method", "route"] as const,
});

export const queueDepthGauge = new Gauge({
  name: "queue_depth",
  help: "Pending jobs per queue",
  labelNames: ["queue"] as const,
});

export const workerLeaderGauge = new Gauge({
  name: "worker_leader",
  help: "1 when the worker runtime of this process holds the leader lock",
});

/** Ruta de baja cardinalidad para las etiquetas (sin ids). */
export const normalizedRoute = (req: Request): string => {
  const pattern = req.route?.path;
  if (typeof pattern === "string") return `${req.baseUrl}${pattern === "/" ? "" : pattern}` || "/";
  if (req.baseUrl) return `${req.baseUrl}/*`;
  return "unmatched";
};

/** Middleware: mide la latencia y cuenta la petición al terminar. */
export const metricsMiddleware = () => (req: Request, res: Response, next: NextFunction): void => {
  collectDefaults();
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = normalizedRoute(req);
    const labels = { method: req.method, route, status: String(res.statusCode) };
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
    if (res.statusCode >= 500) httpErrorsTotal.inc({ method: req.method, route });
  });
  next();
};

/** Render Prometheus. */
export const renderMetrics = async (): Promise<string> => {
  collectDefaults();
  return register.metrics();
};

export const metricsContentType = (): string => register.contentType;

/**
 * Actualiza los gauges que dependen de la BD/cola. Nunca lanza: si la lectura
 * falla, las métricas conservan el último valor y el scrape sigue funcionando.
 */
export const refreshOperationalGauges = async (readers: {
  emailQueueDepth: () => Promise<number>;
  queueDepths?: () => Promise<Record<string, number>>;
  isWorkerLeader?: () => boolean;
}): Promise<void> => {
  try {
    queueDepthGauge.set({ queue: "email" }, await readers.emailQueueDepth());
  } catch (err) {
    logger.debug(`[metrics] email queue depth unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (readers.queueDepths) {
    try {
      for (const [queue, depth] of Object.entries(await readers.queueDepths())) {
        queueDepthGauge.set({ queue }, depth);
      }
    } catch (err) {
      logger.debug(`[metrics] pg-boss depth unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (readers.isWorkerLeader) workerLeaderGauge.set(readers.isWorkerLeader() ? 1 : 0);
};
