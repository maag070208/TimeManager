import { useMemo, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITBentoWeekBars,
  ITButton,
  ITCard,
  ITConfirmDialog,
  ITDialog,
  ITFlex,
  ITGrid,
  ITText,
} from "@axzydev/axzy_ui_system";
import { LuBell, LuChartColumn, LuCheckCheck, LuClock, LuHourglass, LuInfo, LuTriangleAlert, LuUsers, LuWallet } from "react-icons/lu";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";
import { DialogHeader } from "@shared/ui/dialog-header";
import { FilterPills } from "@shared/ui/filter-pills";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { PanelCard } from "@shared/ui/panel-card";
import { seriesColor } from "@shared/ui/charts";
import { buildDepartmentRows, WEEKLY_LEGEND, WEEKLY_STATUS_BADGE, hoursDecimal, toDayKey } from "@entities/schedule";
import type { UseWeeklyAttendance, WeeklyAttendanceMode } from "../model/useWeeklyAttendance";
import { useDepartmentReviews } from "../model/useDepartmentReviews";
import WeeklyAttendanceTable from "./WeeklyAttendanceTable";
import WeeklyAttendanceActions from "./WeeklyAttendanceActions";
import PayrollReviewDialog from "./PayrollReviewDialog";

const shortMonth = (date: Date): string =>
  date.toLocaleDateString(dateLocale(), { month: "short" }).replace(/\./g, "");

/** "2 – 8 nov" (mismo mes) o "29 oct – 4 nov" (mes distinto). */
const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(
    typeof value === "number" && Number.isFinite(value) ? value : 0,
  );

const weekRangeLabel = ([start, end]: [Date, Date]): string =>
  start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${start.getDate()} – ${end.getDate()} ${shortMonth(end)}`
    : `${start.getDate()} ${shortMonth(start)} – ${end.getDate()} ${shortMonth(end)}`;

/**
 * Reporte semanal de pre nómina.
 *
 * Barra de acciones rápidas (exportar, verificar y cerrar la semana), cifras
 * del mosaico (de la semana o del departamento filtrado), la gráfica de horas
 * extra y el reporte con su selector de vista. Los filtros rápidos viven en el
 * encabezado de la página.
 */
export default function WeeklyAttendancePanel({ fx }: { fx: UseWeeklyAttendance }) {
  const t = dyn(fx.t);
  const report = fx.report;
  const summary = report?.summary;
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [confirmVerifyAll, setConfirmVerifyAll] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Revisión y cierre de la semana (guardados en el API por semana). Se usan
  // las filas SIN filtros: la revisión/cierre es de toda la semana, no solo del
  // departamento elegido en la tabla.
  const reviewReport = fx.reviewReport;
  const weekKey = reviewReport?.range.days[0] ?? report?.range.days[0] ?? null;
  const reviews = useDepartmentReviews(weekKey);
  const departmentIds = useMemo(
    () => [...new Set((reviewReport?.rows ?? []).map((row) => row.departmentId))],
    [reviewReport]
  );
  const allReviewed = departmentIds.length > 0 && reviews.reviewedCount >= departmentIds.length;
  const weekLabel = weekRangeLabel(fx.rangeValue);


  // Avisos de la semana: solo se muestran si hay algo que atender.
  const notices: string[] = [];
  if (summary?.unlinked) notices.push(t("unlinkedHint", { count: summary.unlinked }));
  if (summary?.withoutSchedule) notices.push(t("withoutScheduleHint", { count: summary.withoutSchedule }));
  const noticesCount = (summary?.unlinked ?? 0) + (summary?.withoutSchedule ?? 0);

  // Cifras de la semana (o del departamento filtrado: el API ya las recorta).
  const scopeName = fx.departmentId
    ? fx.departments.data.find((department) => department.id === fx.departmentId)?.name ?? null
    : null;

  // Horas extra calculadas por día y por departamento (sumas de las filas del reporte).
  const { extraByDay, extraByDepartment } = useMemo(() => {
    const days = report?.range.days ?? [];
    const todayKey = toDayKey(new Date());
    const byDay = days.map((day, i) => {
      let minutes = 0;
      for (const row of report?.rows ?? []) minutes += row.days[i]?.extraMin ?? 0;
      return {
        label: new Date(`${day}T12:00:00Z`)
          .toLocaleDateString(dateLocale(), { weekday: "narrow", timeZone: "UTC" })
          .toUpperCase(),
        value: Math.round((minutes / 60) * 10) / 10,
        tone: day === todayKey ? ("today" as const) : day > todayKey ? ("future" as const) : ("past" as const),
      };
    });
    const deptMinutes = new Map<string, number>();
    for (const row of report?.rows ?? []) {
      if (row.totals.extraMin <= 0) continue;
      const key = row.departmentName ?? "—";
      deptMinutes.set(key, (deptMinutes.get(key) ?? 0) + row.totals.extraMin);
    }
    const byDept = [...deptMinutes.entries()]
      .map(([label, minutes], i) => ({ label, minutes, color: seriesColor(i) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
    return { extraByDay: byDay, extraByDepartment: byDept };
  }, [report]);
  const extraTotalMin = summary?.extraMin ?? 0;
  const topIndex = extraByDay.reduce((best, d, i) => (d.value > (extraByDay[best]?.value ?? 0) ? i : best), 0);
  const topDay = {
    value: extraByDay[topIndex]?.value ?? 0,
    label: report?.range.days[topIndex]
      ? new Date(`${report.range.days[topIndex]}T12:00:00Z`).toLocaleDateString(dateLocale(), {
          weekday: "long",
          timeZone: "UTC",
        })
      : "",
  };

  return (
    <ITFlex direction="column" gap={4}>
      {/* Acciones rápidas: exportar, verificar y cerrar la semana, siempre a la
          vista (la barra se queda pegada arriba al recorrer la tabla). */}
      <WeeklyAttendanceActions
        reviews={reviews}
        allReviewed={allReviewed}
        hasWeekData={departmentIds.length > 0}
        onVerifyAll={() => setConfirmVerifyAll(true)}
        onVerify={() => setVerifyOpen(true)}
        onCloseWeek={() => setConfirmClose(true)}
      />

      {/* Cifras de la semana en el mosaico bento. Con un departamento elegido,
          el API ya devuelve sus totales: las tarjetas son las de ese departamento. */}
      {summary && (
        <ITFlex direction="column" gap={1.5}>
          <ITText muted className="!text-[11.5px] font-semibold">
            {scopeName ? t("kpis.scopeDepartment", { name: scopeName }) : t("kpis.scopeAll")}
          </ITText>
          <BentoKpiGrid
            items={[
              {
                id: "people",
                label: t("kpis.people"),
                value: summary.people,
                caption: t("short.linked", { linked: summary.people - summary.unlinked }),
                tone: "info",
                icon: <LuUsers size={14} />,
              },
              {
                id: "worked",
                label: t("kpis.worked"),
                value: hoursDecimal(summary.workedMin),
                caption: t("short.scheduled", { hours: hoursDecimal(summary.scheduledMin) }),
                icon: <LuClock size={14} />,
              },
              {
                id: "overtime",
                label: t("kpis.overtime"),
                value: hoursDecimal(summary.extraMin),
                caption: t("short.worked", { hours: hoursDecimal(summary.workedMin) }),
                tone: "warning",
                icon: <LuHourglass size={14} />,
              },
              {
                id: "approved",
                label: t("kpis.approved"),
                value: hoursDecimal(summary.approvedExtraMin),
                caption: t("short.calculated", {
                  pct: summary.extraMin > 0 ? Math.round((summary.approvedExtraMin / summary.extraMin) * 100) : 0,
                }),
                tone: "success",
                icon: <LuCheckCheck size={14} />,
              },
              {
                id: "absences",
                label: t("kpis.absences"),
                value: summary.absences,
                caption: t("short.people", { total: summary.people }),
                tone: summary.absences > 0 ? "danger" : "neutral",
                icon: <LuTriangleAlert size={14} />,
              },
              {
                id: "dailyCost",
                label: "Costo diario de plantilla",
                value: money(summary.dailySalaryTotal),
                caption: `${summary.withSalary ?? 0} con salario configurado`,
                icon: <LuWallet size={14} />,
                tone: "info",
              },
              {
                id: "weeklyCost",
                label: "Costo semanal estimado",
                value: money(summary.weeklySalaryCost),
                caption: "7 días por persona",
                icon: <LuWallet size={14} />,
                tone: "warning",
              },
            ]}
          />
        </ITFlex>
      )}

      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}

      {/* Igual que Asistencias: una sola tarjeta con el título, la vista y el
          reporte. Los filtros rápidos viven en el encabezado de la página. */}
      <ITCard contentClassName="!p-0">
        <ITFlex align="center" justify="between" wrap="wrap" gap={2} className="px-5 py-3">
          <ITFlex align="center" gap={2} className="min-w-0">
            <ITText className="!text-[14px] font-bold">{t("reportTitle")}</ITText>
            {report && (
              <ITText as="span" className="rounded-full bg-[color-mix(in_srgb,currentColor_7%,transparent)] px-2 py-0.5 !text-[11px] font-bold tabular-nums">
                {report.rows.length}
              </ITText>
            )}
          </ITFlex>
          <ITFlex align="center" gap={2}>
            <FilterPills
              items={[
                { id: "SUMMARY" as WeeklyAttendanceMode, label: t("view.summary") },
                { id: "DETAIL" as WeeklyAttendanceMode, label: t("view.detail") },
              ]}
              value={fx.mode}
              onChange={fx.setMode}
            />
            <ITButton variant="raised-text" color="secondary" size="sm" onClick={() => setLegendOpen((open) => !open)}>
              <ITFlex align="center" gap={1}>
                <LuInfo size={12} />
                <ITText className="text-[11px] font-bold">{t("legend")}</ITText>
              </ITFlex>
            </ITButton>
            {noticesCount > 0 && (
              <ITButton variant="outlined" color="warning" size="sm" onClick={() => setNoticesOpen(true)} title={t("notices.title")}>
                <ITFlex align="center" gap={1}>
                  <LuBell size={13} />
                  <ITText className="text-[11px] font-bold">{noticesCount}</ITText>
                </ITFlex>
              </ITButton>
            )}
          </ITFlex>
        </ITFlex>

        {legendOpen && (
          <ITFlex align="center" wrap="wrap" gap={2} className="  px-5 py-2.5">
            {WEEKLY_LEGEND.map((status) => (
              <ITBadget key={status} color={WEEKLY_STATUS_BADGE[status]} size="sm">
                {t(`status.${status}`)}
              </ITBadget>
            ))}
            {report && (
              <ITText muted className="ml-auto !text-[11px]">
                {t("timezone", { tz: report.range.timezone })}
              </ITText>
            )}
          </ITFlex>
        )}

        <div className=" ">
          {fx.loading && !report ? (
            <ITText muted className="block px-5 py-8 !text-[12.5px]">Cargando reporte…</ITText>
          ) : report && report.rows.length > 0 ? (
            <div className={fx.loading ? "opacity-60 transition-opacity" : undefined}>
              <WeeklyAttendanceTable
                report={report}
                mode={fx.mode}
                groupByDepartment={!fx.departmentId}
                t={fx.t}
                onParamsChange={fx.setTableParams}
                reloadTrigger={fx.reportVersion}
                queryKey={fx.queryKey}
              />
            </div>
          ) : (
            !fx.loading && (
              <ITText muted className="block px-5 py-8 !text-[12.5px]">
                {t("empty")} {t("emptyHint")}
              </ITText>
            )
          )}
        </div>
      </ITCard>

      {/* Horas extra de la semana: por día y por departamento */}
      {summary && (
        <PanelCard
          title={t("charts.weekTitle")}
          icon={<LuChartColumn size={16} />}
          actions={
            <ITText muted className="!text-[12px] font-semibold tabular-nums">
              {t("charts.total", { hours: hoursDecimal(summary.extraMin) })}
            </ITText>
          }
        >
          {extraTotalMin === 0 ? (
            <ITText muted className="!text-[12.5px]">
              {t("charts.noExtra")}
            </ITText>
          ) : (
            <ITGrid container columns={12} spacing={5}>
              <ITGrid item xs={12} lg={7} className="min-w-0">
                <ITText muted className="!text-[11px] font-bold uppercase tracking-[0.05em]">
                  {t("charts.extraByDay")}
                </ITText>
                <div className="mt-2 h-[104px]">
                  <ITBentoWeekBars items={extraByDay} color="var(--color-primary-500)" todayColor="var(--color-warning)" />
                </div>
                {topDay.value > 0 && (
                  <ITText muted className="mt-2 block !text-[11.5px]">
                    {t("charts.dayNote", { hours: topDay.value, day: topDay.label })}
                  </ITText>
                )}
              </ITGrid>
              <ITGrid item xs={12} lg={5} className="min-w-0">
                <ITText muted className="!text-[11px] font-bold uppercase tracking-[0.05em]">
                  {t("charts.extraByDepartment")}
                </ITText>
                <div className="mt-2 flex flex-col gap-2">
                  {extraByDepartment.map((row) => (
                    <div key={row.label} className="grid grid-cols-[9px_minmax(0,1fr)_auto] items-center gap-x-2.5 text-[12.5px] font-medium">
                      <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: row.color }} />
                      <ITText as="span" className="truncate">{row.label}</ITText>
                      <ITText as="span" className="whitespace-nowrap">
                        {hoursDecimal(row.minutes)} {t("hoursShort")}{" "}
                        <ITText as="span" className="opacity-60">
                          {Math.round((row.minutes / Math.max(1, extraTotalMin)) * 100)}%
                        </ITText>
                      </ITText>
                    </div>
                  ))}
                </div>
              </ITGrid>
            </ITGrid>
          )}
        </PanelCard>
      )}

      <ITDialog isOpen={noticesOpen} onClose={() => setNoticesOpen(false)}>
        <DialogHeader icon={<LuBell />} tone="warning" title={t("notices.title")} subtitle={t("notices.subtitle")} />
        <ITFlex direction="column" gap={3}>
          {notices.map((notice, i) => (
            <ITFlex key={i} align="start" gap={2}>
              <LuInfo className="mt-0.5 shrink-0 text-[color:var(--color-warning)]" size={14} />
              <ITText className="text-[12px] font-bold text-slate-600">{notice}</ITText>
            </ITFlex>
          ))}
        </ITFlex>
      </ITDialog>

      {/* Verificar la semana por departamento y cerrarla. */}
      <PayrollReviewDialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        report={reviewReport}
        reviews={reviews}
        weekLabel={weekLabel}
        onRequestClose={() => {
          setVerifyOpen(false);
          setConfirmClose(true);
        }}
      />
      <ITConfirmDialog
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          if (!reviewReport) return;
          const departmentRows = buildDepartmentRows(reviewReport);
          reviews.close(
            departmentRows.map((department) => department.departmentId),
            {
              summary: reviewReport.summary,
              departments: departmentRows,
              people: reviewReport.rows.map((row) => ({
                departmentId: row.departmentId,
                name: row.name,
                clock: row.clockNumbers.join(", ") || row.employeeNumber || "",
                workedMin: row.totals.workedMin,
                extraMin: row.totals.extraMin,
                approvedExtraMin: row.totals.approvedExtraMin,
                absences: row.totals.absences,
              })),
            }
          );
        }}
        title={t("closeDialog.title")}
        message={t("closeDialog.message", { week: weekLabel })}
        confirmLabel={t("closeDialog.confirm")}
        cancelLabel={t("closeDialog.cancel")}
        variant="warning"
        loading={reviews.busy}
      />
      <ITConfirmDialog
        isOpen={confirmVerifyAll}
        onClose={() => setConfirmVerifyAll(false)}
        onConfirm={() => {
          setConfirmVerifyAll(false);
          reviews.reviewAll(departmentIds);
        }}
        title={t("verifyAllDialog.title")}
        message={t("verifyAllDialog.message", { count: departmentIds.length, week: weekLabel })}
        confirmLabel={t("verifyAllDialog.confirm")}
        cancelLabel={t("verifyAllDialog.cancel")}
        variant="primary"
        loading={reviews.busy}
      />
    </ITFlex>
  );
}
