import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@core/config/env.config";
import { logger } from "@core/utils/logger";

/**
 * Cifrado simétrico para secretos en reposo (p. ej. la contraseña del reloj).
 *
 * AES-256-GCM: el payload guarda versión, IV, tag y texto cifrado. La clave
 * sale de `ENCRYPTION_KEY` (base64, 32 bytes) y, si no está definida, se deriva
 * de `JWT_SECRET` con HKDF-SHA256 para no romper instalaciones existentes
 * (queda un warning claro una sola vez). Rotar `JWT_SECRET` en una instalación
 * que dependa de la derivada deja ilegibles los secretos ya guardados.
 */
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PAYLOAD_VERSION = "v1";
const HKDF_SALT = "timemanager";
const HKDF_INFO = "clock-credentials/aes-256-gcm";

export interface SecretKeyOptions {
  /** Clave en base64 (32 bytes). `null` fuerza el camino de derivación. */
  encryptionKey?: string | null;
  /** Secreto del que derivar cuando no hay `encryptionKey`. */
  jwtSecret?: string;
}

/** El payload no es válido o no se puede autenticar con la clave actual. */
export class SecretDecryptionError extends Error {
  constructor() {
    super("The encrypted secret is invalid or was encrypted with another key");
    this.name = "SecretDecryptionError";
  }
}

let warnedDerivedKey = false;

const warningDerivedKey = (): void => {
  if (warnedDerivedKey) return;
  warnedDerivedKey = true;
  logger.warn(
    "[crypto] ENCRYPTION_KEY is not set: deriving the AES-256-GCM key from JWT_SECRET (HKDF-SHA256). " +
      "Set ENCRYPTION_KEY (base64, 32 bytes) before storing secrets; rotating JWT_SECRET will make the stored secrets unreadable."
  );
};

/** Valida y decodifica una `ENCRYPTION_KEY` en base64. */
export const keyFromEncryptionKey = (value: string): Buffer => {
  const text = value.trim();
  const validBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(text) && text.length % 4 === 0;
  const key = validBase64 ? Buffer.from(text, "base64") : Buffer.alloc(0);
  if (!validBase64 || key.length !== KEY_BYTES) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes encoded in base64");
  }
  return key;
};

/** Clave derivada de `JWT_SECRET`, estable entre reinicios. */
export const deriveKeyFromJwtSecret = (jwtSecret: string): Buffer =>
  Buffer.from(
    hkdfSync("sha256", Buffer.from(jwtSecret, "utf8"), Buffer.from(HKDF_SALT, "utf8"), Buffer.from(HKDF_INFO, "utf8"), KEY_BYTES)
  );

/** `encryptionKey` explícito (aunque sea `null`) manda sobre el entorno. */
const resolveKey = (options: SecretKeyOptions): Buffer => {
  const encryptionKey = "encryptionKey" in options ? options.encryptionKey : env.ENCRYPTION_KEY;
  if (encryptionKey) return keyFromEncryptionKey(encryptionKey);
  const jwtSecret = options.jwtSecret ?? env.JWT_SECRET;
  if (!jwtSecret) throw new Error("No key material: set ENCRYPTION_KEY or JWT_SECRET");
  warningDerivedKey();
  return deriveKeyFromJwtSecret(jwtSecret);
};

/** Cifra un secreto. El resultado se puede guardar tal cual en la base. */
export const encryptSecret = (plain: string, options: SecretKeyOptions = {}): string => {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("encryptSecret: a non-empty plain text is required");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, resolveKey(options), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PAYLOAD_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
};

/**
 * Descifra un payload de `encryptSecret`. Lanza `SecretDecryptionError` si está
 * manipulado, truncado o cifrado con otra clave; nunca incluye el secreto en
 * el mensaje.
 */
export const decryptSecret = (payload: string, options: SecretKeyOptions = {}): string => {
  const parts = typeof payload === "string" ? payload.split(".") : [];
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) throw new SecretDecryptionError();
  const [, ivPart, tagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) {
    throw new SecretDecryptionError();
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, resolveKey(options), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretDecryptionError();
  }
};
