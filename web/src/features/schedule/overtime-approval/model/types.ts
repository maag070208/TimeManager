import type { OvertimePdfPayload } from "@entities/overtime";

/**
 * Generador del PDF de tiempo extra. Se inyecta por prop desde la página
 * (`@widgets/reports`) para que la feature no dependa de `@widgets/*`.
 */
export type DownloadOvertimePdf = (payload: OvertimePdfPayload) => Promise<void>;
