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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              color: closed ? "var(--color-success)" : allReviewed ? "var(--color-success)" : "var(--color-warning)",
              backgroundColor: closed || allReviewed ? "color-mix(in srgb, var(--color-success) 12%, transparent)" : "color-mix(in srgb, var(--color-warning) 14%, transparent)",
            }}
          >
            <LuShieldCheck size={17} />
          </ITText>
          <div className="min-w-0">
            <ITText className="block !text-[12px] font-bold !text-slate-800">Revisión de la semana</ITText>
            <ITText muted className="block !text-[11.5px]">{note}</ITText>
          </div>
        </ITFlex>

        <ITFlex align="center" gap={1.5} wrap="wrap" className="shrink-0">
          <ITButton variant="text" color="gray" size="sm" className="tm-row-button" onClick={() => navigate("/schedules/payroll/history")}>
            <ITFlex align="center" gap={1}>
              <LuHistory size={13} />
              <ITText as="span" className="text-[11px] font-semibold">{t("actionsBar.history")}</ITText>
            </ITFlex>
          </ITButton>

          <span aria-hidden className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

          {closed ? (
            canClose && (
              <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={reviews.reopen} disabled={reviews.busy}>
                <ITFlex align="center" gap={1}>
                  <LuShieldCheck size={13} />
                  <ITText as="span" className="text-[11px] font-semibold">{t("actionsBar.reopen")}</ITText>
                </ITFlex>
              </ITButton>
            )
          ) : (
            <>
              <ITButton
                variant="outlined"
                color="secondary"
                size="sm"
                className="tm-row-button"
                onClick={onVerify}
                disabled={reviews.busy || !hasWeekData}
              >
                <ITFlex align="center" gap={1}>
                  <LuListChecks size={13} />
                  <ITText as="span" className="text-[11px] font-semibold">{t("actionsBar.verifyByDepartment")}</ITText>
                </ITFlex>
              </ITButton>
              {canReview && !allReviewed && (
                <ITButton
                  variant="filled"
                  color="primary"
                  size="sm"
                  className="tm-row-button"
                  onClick={onVerifyAll}
                  disabled={reviews.busy || !hasWeekData}
                >
                  <ITFlex align="center" gap={1}>
                    <LuCheckCheck size={13} />
                    <ITText as="span" className="text-[11px] font-semibold !text-white">{t("actionsBar.verifyAll")}</ITText>
                  </ITFlex>
                </ITButton>
              )}
              <ITButton
                variant={allReviewed ? "filled" : "outlined"}
                color="warning"
                size="sm"
                className="tm-row-button"
                onClick={onCloseWeek}
                disabled={!allReviewed || !canClose || reviews.busy || !hasWeekData}
                title={allReviewed ? undefined : t("actionsBar.notePending")}
              >
                <ITFlex align="center" gap={1}>
                  <LuShieldCheck size={13} />
                  <ITText as="span" className={`text-[11px] font-semibold ${allReviewed ? "!text-slate-900" : "!text-slate-400"}`}>
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
