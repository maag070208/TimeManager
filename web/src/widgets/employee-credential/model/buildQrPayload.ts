import type { PersonalProfile } from "@entities/hr";

/**
 * Payload embebido en el QR de la credencial — esquema v2.
 *
 * Contrato de escaneo: el QR codifica un único objeto JSON en UTF-8 con claves
 * compactas, para que el símbolo quepa en la versión mínima posible:
 *
 *   {
 *     "v": 2,                 // versión del esquema (siempre presente)
 *     "id": "8f3b…",          // UUID del empleado (User.id, siempre presente)
 *     "no": "1234",           // número de empleado (opcional)
 *     "name": "María G. Hernández",  // nombre completo (opcional)
 *     "pos": "Recepcionista", // puesto (opcional)
 *     "dept": "Recepción"     // departamento (opcional)
 *   }
 *
 * Los campos opcionales se omiten cuando vienen nulos o vacíos. `id` es la
 * clave de negocio: identifica al empleado en el sistema.
 */

/** Versión del esquema del payload del QR. */
export const QR_PAYLOAD_VERSION = 2;

export interface CredentialQrPayload {
  v: number;
  id: string;
  no?: string;
  name?: string;
  pos?: string;
  dept?: string;
}

/** Normaliza un campo opcional: recorta espacios y descarta cadenas vacías. */
const clean = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const buildQrPayload = (profile: PersonalProfile): CredentialQrPayload => ({
  v: QR_PAYLOAD_VERSION,
  id: profile.id,
  no: clean(profile.employeeNumber),
  name: clean(profile.name),
  pos: clean(profile.jobTitle),
  dept: clean(profile.department?.name),
});

/**
 * Serializa el payload a JSON omitiendo claves vacías. `v` e `id` siempre van
 * presentes; el orden de claves es estable para que el símbolo sea reproducible.
 */
export const serializeQrPayload = (payload: CredentialQrPayload): string => {
  const data: Record<string, string | number> = {
    v: payload.v,
    id: payload.id,
  };
  if (payload.no) data.no = payload.no;
  if (payload.name) data.name = payload.name;
  if (payload.pos) data.pos = payload.pos;
  if (payload.dept) data.dept = payload.dept;
  return JSON.stringify(data);
};
