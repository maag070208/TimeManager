import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env as config } from "@core/config/env.config";
import { corsOrigin } from "@core/config/cors-origin";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "@core/middlewares/error.middleware";
import { metricsMiddleware } from "@core/observability/metrics";
import { currentRequestContext } from "@core/observability/request-context";
import {
  loginRateLimiter,
  metricsAuth,
  metricsHandler,
  queryPathsRateLimiter,
  requestContextMiddleware,
} from "@core/middlewares/production.middleware";
import { emailQueueDepth } from "@core/services/email-queue";
import { setupSwagger } from "@core/swagger/setup";
import { languageMiddleware } from "@core/i18n";
import apiRouter from "@modules/api.router";

/** `trust proxy` (Railway/LB): número de saltos, IPs o lista separada por comas. */
const trustProxyValue = (raw: string): boolean | number | string | string[] => {
  const value = raw.trim();
  if (value === "") return 1; // un salto (Railway) es el caso normal en producción
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value.split(",").map((part) => part.trim());
};

// Id de correlación en el access log (morgan no lo conoce por defecto).
morgan.token("reqid", () => currentRequestContext()?.requestId ?? "-");

export const createApp = () => {
  const app = express();
  app.set("trust proxy", trustProxyValue(config.TRUST_PROXY));
  app.disable("x-powered-by");

  // Correlación (request-id) antes que todo: logs y métricas lo usan.
  app.use(requestContextMiddleware());
  app.use(metricsMiddleware());

  app.use([
    cors({
      origin: corsOrigin(config.WEB_ORIGIN),
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    }),
    // gzip/br para respuestas JSON grandes (asistencia, reportes).
    compression(),
    express.json({ limit: config.BODY_LIMIT }),
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
    }),
    morgan(config.NODE_ENV === "development" ? "dev" : ":method :url :status :response-time ms req=:reqid", {
      stream: { write: (line: string) => process.stdout.write(line) },
    }),
  ]);

  setupSwagger(app);

  // Métricas Prometheus (antes del router): protegidas y fuera de /api/v1.
  // Se expone también bajo /api/v1/metrics para clientes que solo conocen la
  // base del API (mismo handler y misma protección).
  app.get("/metrics", metricsAuth, metricsHandler({ emailQueueDepth }));
  app.get("/api/v1/metrics", metricsAuth, metricsHandler({ emailQueueDepth }));

  // Rate limiting: login estricto y consultas caras (store en memoria hoy).
  app.use("/api/v1/auth/login", loginRateLimiter);
  app.use("/api/v1", queryPathsRateLimiter);

  // Idioma de la respuesta: Accept-Language → sys_config LANGUAGE → es.
  app.use("/api/v1", languageMiddleware, apiRouter);

  app.get("/", (_req, res) => {
    res.json({
      name: "ptnv-api",
      version: "1.0.0",
      docs: "/docs",
    });
  });

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
