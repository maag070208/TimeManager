import type { TFunction } from "i18next";
import type { PayrollClosureRow } from "@entities/schedule";

/**
 * Constructor puro del CSV de un cierre de pre-nómina (PAY-02), sin i18n fijo ni
 * DOM: recibe la función de traducción y devuelve el texto CSV. Así se puede
 * probar con `node --test` y la descarga queda en `payrollClosureCsv.ts`.
 */

/** Minutos → horas decimales con dos decimales (`8.55`). */
export const formatHours = (minutes: number): string => (minutes / 60).toFixed(2);

/** Celda CSV entre comillas, duplicando las comillas internas. */
export const csvEscape = (cell: unknown): string =>
  `"${String(cell ?? "").replace(/"/g, '""')}"`;

/**
 * CSV del cierre: detalle por persona agrupado por departamento si la
 * fotografía guardó personas; si no, solo el resumen por departamento. Cierra
 * con los totales de la semana y usa `\r\n` (Excel).
 */
export const buildPayrollClosureCsv = (
  closure: PayrollClosureRow,
  t: TFunction<any>
): string => {
  const departments = closure.snapshot?.departments ?? [];
  if (departments.length === 0) return "";

  const summary = closure.snapshot?.summary;
  const people = closure.snapshot?.people ?? [];
  const lines: unknown[][] = [];

  if (people.length > 0) {
    lines.push([
      t("deptTable.department"),
      t("columns.employee"),
      t("columns.code"),
      t("columns.hours"),
      t("columns.overtime"),
      t("columns.approved"),
      t("columns.absences"),
    ]);
    for (const dept of departments) {
      for (const person of people.filter((p) => p.departmentId === dept.departmentId)) {
        lines.push([
          dept.name,
          person.name,
          person.clock,
          formatHours(person.workedMin),
          formatHours(person.extraMin),
          formatHours(person.approvedExtraMin),
          person.absences,
        ]);
      }
      lines.push([
        dept.name,
        t("columns.total"),
        "",
        formatHours(dept.normalMin + dept.extraMin),
        formatHours(dept.extraMin),
        formatHours(dept.approvedExtraMin),
        dept.absences,
      ]);
    }
    if (summary) {
      lines.push([
        t("columns.total"),
        "",
        "",
        summary.workedMin !== undefined ? formatHours(summary.workedMin) : "",
        summary.extraMin !== undefined ? formatHours(summary.extraMin) : "",
        summary.approvedExtraMin !== undefined ? formatHours(summary.approvedExtraMin) : "",
        summary.absences ?? "",
      ]);
    }
  } else {
    lines.push([
      t("deptTable.department"),
      t("deptTable.people"),
      t("deptTable.normalHours"),
      t("deptTable.extraHours"),
      t("deptTable.absences"),
    ]);
    for (const dept of departments) {
      lines.push([dept.name, dept.people, formatHours(dept.normalMin), formatHours(dept.extraMin), dept.absences]);
    }
    if (summary) {
      lines.push([
        t("columns.total"),
        summary.people ?? "",
        summary.workedMin !== undefined ? formatHours(summary.workedMin) : "",
        summary.approvedExtraMin !== undefined ? formatHours(summary.approvedExtraMin) : "",
        summary.absences ?? "",
      ]);
    }
  }

  return lines.map((row) => row.map(csvEscape).join(",")).join("\r\n");
};
