import { useCallback, useEffect, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITText,
  ITToast, ITDatePicker } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuCalendarCheck, LuCheck, LuRefreshCw } from "react-icons/lu";
import { scheduleApi, type WeeklyOvertimeRow } from "@entities/schedule";

const today = (): string => new Date().toISOString().slice(0, 10);

const human = (minutes: number): string => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const STATUS_LABEL: Record<WeeklyOvertimeRow["status"], string> = {
  DRAFT: "draft",
  CONFIRMED: "confirmedStatus",
  CLOSED: "closed",
};

const STATUS_COLOR: Record<WeeklyOvertimeRow["status"], "gray" | "success" | "info"> = {
  DRAFT: "gray",
  CONFIRMED: "success",
  CLOSED: "info",
};

/**
 * Aprobación semanal de horas extra (F1): muestra el snapshot legal por
 * persona y semana y permite congelarlo. La alerta semanal usa el umbral real.
 */
const dateStrToLocal = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};
const localToDateStr = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WeeklyOvertimePanel({ canApprove }: { canApprove: boolean }) {
  const { t } = useTranslation("overtime");
  const tr = t as unknown as (key: string) => string;
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<WeeklyOvertimeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await scheduleApi.weeklyOvertime(target));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("weekly.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const confirm = async (row: WeeklyOvertimeRow) => {
    setBusy(row.id);
    try {
      await scheduleApi.confirmWeeklyOvertime(row.id);
      setToast({ message: t("weekly.confirmOk"), type: "success" });
      await load(date);
    } catch (cause) {
      setToast({
        message: cause instanceof Error ? cause.message : t("weekly.confirmOk"),
        type: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ITCard className="mt-6" contentClassName="!p-5">
      <ITFlex direction="column" gap={4}>
        <ITFlex align="center" justify="between" gap={3} wrap="wrap">
          <ITFlex align="center" gap={2}>
            <span className="text-slate-500">
              <LuCalendarCheck size={17} />
            </span>
            <ITText className="font-bold">{t("weekly.title")}</ITText>
          </ITFlex>
          <ITFlex align="end" gap={2} wrap="wrap">
            <div className="w-[190px]">
              <ITDatePicker
                name="weeklyDate"
                label={t("weekly.date")}
                value={dateStrToLocal(date)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value instanceof Date) setDate(localToDateStr(value));
                }}
              />
            </div>
            <ITButton variant="outlined" color="secondary" onClick={() => void load(date)}>
              <LuRefreshCw size={14} className="mr-1" />
              {t("weekly.refresh")}
            </ITButton>
          </ITFlex>
        </ITFlex>

        <ITText muted className="!text-[12px]">
          {t("weekly.hint")}
        </ITText>

        {error && <ITAlert variant="error">{error}</ITAlert>}

        {loading && rows.length === 0 ? (
          <ITText muted className="!text-[12px]">…</ITText>
        ) : rows.length === 0 ? (
          <ITText muted>{t("weekly.empty")}</ITText>
        ) : (
          <ITFlex direction="column" gap={2}>
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ITText className="font-semibold !text-[13px]">
                      {row.user?.name ?? row.userId}
                    </ITText>
                    {row.user?.employeeNumber && (
                      <ITText muted className="!text-[11px]">{row.user.employeeNumber}</ITText>
                    )}
                    <ITBadget color={STATUS_COLOR[row.status]} size="sm">
                      {tr(`weekly.${STATUS_LABEL[row.status]}`)}
                    </ITBadget>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-600">
                    <span>{t("weekly.week")}: {row.weekStart.slice(0, 10)}</span>
                    <span>{t("weekly.ordinary")}: {human(row.ordinaryMin)}</span>
                    <span>{t("weekly.double")}: {human(row.otDoubleMin)}</span>
                    <span>{t("weekly.triple")}: {human(row.otTripleMin)}</span>
                    <span className={row.otIllegalMin > 0 ? "font-semibold text-red-600" : ""}>
                      {t("weekly.illegal")}: {human(row.otIllegalMin)}
                    </span>
                  </div>
                  {row.violations.length > 0 && (
                    <ITFlex gap={1} wrap="wrap" className="mt-1">
                      {row.violations.map((violation) => (
                        <ITBadget key={violation} color="danger" size="sm">
                          {violation}
                        </ITBadget>
                      ))}
                    </ITFlex>
                  )}
                </div>
                {canApprove && row.status === "DRAFT" && (
                  <ITButton
                    variant="filled"
                    color="primary"
                    size="sm"
                    disabled={busy === row.id}
                    onClick={() => void confirm(row)}
                  >
                    <LuCheck size={14} className="mr-1" />
                    {t("weekly.confirm")}
                  </ITButton>
                )}
              </div>
            ))}
          </ITFlex>
        )}
      </ITFlex>

      {toast && (
        <ITToast
          message={toast.message}
          type={toast.type}
          position="bottom-center"
          duration={2500}
          onClose={() => setToast(null)}
        />
      )}
    </ITCard>
  );
}
