import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ITAlert, ITButton, ITCard, ITConfirmDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuFileSpreadsheet, LuFileText } from "react-icons/lu";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";
import { buildDepartmentRows, hoursDecimal } from "@entities/schedule";
import { useCan } from "@entities/user";
import type { UseWeeklyAttendance } from "../model/useWeeklyAttendance";
import { useDepartmentReviews } from "../model/useDepartmentReviews";
import PayrollSteps, { type PayrollStep } from "./PayrollSteps";
import PayrollKpis from "./PayrollKpis";
import DepartmentSummaryCard from "./DepartmentSummaryCard";
import DepartmentDetailDialog from "./DepartmentDetailDialog";

/** Horas con separador de miles y dos decimales ("4,860.40"). */
const fmtHours = (minutes: number): string =>
  (minutes / 60).toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Fecha y hora cortas ("4 nov 2026, 12:32") para los sellos de revisión/cierre. */
const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

/**
 * Reporte semanal de pre nómina, como la maqueta del cierre:
 * 1. Los pasos del cierre (Asistencia, Tiempo extra, Revisar departamentos,
 *    Cerrar y exportar) con su estado.
 * 2. Las cifras de la semana (personas con checadas, horas, extra y faltas).
 * 3. La tabla por departamento ("Ver detalle" abre sus personas en un modal).
 * 4. El pie con las exportaciones y el cierre (se habilita cuando todos los
 *    departamentos están revisados; revisión y cierre se guardan en el API).
 */
export default function WeeklyAttendancePanel({ fx }: { fx: UseWeeklyAttendance }) {
  const t = dyn(fx.t);
  const navigate = useNavigate();
  const report = fx.report;
  const summary = report?.summary;
  /** Departamento abierto en el modal de detalle (null = cerrado). */
  const [openDept, setOpenDept] = useState<{ id: string | null; name: string } | null>(null);
  /** Confirmación de "marcar todo como revisado". */
  const [confirmReviewAll, setConfirmReviewAll] = useState(false);

  const departmentRows = useMemo(() => (report ? buildDepartmentRows(report) : []), [report]);
  const openDeptRows = useMemo(
    () => (report && openDept ? report.rows.filter((r) => r.departmentId === openDept.id) : []),
    [report, openDept]
  );
  // La revisión por departamento y el cierre viven en el API (quién, cuándo,
  // una por una o todas). Marcar exige `payroll.review`; cerrar, `payroll.close`.
  const reviews = useDepartmentReviews(report?.range.days[0] ?? null);
  const canReview = useCan("payroll.review");
  const canClose = useCan("payroll.close");
  const allReviewed = departmentRows.length > 0 && reviews.reviewedCount >= departmentRows.length;

  const steps: PayrollStep[] = summary
    ? [
        {
          title: t("steps.attendance"),
          caption:
            summary.absences === 0 ? t("steps.attendanceOk") : t("steps.attendancePending", { count: summary.absences }),
          state: summary.absences === 0 ? "done" : "todo",
          onClick: () => navigate("/hr/time-clock/entries-exits"),
        },
        {
          title: t("steps.overtime"),
          caption:
            summary.pendingExtraMin === 0
              ? t("steps.overtimeNone")
              : t("steps.overtimePending", { hours: hoursDecimal(summary.pendingExtraMin) }),
          state: summary.pendingExtraMin === 0 ? "done" : "todo",
          onClick: () => navigate("/schedules/overtime/approval"),
        },
        {
          title: t("steps.review"),
          caption: t("steps.reviewCaption", { done: reviews.reviewedCount, total: departmentRows.length }),
          state: allReviewed ? "done" : "active",
        },
        {
          title: t("steps.close"),
          caption: reviews.closed ? t("steps.closeDone") : t("steps.closeCaption"),
          state: reviews.closed ? "done" : "todo",
        },
      ]
    : [];

  const nothingToExport = !report || report.rows.length === 0;

  return (
    <ITFlex direction="column" gap={4}>
      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}
      {reviews.error && (
        <ITAlert variant="error" dismissible onDismiss={reviews.clearError}>
          {reviews.error}
        </ITAlert>
      )}

      {summary && (
        <>
          <PayrollSteps steps={steps} />
          <PayrollKpis
            linked={summary.people - summary.unlinked}
            workedHours={fmtHours(summary.workedMin)}
            approvedHours={fmtHours(summary.approvedExtraMin)}
            absences={summary.absences}
            labels={{
              people: t("cards.people"),
              peopleCaption: t("cards.peopleCaption", { total: summary.people }),
              worked: t("cards.worked"),
              workedCaption: t("cards.workedCaption"),
              approved: t("cards.approved"),
              approvedCaption: t("cards.approvedCaption", { hours: hoursDecimal(summary.pendingExtraMin) }),
              absences: t("cards.absences"),
              goToAttendance: t("cards.goToAttendance"),
            }}
            onGoToAttendance={() => navigate("/hr/time-clock/entries-exits")}
          />
          <DepartmentSummaryCard
            rows={departmentRows}
            t={fx.t}
            isReviewed={reviews.isReviewed}
            reviewOf={reviews.reviewOf}
            onOpenDepartment={(id) =>
              setOpenDept({ id, name: departmentRows.find((d) => d.departmentId === id)?.name ?? "—" })
            }
            onReviewAll={canReview && !reviews.closed ? () => setConfirmReviewAll(true) : undefined}
          />
        </>
      )}

      {/* Cierre y exportación: el cierre se habilita cuando todos los
          departamentos están revisados y queda guardado en el servidor con
          la fotografía de las cifras de la semana. */}
      <ITCard className="!border-0">
        <ITFlex align="center" justify="between" wrap="wrap" gap={3}>
          <ITText muted className="!text-[12px]">
            {reviews.closed
              ? t("close.closedBy", {
                  name: reviews.closure?.closedBy?.name ?? "—",
                  date: reviews.closure ? fmtWhen(reviews.closure.closedAt) : "",
                })
              : allReviewed
                ? t("close.allReviewed")
                : t("close.note")}
          </ITText>
          <ITFlex align="center" gap={2}>
            <ITButton variant="outlined" color="secondary" size="sm" onClick={fx.exportPdf} disabled={fx.exporting || nothingToExport}>
              <ITFlex align="center" gap={1}>
                <LuFileText size={13} />
                <ITText className="text-[11px] font-bold">{fx.exporting ? t("exporting") : t("exportPdfFull")}</ITText>
              </ITFlex>
            </ITButton>
            <ITButton variant="outlined" color="secondary" size="sm" onClick={fx.exportExcel} disabled={nothingToExport}>
              <ITFlex align="center" gap={1}>
                <LuFileSpreadsheet size={13} />
                <ITText className="text-[11px] font-bold">{t("exportExcelFull")}</ITText>
              </ITFlex>
            </ITButton>
            {reviews.closed ? (
              canClose && (
                <ITButton variant="outlined" color="primary" size="sm" onClick={reviews.reopen} disabled={reviews.busy}>
                  <ITText className="text-[11px] font-bold">{t("close.reopen")}</ITText>
                </ITButton>
              )
            ) : (
              <ITButton
                variant="filled"
                color="warning"
                size="sm"
                onClick={() =>
                  reviews.close(
                    departmentRows.map((row) => row.departmentId),
                    {
                      summary,
                      departments: departmentRows,
                      // Detalle por persona: el PDF/CSV del cierre lo incluye.
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
                disabled={!allReviewed || !canClose || reviews.busy}
                title={allReviewed ? undefined : t("close.disabled")}
              >
                <ITText className="text-[11px] font-bold">{t("close.button")}</ITText>
              </ITButton>
            )}
          </ITFlex>
        </ITFlex>
      </ITCard>

      <DepartmentDetailDialog
        department={openDept}
        rows={openDeptRows}
        t={fx.t}
        reviewed={openDept ? reviews.isReviewed(openDept.id) : false}
        canReview={canReview && !reviews.closed}
        onToggleReview={() => {
          if (openDept) reviews.toggle(openDept.id);
          setOpenDept(null);
        }}
        onClose={() => setOpenDept(null)}
      />

      <ITConfirmDialog
        isOpen={confirmReviewAll}
        onClose={() => setConfirmReviewAll(false)}
        onConfirm={() => {
          reviews.reviewAll(departmentRows.map((row) => row.departmentId));
          setConfirmReviewAll(false);
        }}
        title={t("reviewAllDialog.title")}
        message={t("reviewAllDialog.message", { count: departmentRows.length })}
        confirmLabel={t("reviewAllDialog.confirm")}
        cancelLabel={t("reviewAllDialog.cancel")}
      />
    </ITFlex>
  );
}
