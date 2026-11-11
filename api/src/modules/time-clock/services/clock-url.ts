import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { env } from "@core/config/env.config";
import { HttpError } from "@core/middlewares/error.middleware";
import { logger } from "@core/utils/logger";

/**
 * Validación del destino de un reloj (y de la estación de huellas). El API hace
 * peticiones a esa dirección con credenciales: si apunta a la red interna del
 * servidor o a los metadatos de la nube, el API se vuelve un proxy SSRF y quien
 * puede dar de alta un reloj (`time_clocks.manage`, el administrador del
 * cliente) alcanza hosts que no le corresponden.
 *
 * Se bloquean SIEMPRE metadatos, enlace local, multicast y direcciones no
 * enrutables. Loopback, RFC1918 y CGNAT se permiten por defecto porque el
 * despliegue principal es on-prem; en la nube se apaga con
 * `CLOCK_ALLOW_PRIVATE_NETWORK=false`.
 */

/** Metadatos IPv6 de AWS: `fd00:ec2::254`. */
const AWS_IMDS_V6 = Buffer.from([0xfd, 0x00, 0x0e, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02, 0x54]);
/** Loopback IPv6: `::1`. */
const LOOPBACK_V6 = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

const invalid = (value: string): HttpError => new HttpError(400, "INVALID_URL", { value });

const ipv4Bytes = (ip: string): number[] | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => Number(part));
  return bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) ? bytes : null;
};

/** Expande `::` y devuelve los 16 bytes; `null` si no es una IPv6 válida. */
const ipv6Bytes = (ip: string): Buffer | null => {
  const text = ip.toLowerCase().split("%")[0];
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  const buffer = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) {
    const group = groups[i];
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    buffer.writeUInt16BE(parseInt(group, 16), i * 2);
  }
  return buffer;
};

const isBlockedV4 = (bytes: number[], allowPrivate: boolean): boolean => {
  const [a, b, c, d] = bytes;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // enlace local y metadatos (169.254.169.254)
  if (a === 100 && b === 100 && c === 100 && d === 200) return true; // metadatos de Alibaba
  if (a >= 224 || a === 255) return true; // multicast, reservado y broadcast
  if (allowPrivate) return false;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
};

const isBlockedV6 = (bytes: Buffer, allowPrivate: boolean): boolean => {
  const first = bytes[0];
  const second = bytes[1];
  // IPv4 embebida (::ffff:a.b.c.d): manda la comprobación de la v4.
  const mapped =
    bytes[10] === 0xff && bytes[11] === 0xff && bytes.subarray(0, 10).every((byte) => byte === 0);
  if (mapped) return isBlockedV4([...bytes.subarray(12)], allowPrivate);
  if (bytes.equals(LOOPBACK_V6)) return !allowPrivate; // ::1 (loopback)
  if (bytes.every((byte) => byte === 0)) return true; // ::
  if (bytes.equals(AWS_IMDS_V6)) return true;
  if (first === 0xff) return true; // multicast
  if (first === 0xfe && (second & 0xc0) === 0x80) return true; // enlace local fe80::/10
  // Rango IPv4-compatible (::a.b.c.d), obsoleto y no enrutable: nunca es un equipo.
  if (bytes.subarray(0, 12).every((byte) => byte === 0)) return true;
  if (allowPrivate) return false;
  return first === 0xfc || first === 0xfd || first === 0xfe; // ULA y site-local
};

/** Host de un origen, sin corchetes (IPv6). */
const hostOf = (origin: string): string => new URL(origin).hostname.replace(/^\[|\]$/g, "");

/** ¿La IP (literal) cae en un rango prohibido? `null` si no es una IP. */
const blockedAddress = (address: string, allowPrivate: boolean): boolean | null => {
  const family = isIP(address);
  if (family === 4) {
    const bytes = ipv4Bytes(address);
    return bytes ? isBlockedV4(bytes, allowPrivate) : null;
  }
  if (family === 6) {
    const bytes = ipv6Bytes(address);
    return bytes ? isBlockedV6(bytes, allowPrivate) : null;
  }
  return null;
};

/**
 * Normaliza la dirección que escribe el administrador a `http(s)://host[:puerto]`
 * y comprueba el destino literal. Devuelve el origen ya validado.
 */
export const normalizeClockUrl = (value: string): string => {
  const text = value.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw invalid(value);
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw invalid(value);
  }
  const origin = url.origin;
  const reason = blockedClockTarget(origin);
  if (reason) {
    logger.warn(`[time-clock] dirección rechazada (${reason}): ${origin}`);
    throw invalid(origin);
  }
  return origin;
};

/**
 * Motivo por el que un origen no puede ser un equipo, o `null` si es aceptable.
 * Es la comprobación síncrona: solo mira la cadena (IP literal o `localhost`).
 */
export const blockedClockTarget = (
  origin: string,
  options: { allowPrivate?: boolean } = {}
): string | null => {
  let host: string;
  try {
    host = hostOf(origin);
  } catch {
    return "origen inválido";
  }
  const allowPrivate = options.allowPrivate ?? env.CLOCK_ALLOW_PRIVATE_NETWORK;
  const blocked = blockedAddress(host, allowPrivate);
  if (blocked === true) return "metadatos, enlace local o rango no enrutable";
  if (blocked === null) {
    const name = host.toLowerCase();
    if (name === "localhost" || name.endsWith(".localhost")) return "localhost";
  }
  return null;
};

/**
 * Resuelve el nombre y devuelve la primera IP prohibida, o `null`. Atrapa el
 * caso de un nombre que apunta a metadatos o a la red privada aunque el texto
 * no lo diga. Si el DNS no responde no se bloquea aquí: la conexión fallará
 * después y su mensaje es más útil para el administrador.
 */
export const resolvedBlockedAddress = async (
  origin: string,
  options: { allowPrivate?: boolean } = {}
): Promise<string | null> => {
  let host: string;
  try {
    host = hostOf(origin);
  } catch {
    return "origen inválido";
  }
  if (isIP(host) !== 0) return null;
  const allowPrivate = options.allowPrivate ?? env.CLOCK_ALLOW_PRIVATE_NETWORK;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return null;
  }
  for (const { address } of addresses) {
    if (blockedAddress(address, allowPrivate) === true) return address;
  }
  return null;
};

/** Alta/edición de un reloj: normaliza y valida el destino completo. */
export const assertClockUrlAllowed = async (value: string): Promise<string> => {
  const origin = normalizeClockUrl(value);
  const blocked = await resolvedBlockedAddress(origin);
  if (blocked) {
    logger.warn(`[time-clock] dirección rechazada (el nombre resuelve a ${blocked}): ${origin}`);
    throw invalid(origin);
  }
  return origin;
};
