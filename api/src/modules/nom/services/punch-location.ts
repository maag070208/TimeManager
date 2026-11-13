import { openText, sealText } from "@core/utils/crypto";

export interface PunchLocation {
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
}

interface LocationColumns {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyMeters?: number | null;
}

/** Geolocalización de un marcaje remoto, cifrada en reposo (`remote_punches.location`). */
export const sealLocation = (input: { latitude?: number | null; longitude?: number | null; gpsAccuracyMeters?: number | null }): string | null => {
  if (input.latitude == null || input.longitude == null) return null;
  return sealText(JSON.stringify({ lat: input.latitude, lng: input.longitude, acc: input.gpsAccuracyMeters ?? null }));
};

/** Lee la ubicación cifrada; los marcajes anteriores al cifrado siguen en las columnas numéricas. */
export const openLocation = (row: LocationColumns): PunchLocation | null => {
  const stored = openText(row.location);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { lat?: unknown; lng?: unknown; acc?: unknown };
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return { latitude: parsed.lat, longitude: parsed.lng, gpsAccuracyMeters: typeof parsed.acc === "number" ? parsed.acc : null };
      }
    } catch {
      return null;
    }
    return null;
  }
  if (row.latitude == null || row.longitude == null) return null;
  return { latitude: row.latitude, longitude: row.longitude, gpsAccuracyMeters: row.gpsAccuracyMeters ?? null };
};
