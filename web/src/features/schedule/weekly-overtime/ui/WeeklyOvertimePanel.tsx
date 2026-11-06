import { useCallback, useEffect, useState } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITDataTable,
  ITFlex,
  ITText,
  ITToast, ITDatePicker, type Column } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuCalendarCheck, LuCheck, LuRefreshCw } from "react-icons/lu";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { RowAction } from "@shared/ui/row-action";
import { TicState } from "@shared/ui/tic";
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

  const totals = rows.reduce(
    (acc, row) => ({
      ordinary: acc.ordinary + row.ordinaryMin,
      double: acc.double + row.otDoubleMin,
      triple: acc.triple + row.otTripleMin,
      illegal: acc.illegal + row.otIllegalMin,
      rest: acc.rest + row.restDayWorkedMin,
    }),
    { ordinary: 0, double: 0, triple: 0, illegal: 0, rest: 0 },
  );

  const columns: Column<WeeklyOvertimeRow>[] = [
    {
      key: "user",
      label: "Persona",
      type: "string",
      render: (row) => (
        <div className="min-w-0">
          <ITText className="block truncate font-semibold !text-[12.5px]">{row.user?.name ?? row.userId}</ITText>
          <ITText muted className="block !text-[11px]">{row.user?.employeeNumber ? `#${row.user.employeeNumber}` : "—"}</ITText>
        </div>
      ),
    },
    { key: "week", label: "Semana", type: "string", width: 140, render: (row) => <span className="text-[12px]">{row.weekStart.slice(0, 10)}</span> },
    { key: "ordinary", label: "Ordinarias", type: "number", width: 120, render: (row) => <span className="tabular-nums text-[12px]">{human(row.ordinaryMin)}</span> },
    { key: "double", label: "Dobles", type: "number", width: 110, render: (row) => <span className="font-bold tabular-nums text-[12px] text-amber-700">{human(row.otDoubleMin)}</span> },
    { key: "triple", label: "Triples", type: "number", width: 110, render: (row) => <span className="font-bold tabular-nums text-[12px] text-orange-700">{human(row.otTripleMin)}</span> },
    { key: "illegal", label: "Excedente legal", type: "number", width: 140, render: (row) => <span className={`font-bold tabular-nums text-[12px] ${row.otIllegalMin > 0 ? "text-red-600" : "text-slate-400"}`}>{human(row.otIllegalMin)}</span> },
    { key: "status", label: "Estado", type: "string", width: 130, render: (row) => <ITBadget color={STATUS_COLOR[row.status]} size="sm">{tr(`weekly.${STATUS_LABEL[row.status]}`)}</ITBadget> },
    {
      key: "actions",
      label: "",
      type: "actions",
      width: 70,
      actions: (row) => canApprove && row.status === "DRAFT" ? (
        <RowAction icon={<LuCheck size={14} />} label={t("weekly.confirm")} tone="success" disabled={busy === row.id} onClick={() => void confirm(row)} />
      ) : null,
    },
  ];

  const fetchData = async (params: { page: number; limit: number }) => {
    const start = (params.page - 1) * params.limit;
    return { data: rows.slice(start, start + params.limit), total: rows.length };
  };

  return (
    <ITCard className="mt-6" contentClassName="!p-5">
      <ITFlex direction="column" gap={4}>
        <ITFlex align="center" justify="between" gap={3} wrap="wrap">
          <ITFlex align="center" gap={2}>
            <span className="text-slate-500"><LuCalendarCheck size={17} /></span>
            <div>
              <ITFlex align="center" gap={1}><ITText className="font-bold">{t("weekly.title")}</ITText><HelpTip text="Clasificación LFT por persona y semana: hasta el límite legal las primeras horas son dobles; las que exceden el tope semanal pasan a triples y el excedente ilegal se marca en rojo." /></ITFlex>
              <ITText muted className="!text-[11.5px]">{t("weekly.hint")}</ITText>
            </div>
          </ITFlex>
          <ITFlex align="end" gap={2} wrap="wrap">
            <div className="w-[190px]"><ITDatePicker name="weeklyDate" label={t("weekly.date")} value={dateStrToLocal(date)} onChange={(event) => { const value = event.target.value; if (value instanceof Date) setDate(localToDateStr(value)); }} /></div>
            <ITButton variant="outlined" color="secondary" className="tm-icon-button" onClick={() => void load(date)} title={t("weekly.refresh")}><LuRefreshCw size={14} /></ITButton>
          </ITFlex>
        </ITFlex>

        {error && <ITAlert variant="error">{error}</ITAlert>}

        <BentoKpiGrid items={[
          { id: "ordinary", label: "Horas ordinarias", value: human(totals.ordinary), caption: "jornada normal", tone: "neutral" },
          { id: "double", label: "Horas dobles", value: human(totals.double), caption: "primer tramo extra", tone: "warning" },
          { id: "triple", label: "Horas triples", value: human(totals.triple), caption: "sobre el tope legal", tone: "warning" },
          { id: "illegal", label: "Excedente ilegal", value: human(totals.illegal), caption: "requiere revisión", tone: totals.illegal > 0 ? "danger" : "success" },
        ]} />

        {loading && rows.length === 0 ? (
          <ITText muted className="!text-[12px]">Cargando clasificación semanal…</ITText>
        ) : rows.length === 0 ? (
          <TicState kind="empty" size="sm" title="Sin horas extra esta semana" description="Elige otra semana o registra checadas para calcular la clasificación." />
        ) : (
          <ITDataTable columns={columns as unknown as Column<Record<string, unknown>>[]} fetchData={fetchData as never} showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50} />
        )}

        {rows.some((row) => row.violations.length > 0) && (
          <ITFlex gap={1} wrap="wrap">
            {[...new Set(rows.flatMap((row) => row.violations))].map((violation) => (
              <ITBadget key={violation} color="danger" size="sm">{violation}</ITBadget>
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
