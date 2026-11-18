import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { clientVersionOf } from "../config/version";
import { ZodError } from "zod";
import {
  currentLanguage,
  languageFromHeader,
  t,
  translateValidation,
  type ErrorCode,
  type Language,
  type MessageParams,
} from "../i18n";

export class HttpError extends Error {
  /**
   * `code` es estable y legible por máquina (UPPER_SNAKE): el cliente distingue
   * errores de flujo (INVALID_CREDENTIALS, ACCOUNT_DEACTIVATED) sin parsear
   * mensajes. El mensaje se traduce al responder, en el idioma de la petición;
   * `message` queda en inglés para los logs.
   */
  constructor(
    public status: number,
    public readonly code: ErrorCode,
    public readonly params: MessageParams = {},
    public details?: unknown
  ) {
    super(t(`errors.${code}`, params, "en"));
    this.name = "HttpError";
  }
}

const languageOf = (req: Request): Language =>
  languageFromHeader(req.headers["accept-language"]) ?? currentLanguage();

/**
 * Errores del parseo del cuerpo (body-parser): JSON malformado o un
 * `Content-Type` que no corresponde a lo que se envió. Traen su propio 4xx en
 * `err.status`, así que se responden como error del cliente en vez de caer al
 * 500 genérico (que además ensuciaba los logs con un stack por una petición mal
 * armada).
 */
const bodyParserError = (err: unknown): { status: number } | null => {
  if (typeof err !== "object" || err === null) return null;
  const candidate = err as { type?: string; status?: number; statusCode?: number };
  if (candidate.type !== "entity.parse.failed" && candidate.type !== "entity.verify.failed") {
    return null;
  }
  const status = candidate.status ?? candidate.statusCode ?? 400;
  return status >= 400 && status <= 499 ? { status } : null;
};

/**
 * Diccionario de soporte (`docs/CODIGOS_DE_ERROR.md`): los errores técnicos no
 * se explican al usuario; se le muestra `[AX-NN]` y un mensaje amable, y
 * soporte busca ese código en el log. Los errores de negocio no llevan código.
 */
export const SUPPORT_CODES: Partial<Record<ErrorCode, string>> = {
  DATABASE_UNAVAILABLE: "AX-01",
  DATABASE_TIMEOUT: "AX-02",
  DATABASE_ERROR: "AX-03",
  INTERNAL_ERROR: "AX-04",
  INVALID_BODY: "AX-05",
  ROUTE_NOT_FOUND: "AX-05",
  STORAGE_NOT_CONFIGURED: "AX-06",
  ABLY_NOT_CONFIGURED: "AX-06",
  ABLY_TOKEN_FAILED: "AX-06",
};

/** Prisma no alcanzó la base o se cayó la conexión. */
const UNREACHABLE = new Set(["P1001", "P1002", "P1017"]);
/** La base tardó demasiado: pool agotado, operación o transacción vencida. */
const TIMEOUT = new Set(["P1008", "P2024", "P2028"]);

/**
 * Traduce errores conocidos de Prisma sin filtrar `err.meta` crudo: solo P2002
 * conserva `target` (los nombres de campo los usa la UI); el resto de `meta`
 * puede traer argumentos de query y datos del registro.
 */
const prismaErrorMapper = (
  err: Prisma.PrismaClientKnownRequestError
): { status: number; code: ErrorCode; details?: unknown } => {
  if (UNREACHABLE.has(err.code)) return { status: 503, code: "DATABASE_UNAVAILABLE" };
  if (TIMEOUT.has(err.code)) return { status: 503, code: "DATABASE_TIMEOUT" };
  switch (err.code) {
    case "P2002":
      return { status: 409, code: "DUPLICATE_RECORD", details: { target: err.meta?.target } };
    case "P2025":
      return { status: 404, code: "RECORD_NOT_FOUND" };
    case "P2003":
      return { status: 400, code: "INVALID_REFERENCE" };
    default:
      return { status: 500, code: "DATABASE_ERROR" };
  }
};

const isPrismaFailure = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientUnknownRequestError ||
  err instanceof Prisma.PrismaClientRustPanicError ||
  err instanceof Prisma.PrismaClientValidationError;

/** Responde `{ error, code, message, supportCode?, details? }`; con código de soporte, el mensaje lo lleva al frente. */
const send = (
  res: Response,
  lng: Language,
  status: number,
  error: string,
  code: ErrorCode,
  params: MessageParams = {},
  details?: unknown
): void => {
  const supportCode = SUPPORT_CODES[code];
  const text = t(`errors.${code}`, params, lng);
  res.status(status).json({
    error,
    code,
    message: supportCode ? `[${supportCode}] ${text}` : text,
    ...(supportCode ? { supportCode } : {}),
    ...(details !== undefined ? { details } : {}),
  });
};

/** Línea de log de un error técnico: el código de soporte primero para buscarlo. */
const logTechnical = (req: Request, code: ErrorCode, detail: string): void => {
  const client = clientVersionOf(req.headers["x-client-version"]);
  logger.error(`[${SUPPORT_CODES[code] ?? code}] ${req.method} ${req.path}${client ? ` (${client})` : ""} → ${detail}`);
};

export const notFoundMiddleware = (req: Request, res: Response, _next: NextFunction): void => {
  logger.warn(`[${SUPPORT_CODES.ROUTE_NOT_FOUND}] ruta inexistente ${req.method} ${req.path}`);
  send(res, languageOf(req), 404, "NotFoundError", "ROUTE_NOT_FOUND");
};

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const lng = languageOf(req);

  const bodyError = bodyParserError(err);
  if (bodyError) {
    logger.warn(`[${SUPPORT_CODES.INVALID_BODY}] cuerpo ilegible ${req.method} ${req.path}`);
    send(res, lng, bodyError.status, "InvalidBody", "INVALID_BODY");
    return;
  }

  if (err instanceof ZodError) {
    send(res, lng, 400, "ValidationError", "VALIDATION_ERROR", {}, err.flatten((issue) => translateValidation(issue.message, lng)));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaErrorMapper(err);
    if (mapped.status >= 500) logTechnical(req, mapped.code, `Prisma ${err.code}: ${err.message}`);
    send(res, lng, mapped.status, "PrismaError", mapped.code, {}, mapped.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    logTechnical(req, "DATABASE_UNAVAILABLE", `Prisma ${err.errorCode ?? "init"}: ${err.message}`);
    send(res, lng, 503, "PrismaError", "DATABASE_UNAVAILABLE");
    return;
  }

  if (isPrismaFailure(err)) {
    logTechnical(req, "DATABASE_ERROR", err.stack ?? err.message);
    send(res, lng, 500, "PrismaError", "DATABASE_ERROR");
    return;
  }

  if (err instanceof HttpError) {
    if (SUPPORT_CODES[err.code]) logTechnical(req, err.code, err.message);
    send(res, lng, err.status, err.name, err.code, err.params, err.details);
    return;
  }

  // El 500 no devuelve el mensaje interno: puede traer hosts, claves de S3,
  // argumentos de Prisma o datos de la BD. El detalle queda solo en el log,
  // con método y ruta (sin query, que puede llevar tokens de foto) y el
  // request-id que agrega el logger desde el contexto de la petición.
  logTechnical(req, "INTERNAL_ERROR", err.stack ?? err.message);
  send(res, lng, 500, "InternalServerError", "INTERNAL_ERROR");
};
