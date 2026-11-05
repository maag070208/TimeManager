import { API_CONSTANTS } from "@shared/api/constants/API_CONSTANTS";

/**
 * Resuelve el `photoUrl` que emite el API para la foto del expediente.
 *
 * F1C-01: el API ya no devuelve una URL pública de S3. Devuelve una ruta
 * relativa a su base, con la credencial firmada de corta vida embebida
 * (`/hr/:id/photo/raw?token=...`), que sirve tanto para `<img src>` como para
 * `fetch()` same-origin sin headers. Aquí se le antepone la base real del API
 * (en producción puede ser absoluta vía config de runtime).
 */
export const resolvePhotoUrl = (photoUrl?: string | null): string | null => {
  if (!photoUrl) return null;
  // Ya viene absoluta (p. ej. un blob: o una URL de otro origen): se respeta.
  if (/^(https?:|blob:|data:)/i.test(photoUrl)) return photoUrl;
  return `${API_CONSTANTS.BASE_URL}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`;
};
