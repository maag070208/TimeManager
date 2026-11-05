import { useMemo } from "react";
import { ITButton, ITCheckbox, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuListChecks } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import { DialogHeader } from "@shared/ui/dialog-header";
import type { WeeklyAttendanceReport } from "@entities/schedule";
import type { UseDepartmentReviews } from "../model/useDepartmentReviews";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Reporte de TODA la semana (sin los filtros de la tabla). */
  report: WeeklyAttendanceReport | null;
  reviews: UseDepartmentReviews;
  weekLabel: string;
  /** Abre la confirmación de cierre (cuando ya está todo revisado). */
  onRequestClose: () => void;
}

/**
 * «Verificar pre-nómina»: la lista de departamentos de la semana con su
 * revisión (una por una o «marcar todos»). Es el paso previo a cerrar: el API
 * no deja cerrar si queda algún departamento sin revisar.
 */
export default function PayrollReviewDialog({
  open,
  onClose,
  report,
  reviews,
  weekLabel,
  onRequestClose,
}: Props) {
  const { t } = useTranslation("weekly-attendance");
  const canReview = useCan("payroll.review");
  const canClose = useCan("payroll.close");

  const departments = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; people: number }>();
    for (const row of report?.rows ?? []) {
      const key = row.departmentId ?? "";
      const current = map.get(key) ?? {
        id: row.departmentId,
        name: row.departmentName ?? "—",
        people: 0,
      };
      current.people += 1;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [report]);

  const total = departments.length;
  const allReviewed = total > 0 && reviews.reviewedCount >= total;

  return (
    <ITDialog isOpen={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader
        icon={<LuListChecks />}
        tone="primary"
        title={t("reviewDialog.title")}
        subtitle={t("reviewDialog.subtitle", { week: weekLabel })}
      />
      <ITFlex align="center" justify="between" gap={2} className="mb-2">
        <ITText muted className="!text-[11.5px] font-semibold">
          {t("reviewDialog.pending", { count: Math.max(0, total - reviews.reviewedCount), total })}
        </ITText>
        <ITButton
          variant="outlined"
          color="gray"
          size="sm"
          disabled={!canReview || reviews.busy || reviews.closed || total === 0}
          onClick={() => reviews.reviewAll(departments.map((department) => department.id))}
        >
          <ITText className="!text-[11px] font-semibold">{t("reviewDialog.markAll")}</ITText>
        </ITButton>
      </ITFlex>

      <div className="max-h-[52vh] overflow-y-auto">
        {departments.length === 0 ? (
          <ITText className="block py-6 text-center text-slate-500 !text-[12.5px]">{t("reviewDialog.empty")}</ITText>
        ) : (
          departments.map((department) => {
            const done = reviews.isReviewed(department.id);
            return (
              <ITFlex
                key={department.id ?? "none"}
                align="center"
                justify="between"
                gap={3}
                className="min-h-[46px] border-b border-slate-100 py-2 last:border-b-0"
              >
                <ITCheckbox
                  checked={done}
                  disabled={!canReview || reviews.busy || reviews.closed}
                  onChange={() => reviews.toggle(department.id)}
                  label={
                    <ITFlex direction="column" className="min-w-0">
                      <ITText className="block font-semibold !text-[12.5px] text-slate-800">{department.name}</ITText>
                      <ITText className="block !text-[11px] text-slate-500">
                        {department.people} personas
                      </ITText>
                    </ITFlex>
                  }
                />
                <ITText
                  as="span"
                  className="shrink-0 !text-[10.5px] font-semibold"
                  style={{ color: done ? "var(--color-success)" : "var(--color-warning)" }}
                >
                  {done ? t("reviewStatus.reviewed") : t("reviewStatus.pending")}
                </ITText>
              </ITFlex>
            );
          })
        )}
      </div>

      <ITFlex align="center" justify="end" gap={2} className="mt-4">
        <ITButton variant="text" color="gray" size="sm" onClick={onClose}>
          <ITText className="!text-[11.5px] font-semibold">{t("reviewDialog.cancel")}</ITText>
        </ITButton>
        <ITButton
          variant="filled"
          color="warning"
          size="sm"
          disabled={!allReviewed || !canClose || reviews.busy || reviews.closed}
          onClick={onRequestClose}
        >
          <ITText className="!text-[11.5px] font-bold !text-white">{t("reviewDialog.closeWeek")}</ITText>
        </ITButton>
      </ITFlex>
    </ITDialog>
  );
}
