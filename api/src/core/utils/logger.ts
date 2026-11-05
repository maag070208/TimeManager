import winston from "winston";
import { env } from "@core/config/env.config";
import { currentRequestContext } from "@core/observability/request-context";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/**
 * Logs con correlación (F4-03): en producción JSON con `requestId`, `userId` y
 * `tenantId` del contexto de la petición; en desarrollo, la línea coloreada de
 * siempre con el request-id al final.
 */
const withRequestContext = winston.format((info) => {
  const context = currentRequestContext();
  if (context) {
    info.requestId = context.requestId;
    if (context.userId) info.userId = context.userId;
    if (context.tenantId) info.tenantId = context.tenantId;
  }
  return info;
});

const textFormat = printf(({ level, message, timestamp: ts, requestId }) => {
  return `${ts} [${level}] ${message}${requestId ? ` (req ${requestId})` : ""}`;
});

const structured = env.LOG_JSON === "true";

export const logger = winston.createLogger({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  defaultMeta: { service: "timemanager-api" },
  format: structured
    ? combine(errors({ stack: true }), withRequestContext(), timestamp(), json())
    : combine(colorize(), timestamp({ format: "HH:mm:ss" }), withRequestContext(), textFormat),
  transports: [new winston.transports.Console()],
});
