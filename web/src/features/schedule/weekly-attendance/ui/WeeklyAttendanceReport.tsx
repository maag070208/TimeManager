import { useMemo, useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITConfirmDialog, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { LuCheckCheck, LuDownload, LuFileSpreadsheet, LuInfo } from "react-icons/lu";
import { dateLocale } from "@shared/i18n";
import { dyn } from "@shared/i18n/dyn";
import { buildDepartmentRows, hoursDecimal } from "@entities/schedule";
import { useCan } from "@entities/user";
import { useDepartmentReviews } from "../model/useDepartmentReviews";
import type { WeeklyAttendanceDay, WeeklyAttendanceDetailRow } from "@entities/schedule";
import type { UseWeeklyAttendance } from "../model/useWeeklyAttendance";

const fmtHours = (minutes: number): string =>
  (minutes / 60).toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const weekdayShort = (isoDate: string): string =>
  new Date(`${isoDate}T12:00:00Z`)
    .toLocaleDateString(dateLocale(), { weekday: "short", timeZone: "UTC" })
    .replace(/\./g, "");

const dayStatus = (day: WeeklyAttendanceDay | undefined) => {
  if (!day) return { text: "—", tone: "muted" as const };
  if (day.status === "NO_INFO") return { text: "S/I", tone: "warning" as const };
  if (day.status === "ABSENCE") return { text: "Falta", tone: "danger" as const };
  if (day.status === "INCOMPLETE") return { text: "S/F", tone: "warning" as const };
  if (day.status === "REST" || day.status === "FUTURE") return { text: "—", tone: "muted" as const };
  if (day.workedMin > 0) {
    return {
      text: day.extraMin > 0 ? `${hoursDecimal(day.workedMin)}+` : hoursDecimal(day.workedMin),
      tone: day.status === "REST_WORKED" ? "success" as const : "success" as const,
    };
  }
  return { text: "—", tone: "muted" as const };
};

const weekLabel = ([start, end]: [Date, Date]): string => {
  const weekday = (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: "short" }).replace(/\./g, "");
  const month = (d: Date) => d.toLocaleDateString(dateLocale(), { month: "short" }).replace(/\./g, "");
  return start.getMonth() === end.getMonth()
    ? `${weekday(start)} ${start.getDate()} – ${weekday(end)} ${end.getDate()} ${month(end)}`
    : `${weekday(start)} ${start.getDate()} ${month(start)} – ${weekday(end)} ${end.getDate()} ${month(end)}`;
};

const toneClass: Record<"muted" | "warning" | "danger" | "success", string> = {
  muted: "text-slate-400",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-800",
};

/**
 * Reporte semanal de prenómina con el diseño de la maqueta: KPIs de la semana
 * y tabla por persona × día (Resumida) o por persona/día (Detallada).
 */
export default function WeeklyAttendanceReport({ fx }: { fx: UseWeeklyAttendance }) {
  const t = dyn(fx.t);
  const report = fx.report;
  const summary = report?.summary;
  const [showLegend, setShowLegend] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [confirmReviewAll, setConfirmReviewAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const departments = fx.departments.data ?? [];

  const departmentRows = useMemo(() => (report ? buildDepartmentRows(report) : []), [report]);
  const reviews = useDepartmentReviews(report?.range.days[0] ?? null);
  const canReview = useCan("payroll.review");
  const canClose = useCan("payroll.close");
  const allReviewed = departmentRows.length > 0 && reviews.reviewedCount >= departmentRows.length;

  const days = report?.range.days ?? [];

  const kpis = useMemo(
    () =>
      summary
        ? [
            {
              label: "Personas",
              value: String(summary.people),
              caption: `${summary.people - summary.unlinked} con reloj`,
              dark: true,
            },
            {
              label: "Horas trabajadas",
              value: fmtHours(summary.workedMin),
              caption: `${fmtHours(summary.scheduledMin)} programadas`,
            },
            {
              label: "HE calculadas",
              value: fmtHours(summary.extraMin),
              caption: `${fmtHours(summary.workedMin)} trabajadas`,
              tone: "amber",
            },
            {
              label: "HE aprobadas",
              value: fmtHours(summary.approvedExtraMin),
              caption: `${summary.extraMin > 0 ? Math.round((summary.approvedExtraMin / summary.extraMin) * 100) : 0}% de lo calculado`,
              tone: "green",
            },
            {
              label: "Faltas",
              value: String(summary.absences),
              caption: `de ${summary.people} personas`,
            },
          ]
        : [],
    [summary, t]
  );

  return (
    <div className="flex flex-col gap-4">
      {fx.error && <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>{fx.error}</ITAlert>}

      {/* Filtros */}
      <div className="grid items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
          Semana
          <div className="flex items-center justify-between gap-1 rounded-lg border border-slate-200 px-1 py-1">
            <button
              type="button"
              aria-label={t("filters.previousWeek")}
              onClick={fx.previousWeek}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              ‹
            </button>
            <span className="px-1 text-[12.5px] font-bold text-slate-800 whitespace-nowrap">{weekLabel(fx.rangeValue)}</span>
            <button
              type="button"
              aria-label={t("filters.nextWeek")}
              onClick={fx.nextWeek}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              ›
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
          Departamento
          <select
            value={fx.departmentId}
            onChange={(event) => fx.setDepartmentId(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800"
          >
            <option value="">{t("filters.allDepartments")}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
          Buscar empleado
          <input
            value={fx.search}
            onChange={(event) => fx.setSearch(event.target.value)}
            placeholder="Nombre o número"
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800"
          />
        </label>
        <div />
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
          <ITBadget color="gray" size="sm">— descanso o sin datos</ITBadget>
          <ITBadget color="warning" size="sm">S/I sin información</ITBadget>
          <ITBadget color="danger" size="sm">Falta</ITBadget>
          <ITBadget color="warning" size="sm">S/F salida sin registrar</ITBadget>
          <ITBadget color="success" size="sm">horas trabajadas · + con tiempo extra</ITBadget>
        </div>
      )}


      {/* Barra de acciones de pre-nómina (como la maqueta) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3">
        <ITText muted className="!text-[12px]">
          {reviews.closed
            ? t("close.closedBy", {
                name: reviews.closure?.closedBy?.name ?? "—",
                date: reviews.closure ? new Date(reviews.closure.closedAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" }) : "",
              })
            : allReviewed
              ? t("close.allReviewed")
              : t("close.note")}
        </ITText>
        <div className="flex flex-wrap items-center gap-2">
          <ITButton variant="outlined" color="secondary" size="sm" onClick={fx.exportPdf} disabled={!report?.rows.length || fx.exporting}>
            <LuDownload size={14} className="mr-1" /> Exportar PDF
          </ITButton>
          <ITButton variant="outlined" color="secondary" size="sm" onClick={fx.exportExcel} disabled={!report?.rows.length}>
            <LuFileSpreadsheet size={14} className="mr-1" /> Exportar Excel
          </ITButton>
          <ITButton variant="filled" color="primary" size="sm" onClick={() => setConfirmReviewAll(true)} disabled={!canReview || reviews.closed || allReviewed}>
            <LuCheckCheck size={14} className="mr-1" /> Verificar toda la pre-nómina
          </ITButton>
          <ITButton variant="outlined" color="secondary" size="sm" onClick={() => setShowDepartments((v) => !v)} disabled={reviews.closed}>
            Verificar por departamento
          </ITButton>
          <ITButton
            variant="filled"
            color="warning"
            size="sm"
            disabled={!allReviewed || !canClose || reviews.busy}
            title={allReviewed ? undefined : t("close.disabled")}
            onClick={() =>
              reviews.close(
                departmentRows.map((row) => row.departmentId),
                {
                  summary,
                  departments: departmentRows,
                  people: (report?.rows ?? []).map((row) => ({
                    departmentId: row.departmentId,
                    name: row.name,
                    clock: row.clockNumbers.join(", ") || row.employeeNumber || "",
                    workedMin: row.totals.workedMin,
                    extraMin: row.totals.extraMin,
                    approvedExtraMin: row.totals.approvedExtraMin,
                    absences: row.totals.absences,
                  })),
                }
              )
            }
          >
            Cerrar pre-nómina
          </ITButton>
        </div>
      </div>

      {showDepartments && (
        <ITCard contentClassName="!p-4">
          <div className="flex flex-col gap-2">
            {departmentRows.map((row) => {
              const reviewed = reviews.isReviewed(row.departmentId);
              return (
                <div key={row.departmentId ?? "none"} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
                  <div>
                    <ITText className="font-semibold !text-[13px]">{row.name}</ITText>
                    <ITText muted className="!text-[11px]">
                      {row.people} personas · {fmtHours(row.normalMin)} h · {row.absences} faltas
                    </ITText>
                  </div>
                  <div className="flex items-center gap-2">
                    <ITBadget color={reviewed ? "success" : "warning"} size="sm">
                      {reviewed ? "Revisado" : "Por revisar"}
                    </ITBadget>
                    {canReview && !reviews.closed && (
                      <ITButton
                        variant="outlined"
                        color="secondary"
                        size="sm"
                        disabled={reviews.busy}
                        onClick={() => reviews.toggle(row.departmentId)}
                      >
                        {reviewed ? "Quitar" : "Marcar revisado"}
                      </ITButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ITCard>
      )}
      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))" }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-2xl border p-4 ${
              kpi.dark
                ? "border-slate-800 bg-[var(--tm-navy,#1d2636)] text-white"
                : kpi.tone === "amber"
                  ? "border-amber-100 bg-amber-50/70"
                  : kpi.tone === "green"
                    ? "border-emerald-100 bg-emerald-50/70"
                    : "border-slate-100 bg-white"
            }`}
          >
            <div className={`flex items-center gap-1.5 text-[11px] font-bold ${kpi.dark ? "text-white/80" : "text-slate-500"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${kpi.dark ? "bg-white/70" : kpi.tone === "amber" ? "bg-amber-400" : kpi.tone === "green" ? "bg-emerald-400" : "bg-slate-400"}`} />
              {kpi.label}
            </div>
            <div className={`mt-1 text-[30px] font-extrabold leading-none tabular-nums ${kpi.dark ? "text-white" : "text-slate-900"}`}>
              {kpi.value}
            </div>
            <div className={`mt-1 text-[11px] font-medium ${kpi.dark ? "text-white/70" : "text-slate-500"}`}>{kpi.caption}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <ITCard className="overflow-hidden !p-0" contentClassName="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ITText className="!text-[15px] font-extrabold">Reporte semanal</ITText>
            <ITBadget color="gray" size="sm">{summary?.people ?? 0}</ITBadget>
            <div className="ml-2 flex gap-1 rounded-full bg-slate-100 p-1">
              {(["SUMMARY", "DETAIL"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => fx.setMode(mode)}
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={fx.mode === mode ? { background: "#1d2636", color: "#fff" } : { color: "#5a6579" }}
                >
                  {mode === "SUMMARY" ? "Resumida" : "Detallada"}
                </button>
              ))}
            </div>
          </div>
          <ITText muted className="!text-[11px]">
            {fmtHours(summary?.workedMin ?? 0)} h · {summary?.absences ?? 0} faltas
          </ITText>
        </div>

        <div className="overflow-x-auto">
          {fx.mode === "SUMMARY" ? (
            <table className="w-full min-w-[900px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Empleado</th>
                  {days.map((day) => (
                    <th key={day} className="px-3 py-3 text-center whitespace-nowrap">
                      {weekdayShort(day)} {day.slice(8, 10)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(report?.rows ?? []).map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600">
                          {row.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-800">{row.name}</div>
                          <div className="truncate text-[10.5px] text-slate-500">
                            {[row.employeeNumber, row.departmentName].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((day, index) => {
                      const cell = dayStatus(row.days[index]);
                      return (
                        <td key={day} className="px-2 py-2.5 text-center">
                          <span className={`inline-flex min-w-11 items-center justify-center rounded-full px-2 py-0.5 font-semibold tabular-nums ${toneClass[cell.tone]}`}>
                            {cell.text}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right">
                      <div className="font-bold text-slate-800">Hrs: {hoursDecimal(row.totals.workedMin)}</div>
                      <div className="text-[10.5px] text-emerald-700">HE aprob.: {hoursDecimal(row.totals.approvedExtraMin)}</div>
                      <div className="text-[10.5px] text-red-600">Faltas: {row.totals.absences}</div>
                    </td>
                  </tr>
                ))}
                {report && report.rows.length === 0 && (
                  <tr>
                    <td colSpan={days.length + 2} className="px-4 py-10 text-center text-slate-500">
                      No hay personas para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-3 py-3">Día</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Entrada</th>
                  <th className="px-3 py-3">Salida</th>
                  <th className="px-3 py-3 text-right">Horas</th>
                </tr>
              </thead>
              <tbody>
                {(fx.detailRows as WeeklyAttendanceDetailRow[]).map((row, index) => {
                  const cell = dayStatus(row.day);
                  return (
                    <tr key={`${row.userId}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-3 py-2 text-slate-600">{row.day.date}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${toneClass[cell.tone]}`}>{cell.text}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{row.day.entryAt ? row.day.entryAt.slice(11, 16) : "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{row.day.exitAt ? row.day.exitAt.slice(11, 16) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{hoursDecimal(row.day.workedMin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </ITCard>

      <ITConfirmDialog
        isOpen={confirmReviewAll}
        onClose={() => setConfirmReviewAll(false)}
        onConfirm={() => {
          reviews.reviewAll(departmentRows.map((row) => row.departmentId));
          setConfirmReviewAll(false);
          setToast("Revisión guardada.");
        }}
        title="Verificar toda la pre-nómina"
        message={`Se marcarán ${departmentRows.length} departamentos como revisados.`}
        confirmLabel="Verificar"
        cancelLabel="Cancelar"
      />
      {toast && <ITToast message={toast} type="success" position="bottom-center" duration={2500} onClose={() => setToast(null)} />}
    </div>
  );
}
