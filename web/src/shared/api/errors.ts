import i18n from "i18next";

/**
 * Códigos de soporte que genera el cliente cuando el API no pudo contestar
 * (los AX-01…AX-06 los manda el API). Diccionario: `docs/CODIGOS_DE_ERROR.md`.
 */
export type ClientSupportCode = "AX-10" | "AX-11" | "AX-12" | "AX-13" | "AX-14";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;
  readonly code?: string;
  readonly supportCode?: string;

  constructor(status: number, message: string, details?: unknown, code?: string, supportCode?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = code;
    this.supportCode = supportCode;
  }
}

/** Validación local con un texto pensado para la persona: se muestra tal cual. */
export class UserMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserMessageError";
  }
}

export const supportMessage = (code: ClientSupportCode): string =>
  `[${code}] ${i18n.t(`common:errors.support.${code}`)}`;

/**
 * Lo único que se le muestra a la persona de un error: el mensaje del API (ya
 * amable, con su código AX si es técnico) o el de una validación local. Todo
 * lo demás (excepciones de JS, librerías) se vuelve AX-14, con el texto de la
 * pantalla si lo hay.
 */
export const errorMessage = (cause: unknown, fallback?: string): string => {
  if (cause instanceof ApiError || cause instanceof UserMessageError) return cause.message;
  return fallback ? `[AX-14] ${fallback}` : supportMessage("AX-14");
};

const UNAVAILABLE = new Set([502, 503, 504]);

interface AxiosLike {
  code?: string;
  response?: { status?: number; data?: unknown };
}

const apiPayload = (data: unknown): { message: string; code?: string; supportCode?: string } | null => {
  if (typeof data !== "object" || data === null) return null;
  const payload = data as { message?: unknown; code?: unknown; supportCode?: unknown };
  if (typeof payload.message !== "string" || !payload.message) return null;
  return {
    message: payload.message,
    code: typeof payload.code === "string" ? payload.code : undefined,
    supportCode: typeof payload.supportCode === "string" ? payload.supportCode : undefined,
  };
};

/**
 * Error de axios → `ApiError` que se puede mostrar. Si el API contestó con su
 * contrato `{ code, message }` se usa tal cual; si no hubo respuesta o la
 * respuesta no es del API (proxy, despliegue, HTML), se usa un código AX del
 * cliente en lugar de textos como «Network Error» o «status code 502».
 */
export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  const { code, response } = (error ?? {}) as AxiosLike;
  const status = response?.status ?? 0;
  const payload = apiPayload(response?.data);
  if (payload) return new ApiError(status, payload.message, response?.data, payload.code, payload.supportCode);

  const supportCode: ClientSupportCode = !response
    ? code === "ECONNABORTED" || code === "ETIMEDOUT"
      ? "AX-11"
      : "AX-10"
    : UNAVAILABLE.has(status)
      ? "AX-12"
      : "AX-13";
  return new ApiError(status, supportMessage(supportCode), undefined, code === "ERR_CANCELED" ? "CANCELED" : undefined, supportCode);
};
