import { useState } from "react";
import { ITAlert, ITBadget, ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuChevronDown, LuChevronUp, LuRotateCcw } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { hoursDecimal, type PayrollClosureRow, type PayrollClosureReview } from "@entities/schedule";
import { dateLocale } from "@shared/i18n";
import type { UsePayrollHistory } from "../model/usePayrollHistory";

/** "5 – 11 nov 2026" (o "29 oct – 4 nov 2026") de la semana cuyo primer día es `weekStart`. */
const weekRangeLabel = (weekStart: string): string => {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const month = (date: Date): string =>
    date.toLocaleDateString(dateLocale(), { month: "short", timeZone: "UTC" }).replace(/\./g, "");
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth
    ? `${start.getUTCDate()} – ${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`
    : `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`;
};

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

interface SnapshotSummary {
  people?: number;
  workedMin?: number;
  extraMin?: number;
  approvedExtraMin?: number;
  absences?: number;
}

interface SnapshotDepartment {
  departmentId: string | null;
  name: string;
  people: number;
}

const readSnapshot = (row: PayrollClosureRow): {
  summary: SnapshotSummary;
  departments: SnapshotDepartment[];
  reviews: PayrollClosureReview[];
} => {
  const snapshot = (row.snapshot ?? {}) as {
    summary?: SnapshotSummary;
    departments?: SnapshotDepartment[];
    reviews?: PayrollClosureReview[];
  };
  return {
    summary: snapshot.summary ?? {},
    departments: snapshot.departments ?? [],
    // La fotografía del cierre manda; si es de una versión anterior sin reviews,
    // se usan las revisiones vigentes que también devuelve el API.
    reviews: snapshot.reviews?.length ? snapshot.reviews : row.reviews,
  };
};

const hairline = "1px solid #edf1f5";
const th = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400";
const grid = "grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] items-center";

/** Una semana del historial: su cierre, la reapertura y las revisiones. */
function WeekCard({ row, fx }: { row: PayrollClosureRow; fx: UsePayrollHistory }) {
  const { t } = useTranslation("weekly-attendance");
  const [open, setOpen] = useState(false);
  const { summary, departments, reviews } = readSnapshot(row);
  const reviewByDepartment = new Map(reviews.map((review) => [review.departmentId ?? "", review]));
  const departmentsOf = departments.length
    ? departments
    : reviews.map((review) => ({
        departmentId: review.departmentId,
        name: review.departmentName ?? t("history.noDepartment"),
        people: 0,
      }));

  const stats = [
    t("history.stats.people", { count: summary.people ?? 0 }),
    t("history.stats.worked", { hours: hoursDecimal(summary.workedMin ?? 0) }),
    t("history.stats.extra", { hours: hoursDecimal(summary.extraMin ?? 0) }),
    t("history.stats.approved", { hours: hoursDecimal(summary.approvedExtraMin ?? 0) }),
    t("history.stats.absences", { count: summary.absences ?? 0 }),
  ].join(" · ");

  return (
    <ITCard className="bento-rise" contentClassName="!p-0">
      <ITFlex align="start" justify="between" wrap="wrap" gap={3} className="px-5 py-4">
        <ITFlex direction="column" gap={1} className="min-w-0">
          <ITFlex align="center" gap={2} wrap="wrap">
            <ITText className="font-bold !text-[13.5px] text-slate-800">
              {t("history.week", { range: weekRangeLabel(row.weekStart) })}
            </ITText>
            <ITBadget color={row.closed ? "success" : "warning"} size="sm">
              {row.closed ? t("history.closed") : t("history.reopened")}
            </ITBadget>
          </ITFlex>
          <ITText muted className="!text-[11.5px]">
            {t("history.closedBy", { name: row.closedBy?.name ?? "—", date: fmtWhen(row.closedAt) })}
            {!row.closed && row.reopenedAt
              ? ` · ${t("history.reopenedBy", { name: row.reopenedBy?.name ?? "—", date: fmtWhen(row.reopenedAt) })}`
              : ""}
          </ITText>
          <ITText className="!text-[11.5px] font-medium text-slate-500">{stats}</ITText>
        </ITFlex>
        <ITFlex align="center" gap={2} className="shrink-0">
          <ITButton variant="text" color="primary" size="sm" onClick={() => setOpen((value) => !value)}>
            <ITFlex align="center" gap={1}>
              {open ? <LuChevronUp size={12} /> : <LuChevronDown size={12} />}
              <ITText as="span" className="!text-[11px] font-semibold">
                {open ? t("history.hide") : t("history.open")}
              </ITText>
            </ITFlex>
          </ITButton>
          {row.closed && fx.canClose && (
            <ITButton
              variant="outlined"
              color="warning"
              size="sm"
              disabled={fx.busyWeek === row.weekStart}
              onClick={() => void fx.reopen(row.weekStart)}
            >
              <ITFlex align="center" gap={1}>
                <LuRotateCcw size={12} />
                <ITText as="span" className="!text-[11px] font-semibold">{t("history.reopen")}</ITText>
              </ITFlex>
            </ITButton>
          )}
        </ITFlex>
      </ITFlex>

      {open && (
        <div className="px-5 pb-4">
          <ITText muted className="mb-1 block font-semibold !text-[11px] uppercase tracking-[0.05em]">
            {t("history.reviewHeader")}
          </ITText>
          {departmentsOf.length === 0 ? (
            <ITText muted className="block py-2 !text-[12px]">{t("history.noReviews")}</ITText>
          ) : (
            <div role="table" aria-label={t("history.reviewHeader")}>
              <div role="row" className={`${grid} py-2`} style={{ borderBottom: hairline }}>
                <span role="columnheader" className={th}>{t("history.columns.department")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("history.columns.people")}</span>
                <span role="columnheader" className={th}>{t("history.columns.reviewer")}</span>
                <span role="columnheader" className={th}>{t("history.columns.when")}</span>
                <span role="columnheader" className={th}>{t("history.columns.mode")}</span>
              </div>
              {departmentsOf.map((department) => {
                const review = reviewByDepartment.get(department.departmentId ?? "");
                return (
                  <div
                    role="row"
                    key={department.departmentId ?? "none"}
                    className={`${grid} py-2`}
                    style={{ borderBottom: hairline }}
                  >
                    <span role="cell" className="truncate text-[12.5px] font-semibold text-slate-700">{department.name}</span>
                    <span role="cell" className="text-center text-[12.5px] tabular-nums text-slate-600">
                      {department.people || "—"}
                    </span>
                    <span role="cell" className="truncate text-[12.5px] text-slate-600">{review?.reviewedBy?.name ?? "—"}</span>
                    <span role="cell" className="truncate text-[12.5px] text-slate-600">
                      {review?.reviewedAt ? fmtWhen(review.reviewedAt) : "—"}
                    </span>
                    <span role="cell" className="text-[12px] text-slate-500">
                      {review ? (review.bulk ? t("history.bulk") : t("history.individual")) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ITCard>
  );
}

/**
 * Historial de pre-nóminas cerradas: las últimas 52 semanas con su estado,
 * quién cerró/reabrió y —al abrir el detalle— quién revisó cada departamento,
 * cuándo y si fue «marcar todo» o individual. Permite reabrir una semana.
 */
export default function PayrollHistoryPanel({ fx }: { fx: UsePayrollHistory }) {
  const { t } = useTranslation("weekly-attendance");

  if (fx.loading && !fx.rows) {
    return <div className="p-6 text-center text-[12.5px] text-slate-500">Cargando historial…</div>;
  }
  if (fx.error) {
    return (
      <ITAlert variant="error" dismissible onDismiss={fx.reload}>
        {fx.error}
      </ITAlert>
    );
  }
  if (!fx.rows || fx.rows.length === 0) {
    return (
      <ITText muted className="block py-10 text-center !text-[13px]">
        {t("history.empty")}
      </ITText>
    );
  }

  return (
    <ITFlex direction="column" gap={3}>
      {fx.rows.map((row) => (
        <WeekCard key={row.weekStart} row={row} fx={fx} />
      ))}
    </ITFlex>
  );
}
