import * as QRCode from "qrcode";
import type { PersonalProfile } from "@entities/hr";
import { PDF_COLORS } from "@shared/pdf/theme";
import { buildQrPayload, serializeQrPayload } from "./buildQrPayload";

/**
 * Píxeles de origen por módulo del QR. El símbolo se genera nítido a esta
 * escala y luego se reduce al tamaño de la credencial sin suavizado (ver
 * `renderCredencial`), para que los módulos conserven sus bordes duros.
 */
const QR_PIXEL_SCALE = 12;

export const generateCredentialQr = async (profile: PersonalProfile): Promise<string> => {
  const text = serializeQrPayload(buildQrPayload(profile));
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return QRCode.toDataURL(text, {
    width: modules.size * QR_PIXEL_SCALE,
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: PDF_COLORS.band, light: PDF_COLORS.white },
  });
};

export const photoAsDataUrl = async (
  photoUrl?: string | null
): Promise<string | null> => {
  if (!photoUrl) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[credential] empty photoUrl: the profile has no photoKey/photoUrl");
    }
    return null;
  }
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[credential] fetch failed: ${res.status} ${res.statusText}`);
      }
      return null;
    }
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("[credential] FileReader onerror");
        }
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[credential] exception loading the photo:", err);
    }
    return null;
  }
};

export const initialsOf = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean);
  const prefix = parts.slice(0, 2);
  if (!prefix.length) return "—";
  return prefix
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
};
