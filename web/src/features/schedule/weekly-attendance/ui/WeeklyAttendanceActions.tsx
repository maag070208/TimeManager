import { ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuCheckCheck, LuHistory, LuListChecks, LuShieldCheck } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dateLocale } from "@shared/i18n";
import { useCan } from "@entities/user";
import type { UseDepartmentReviews } from "../model/useDepartmentReviews";

interface Props {
  reviews: UseDepartmentReviews;
  allReviewed: boolean;
  /** La semana tiene departamentos (aunque la tabla esté filtrada). */
  hasWeekData: boolean;
  /** Marca todos los departamentos (con confirmación en la pantalla). */
  onVerifyAll: () => void;
  /** Abre el checklist por departamento. */
  onVerify: () => void;
  onCloseWeek: () => void;
}

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

/**
 * Barra de acciones rápidas de la pre-nómina, siempre a la vista (sticky):
 * exportar (PDF/Excel), verificar toda la semana o departamento por
 * departamento, y cerrarla. Los botones van con color de su acción para que se
 * distingan a simple vista.
 */
export default function WeeklyAttendanceActions({
  reviews,
  allReviewed,
  hasWeekData,
  onVerifyAll,
  onVerify,
  onCloseWeek,
}: Props) {
  const { t } = useTranslation("weekly-attendance");
  const navigate = useNavigate();
  const canReview = useCan("payroll.review");
  const canClose = useCan("payroll.close");
  const closed = reviews.closed;

  const note = closed
    ? t("actionsBar.noteClosed", {
        name: reviews.closure?.closedBy?.name ?? "—",
        date: reviews.closure ? fmtWhen(reviews.closure.closedAt) : "",
      })
    : allReviewed
      ? t("actionsBar.noteReady")
      : t("actionsBar.notePending");

  return (
    <ITCard className="bento-rise sticky top-2 z-20" contentClassName="!px-4 !py-3">
      <ITFlex align="center" justify="between" wrap="wrap" gap={3}>
        <ITFlex align="center" gap={2} className="min-w-0">
          <ITText
            as="span"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{
              color: closed ? "var(--color-success)" : "var(--color-primary-900)",
              backgroundColor: closed
                ? "color-mix(in srgb, var(--color-success) 14%, transparent)"
                : "color-mix(in srgb, var(--color-primary-900) 10%, transparent)",
            }}
          >
            <LuShieldCheck size={15} />
          </ITText>
          <ITText muted className="!text-[12px]">
            {note}
          </ITText>
        </ITFlex>

        <ITFlex align="center" gap={2} wrap="wrap" className="shrink-0">
          <ITButton
            variant="outlined"
            color="gray"
            size="sm"
            onClick={() => navigate("/schedules/payroll/history")}
          >
            <ITFlex align="center" gap={1}>
              <LuHistory size={13} />
              <ITText as="span" className="text-[11px] font-bold">{t("actionsBar.history")}</ITText>
            </ITFlex>
          </ITButton>

          {closed ? (
            canClose && (
              <ITButton variant="outlined" color="primary" size="sm" onClick={reviews.reopen} disabled={reviews.busy}>
                <ITFlex align="center" gap={1}>
                  <LuShieldCheck size={13} />
                  <ITText as="span" className="text-[11px] font-bold">{t("actionsBar.reopen")}</ITText>
                </ITFlex>
              </ITButton>
            )
          ) : (
            <>
              {canReview && !allReviewed && (
                <>
                  <ITButton
                    variant="filled"
                    color="secondary"
                    size="sm"
                    onClick={onVerifyAll}
                    disabled={reviews.busy || !hasWeekData}
                  >
                    <ITFlex align="center" gap={1}>
                      <LuCheckCheck size={13} className="text-white" />
                      <ITText as="span" className="text-[11px] font-bold !text-white">
                        {t("actionsBar.verifyAll")}
                      </ITText>
                    </ITFlex>
                  </ITButton>
                  <ITButton
                    variant="outlined"
                    color="primary"
                    size="sm"
                    onClick={onVerify}
                    disabled={reviews.busy || !hasWeekData}
                  >
                    <ITFlex align="center" gap={1}>
                      <LuListChecks size={13} />
                      <ITText as="span" className="text-[11px] font-bold">
                        {t("actionsBar.verifyByDepartment")}
                      </ITText>
                    </ITFlex>
                  </ITButton>
                </>
              )}
              <ITButton
                variant="filled"
                color="warning"
                size="sm"
                onClick={onCloseWeek}
                disabled={!allReviewed || !canClose || reviews.busy || !hasWeekData}
                title={allReviewed ? undefined : t("actionsBar.notePending")}
              >
                <ITFlex align="center" gap={1}>
                  <LuShieldCheck size={13} className="text-slate-900" />
                  <ITText as="span" className="text-[11px] font-bold !text-slate-900">
                    {t("actionsBar.close")}
                  </ITText>
                </ITFlex>
              </ITButton>
            </>
          )}
        </ITFlex>
      </ITFlex>
    </ITCard>
  );
}
