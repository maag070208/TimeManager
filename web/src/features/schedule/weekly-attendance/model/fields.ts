import type { ClientFields } from "@shared/api/clientTable";
import type { WeeklyAttendanceDetailRow, WeeklyAttendanceRow } from "@entities/schedule";

/**
 * Cómo filtra y ordena cada vista de la tabla de Nómina. Lo comparten la tabla
 * (client-side) y el export, para que el PDF salga con los mismos filtros de
 * columna y el mismo orden que se ve en pantalla.
 */
export const summaryFields: ClientFields<WeeklyAttendanceRow> = {
  name: { value: (r) => [r.name, r.employeeNumber ?? "", ...r.clockNumbers].join(" ") },
  scheduleName: { value: (r) => r.scheduleName ?? "" },
};

export const detailFields: ClientFields<WeeklyAttendanceDetailRow> = {
  name: { value: (r) => [r.name, r.clock].join(" ") },
  day: { value: (r) => r.day.date, match: "date" },
  "day.status": { value: (r) => r.day.status, match: "equals" },
  "day.shift": { value: (r) => r.day.shift ?? "" },
};
