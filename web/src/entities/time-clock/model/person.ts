/** Ficha de una persona del reloj. Solo lectura: huellas como metadatos, nunca plantillas. */

export interface TimeClockPersonDetail {
  employeeNumber: string;
  name: string;
  cards: string[];
  faces: { count: number };
  fingerprints: Array<{ fingerPrintID: number; fingerType: string | null }>;
  link: { status: "ACTIVO" | "BAJA_PENDIENTE"; userId: string; userName: string; userActive: boolean } | null;
  punchesToday: number;
}
