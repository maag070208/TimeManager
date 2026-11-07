/**
 * CSV del cierre de pre-nómina (PAY-02 historial): encabezados, detalle por
 * persona, totales por departamento, resumen y escape de celdas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TFunction } from "i18next";
import type { PayrollClosureRow } from "@entities/schedule";
import {
  buildPayrollClosureCsv,
  csvEscape,
  formatHours,
} from "./payrollClosureCsv.core.ts";

const t = ((key: string) => key) as unknown as TFunction;

const closure = (snapshot: PayrollClosureRow["snapshot"]): PayrollClosureRow =>
  ({
    weekStart: "2026-11-02",
    closed: true,
    closedAt: "2026-11-08T18:00:00.000Z",
    closedBy: null,
    reopenedAt: null,
    reopenedBy: null,
    snapshot,
    reviews: [],
  }) as PayrollClosureRow;

const departments = [
  { departmentId: "d1", name: "Operaciones", people: 2, normalMin: 480, extraMin: 60, approvedExtraMin: 30, absences: 1 },
];

test("[PAY-02] csvEscape comillas dobles y usa comillas alrededor de toda celda", () => {
  assert.equal(csvEscape("Ana"), '"Ana"');
  assert.equal(csvEscape('Di "hola"'), '"Di ""hola"""');
  assert.equal(csvEscape(null), '""');
  assert.equal(csvEscape(0), '"0"');
  assert.equal(formatHours(90), "1.50");
});

test("[PAY-02] sin personas: resumen por departamento y total de la semana", () => {
  const csv = buildPayrollClosureCsv(closure({ departments, summary: { people: 2, workedMin: 480, approvedExtraMin: 30, absences: 1 } }), t);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], '"deptTable.department","deptTable.people","deptTable.normalHours","deptTable.extraHours","deptTable.absences"');
  assert.equal(lines[1], '"Operaciones","2","8.00","1.00","1"');
  assert.equal(lines[2], '"columns.total","2","8.00","0.50","1"');
});

test("[PAY-02] con personas: detalle agrupado por departamento y totales", () => {
  const people = [
    { departmentId: "d1", name: "Ana", clock: "0001", workedMin: 480, extraMin: 60, approvedExtraMin: 30, absences: 0 },
    { departmentId: "d2", name: "Beto", clock: "0002", workedMin: 240, extraMin: 0, approvedExtraMin: 0, absences: 1 },
  ];
  const csv = buildPayrollClosureCsv(closure({ departments, people, summary: { workedMin: 720 } }), t);
  const lines = csv.split("\r\n");
  assert.match(lines[0], /columns\.employee/);
  assert.equal(lines[1], '"Operaciones","Ana","0001","8.00","1.00","0.50","0"', "persona de d1");
  assert.equal(lines[2], '"Operaciones","columns.total","","9.00","1.00","0.50","1"', "total de d1");
  assert.equal(lines[3], '"columns.total","","","12.00","","",""', "resumen final");
  assert.ok(!csv.includes("Beto"), "las personas de otro departamento no se listan");
});

test("[PAY-02] sin fotografía de departamentos no se genera CSV", () => {
  assert.equal(buildPayrollClosureCsv(closure({ departments: [] }), t), "");
  assert.equal(buildPayrollClosureCsv(closure(null), t), "");
});
