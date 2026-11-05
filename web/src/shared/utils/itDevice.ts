// Helpers para dispositivos TIC (PC / TABLET / LAPTOP) y validación de specs.

export const IT_DEVICE_CODES = ["PC", "TABLET", "LAPTOP"] as const;
export type ITDeviceCode = (typeof IT_DEVICE_CODES)[number];

export const isITDeviceCode = (
  code?: string | null
): code is ITDeviceCode =>
  !!code && (IT_DEVICE_CODES as readonly string[]).includes(code);

// Validadores ────────────────────────────────────────────────────────
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;
// IPv6 (formas comunes: 8 grupos, doble dos puntos, ::1, ::)
const IPV6_REGEX =
  /^(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}$|^::1?$|^::$|^(?:[0-9A-Fa-f]{1,4}:){1,7}:$|^(?:[0-9A-Fa-f]{1,4}:){1,6}(?::[0-9A-Fa-f]{1,4}){1,6}$/;

export const isValidMac = (m: string): boolean =>
  !!m && MAC_REGEX.test(m.trim());

export const isValidIPv4 = (ip: string): boolean =>
  !!ip && IPV4_REGEX.test(ip.trim());

export const isValidIPv6 = (ip: string): boolean =>
  !!ip && IPV6_REGEX.test(ip.trim());

export const isValidIP = (ip: string): boolean =>
  isValidIPv4(ip) || isValidIPv6(ip);

export const formatMacInput = (raw: string): string => {
  // Inserta ":" cada 2 caracteres hex y limita a 17 chars (AA:BB:CC:DD:EE:FF)
  const cleaned = raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase().slice(0, 12);
  return cleaned.replace(/(.{2})/g, "$1:").slice(0, 17).replace(/:$/, "");
};
