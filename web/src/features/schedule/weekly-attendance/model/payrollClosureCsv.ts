import { fileName, i18n } from "@shared/i18n";
import type { TFunction } from "i18next";
import type { PayrollClosureRow } from "@entities/schedule";

const fmt = (minutes: number): string => (minutes / 60).toFixed(2);
const escape = (cell: unknown) => `"${String(cell ?? "").replace(/"/g, '""')}"`;

const download = (csv: string, weekStart: string): void => {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName("payroll")}_cierre_${weekStart}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * El "Excel" de un cierre del historial: un CSV (lo abre Excel directo) con el
 * detalle por persona agrupado por departamento (si la fotografía lo guardó;
 * si no, solo el resumen por departamento) y los totales de la semana.
 */
export const downloadPayrollClosureCsv = (closure: PayrollClosureRow): void => {
  const departments = closure.snapshot?.departments ?? [];
  if (departments.length === 0) return;

  // El catálogo de llaves está tipado por namespace; aquí se compone la llave
  // dinámicamente, así que se usa el TFunction sin tipar (como `dyn`).
  const t = i18n.getFixedT(null, "weekly-attendance") as TFunction<any>;
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
          fmt(person.workedMin),
          fmt(person.extraMin),
          fmt(person.approvedExtraMin),
          person.absences,
        ]);
      }
      lines.push([
        dept.name,
        t("columns.total"),
        "",
        fmt(dept.normalMin + dept.extraMin),
        fmt(dept.extraMin),
        fmt(dept.approvedExtraMin),
        dept.absences,
      ]);
    }
    if (summary) {
      lines.push([
        t("columns.total"),
        "",
        "",
        summary.workedMin !== undefined ? fmt(summary.workedMin) : "",
        summary.extraMin !== undefined ? fmt(summary.extraMin) : "",
        summary.approvedExtraMin !== undefined ? fmt(summary.approvedExtraMin) : "",
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
      lines.push([dept.name, dept.people, fmt(dept.normalMin), fmt(dept.extraMin), dept.absences]);
    }
    if (summary) {
      lines.push([
        t("columns.total"),
        summary.people ?? "",
        summary.workedMin !== undefined ? fmt(summary.workedMin) : "",
        summary.approvedExtraMin !== undefined ? fmt(summary.approvedExtraMin) : "",
        summary.absences ?? "",
      ]);
    }
  }

  download(lines.map((row) => row.map(escape).join(",")).join("\r\n"), closure.weekStart);
};
