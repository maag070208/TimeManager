import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@core/config/env.config";

export type UserRole = string;

export interface JwtPayload {
  id: string;
  username: string;
  /** Rol principal. */
  role: string;
  /** Roles adicionales (multi-rol). */
  roles?: string[];
  departmentId?: string | null;
  /** Cliente del usuario; `null`/ausente = usuario de plataforma. */
  tenantId?: string | null;
  /** Excepciones de permiso vigentes (Fase 2). */
  exceptions?: Array<{
    permission: string;
    scope: "NONE" | "OWN" | "AREA" | "ALL";
    expiresAt?: Date | null;
  }>;
}

export const hashPassword = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, 10);

export const comparePassword = async (
  plain: string,
  hash: string
): Promise<boolean> => bcrypt.compare(plain, hash);

export const signToken = (payload: JwtPayload): string => {
  const opts: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, opts);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

/** Payload del refresh token: solo identifica; no lleva rol ni permisos. */
export interface RefreshPayload {
  id: string;
  username: string;
  /** Cliente contra el que se emitió; el de la BD manda al renovar. */
  tenantId?: string | null;
  type: "refresh";
}

/** Firma un refresh token de vida larga (endurecimiento: access corto + refresh). */
export const signRefreshToken = (payload: { id: string; username: string; tenantId?: string | null }): string => {
  const opts: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, opts);
};

/** Verifica un refresh token y exige el claim `type: "refresh"`. */
export const verifyRefreshToken = (token: string): RefreshPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET) as RefreshPayload;
  if (payload.type !== "refresh") throw new Error("NOT_A_REFRESH_TOKEN");
  return payload;
};

/** ¿El token es un refresh (no sirve como access)? */
export const isRefreshToken = (payload: unknown): boolean =>
  typeof payload === "object" && payload !== null && (payload as { type?: string }).type === "refresh";

/**
 * Credencial de corta vida para leer la foto del empleado (F1C-01).
 *
 * El endpoint `GET /hr/:id/photo/raw` no usa `authenticate` porque la web lo
 * consume desde `<img src>` y `fetch()` same-origin sin headers. El token ES la
 * credencial: un JWT propio, firmado con `JWT_SECRET`, con `sub` = usuario
 * dueño de la foto y `purpose: "photo"`, que caduca en minutos. Así una URL
 * filtrada deja de servir poco después y no abre el resto de la API.
 */
export const PHOTO_TOKEN_EXPIRES_IN = 300;

export interface PhotoTokenPayload {
  sub: string;
  purpose: "photo";
}

/** Firma la credencial de la foto de `userId` (vida corta). */
export const signPhotoToken = (userId: string): string =>
  jwt.sign({ purpose: "photo" }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: PHOTO_TOKEN_EXPIRES_IN,
  });

/** Verifica firma, expiración y que el token sea de propósito `photo`. */
export const verifyPhotoToken = (token: string): PhotoTokenPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>;
  if (payload.purpose !== "photo" || typeof payload.sub !== "string") {
    throw new Error("NOT_A_PHOTO_TOKEN");
  }
  return { sub: payload.sub, purpose: "photo" };
};

/** Fallo de validación de la credencial de foto (se traduce a 401/403 en la ruta). */
export class PhotoTokenError extends Error {
  constructor(public readonly reason: "INVALID" | "FORBIDDEN") {
    super(reason === "FORBIDDEN" ? "PHOTO_TOKEN_SUBJECT_MISMATCH" : "INVALID_PHOTO_TOKEN");
    this.name = "PhotoTokenError";
  }
}

/**
 * Valida el token contra el id de la foto pedida: 401 si la firma/expiración o
 * el propósito no son válidos, 403 si el `sub` no es el dueño de esa foto.
 */
export const assertPhotoToken = (token: string, userId: string): void => {
  let payload: PhotoTokenPayload;
  try {
    payload = verifyPhotoToken(token);
  } catch {
    throw new PhotoTokenError("INVALID");
  }
  if (payload.sub !== userId) throw new PhotoTokenError("FORBIDDEN");
};

/**
 * Ruta relativa a la base del API de la foto firmada. Es el contrato de
 * `photoUrl` (`/hr/:id/photo/raw?token=...`): la web/app le prefijan su base.
 */
export const signedPhotoPath = (userId: string): string =>
  `/hr/${userId}/photo/raw?token=${encodeURIComponent(signPhotoToken(userId))}`;