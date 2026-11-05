import { saveAs } from "file-saver";
import type { PersonalProfile } from "@entities/hr";
import { CREDENTIAL_DPI, CREDENTIAL_H_PX, CREDENTIAL_W_PX } from "./cardSpec";
import { drawCredential } from "./renderCredential";
import { setPngDpi } from "./pngDpi";
import { fileName, i18n } from "@shared/i18n";

export interface CredentialImageInput {
  profile: PersonalProfile;
  qrDataUrl: string | null;
  photoDataUrl: string | null;
  initials: string;
}

/** Convierte un dataURL base64 en bytes crudos. */
const dataUrlABytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Renderiza la credencial en un canvas fuera de pantalla y devuelve su PNG como
 * dataURL. La imagen sale a 1016 × 638 px (8.6 × 5.4 cm a 300 DPI).
 */
export const credentialDataUrl = async (input: CredentialImageInput): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = CREDENTIAL_W_PX;
  canvas.height = CREDENTIAL_H_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error(i18n.t("employees:credential.renderError"));
  }

  await drawCredential(ctx, { ...input, year: new Date().getFullYear() });
  return canvas.toDataURL("image/png");
};

/**
 * Descarga la credencial como PNG `credencial-<numeroEmpleado|id>.png`, con la
 * densidad física (300 DPI) incrustada para que conserve el tamaño de una INE.
 */
export const downloadCredentialImage = async ({
  profile,
  imageDataUrl,
}: {
  profile: PersonalProfile;
  imageDataUrl: string;
}): Promise<void> => {
  const bytes = setPngDpi(dataUrlABytes(imageDataUrl), CREDENTIAL_DPI);
  const blob = new Blob([bytes], { type: "image/png" });
  saveAs(blob, `${fileName("credential")}-${profile.employeeNumber ?? profile.id}.png`);
};
