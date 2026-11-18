import { useState, type ReactNode } from "react";
import { ITButton, ITDatePicker, ITText, ITTextarea, ITTimePicker } from "@axzydev/axzy_ui_system";
import { LuClockAlert, LuPlus, LuX } from "react-icons/lu";
import type { MyPunch, PunchType } from "@entities/nom";
import { useTenantTimezone } from "@entities/user";
import { dateKeyInTimeZone } from "@shared/utils/dates";
import type { useMyWorkday } from "../model/useMyWorkday";
import { dateStrToLocal, dayLabelOf, localToDateStr, sameDay, timeOf as timeIn, zonedIso, type Tr } from "./format";

type Kind = "fix" | "missing";

const AMBER = "#b45309";
const PUNCH_TYPES = ["ENTRY", "LUNCH_START", "LUNCH_END", "EXIT"] as const;
const MAX_FIXABLE = 12;

interface Props {
  tr: Tr;
  fx: ReturnType<typeof useMyWorkday>;
  labels: Record<PunchType, string>;
  onClose: () => void;
}

/**
 * Única entrada para pedir correcciones: primero «¿qué pasó?» (una hora está
 * mal o faltó checar) y luego solo los datos de ese caso.
 */
export const CorrectionRequestForm = ({ tr: t, fx, labels, onClose }: Props) => {
  const timezone = useTenantTimezone();
  const timeOf = (iso: string) => timeIn(iso, timezone);
  const [kind, setKind] = useState<Kind | null>(null);
  const [punchId, setPunchId] = useState<string | null>(null);
  const [type, setType] = useState<PunchType>("EXIT");
  const [day, setDay] = useState(fx.today);
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");

  const fixable = fx.punches.filter((row) => row.source !== "ACCESS").slice(0, MAX_FIXABLE);
  const reasonOk = reason.trim().length >= 5;
  const ready = kind === "fix" ? !!punchId && reasonOk : kind === "missing" ? !!day && !!time && reasonOk : false;

  const punchLabel = (row: MyPunch) => {
    const when = sameDay(row.occurredAt, timezone) ? t("punch.today") : dayLabelOf(new Date(row.occurredAt), timezone, "short");
    return `${when} · ${timeOf(row.occurredAt)} · ${row.type ? labels[row.type] : t("punches.noType")}`;
  };

  const choose = (next: Kind) => {
    setKind(next);
    setTime("");
  };

  const submit = async () => {
    if (!ready) return;
    let ok = false;
    if (kind === "fix" && punchId) {
      const punch = fx.punches.find((row) => row.id === punchId);
      const expected = punch && time ? zonedIso(dateKeyInTimeZone(new Date(punch.occurredAt), timezone), time, timezone) : undefined;
      ok = await fx.reportDiscrepancy(punchId, reason.trim(), expected);
    } else if (kind === "missing") {
      ok = await fx.reportMissingPunch(type, zonedIso(day, time, timezone), reason.trim());
    }
    if (ok) onClose();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-3" style={{ borderColor: "#fde68a" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <ITText className="!text-[13px] font-extrabold !text-slate-900">{t("request.title")}</ITText>
          <ITText muted className="!text-[11.5px]">{t("request.hint")}</ITText>
        </div>
        <button type="button" aria-label={t("cancel")} onClick={onClose} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <LuX size={15} />
        </button>
      </div>

      <Choices label={t("request.what")}>
        <Choice on={kind === "fix"} onClick={() => choose("fix")} icon={<LuClockAlert size={15} />} disabled={fixable.length === 0}>
          {t("request.fix")}
        </Choice>
        <Choice on={kind === "missing"} onClick={() => choose("missing")} icon={<LuPlus size={15} />}>
          {t("request.missing")}
        </Choice>
      </Choices>

      {kind === "fix" && (
        <div role="radiogroup" aria-label={t("request.whichPunch")} className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700">{t("request.whichPunch")}</span>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
            {fixable.map((row) => {
              const on = punchId === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPunchId(row.id)}
                  className="rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold tabular-nums transition"
                  style={on ? { backgroundColor: AMBER, color: "#ffffff" } : { backgroundColor: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}
                >
                  {punchLabel(row)}
                </button>
              );
            })}
          </div>
          <ITTimePicker name="correctTime" label={t("discrepancy.correctTime")} value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
      )}

      {kind === "missing" && (
        <>
          <Choices label={t("missing.which")} columns={2}>
            {PUNCH_TYPES.map((value) => (
              <Choice key={value} on={type === value} onClick={() => setType(value)}>
                {labels[value]}
              </Choice>
            ))}
          </Choices>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ITDatePicker
              name="missingDay"
              label={t("missing.day")}
              value={dateStrToLocal(day)}
              maxDate={dateStrToLocal(fx.today)}
              onChange={(event) => {
                const value = event.target.value;
                if (value instanceof Date) setDay(localToDateStr(value));
              }}
            />
            <ITTimePicker name="missingTime" label={t("missing.time")} value={time} onChange={(event) => setTime(event.target.value)} />
          </div>
        </>
      )}

      {kind && (
        <>
          <ITTextarea
            name="correctionReason"
            label={t("discrepancy.reason")}
            placeholder={t(kind === "fix" ? "discrepancy.reasonPlaceholder" : "missing.reasonPlaceholder")}
            value={reason}
            rows={2}
            onChange={(value) => setReason(value)}
          />
          {!reasonOk && <ITText muted className="!text-[11px]">{t("discrepancy.reasonMin")}</ITText>}
          <ITButton variant="filled" color="primary" className="w-full" disabled={fx.busy || !ready} onClick={() => void submit()}>
            {t("discrepancy.send")}
          </ITButton>
        </>
      )}
    </div>
  );
};

const Choices = ({ label, columns = 2, children }: { label: string; columns?: number; children: ReactNode }) => (
  <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
    <span className="text-[12px] font-semibold text-slate-700">{label}</span>
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </div>
  </div>
);

const Choice = ({ on, onClick, icon, disabled, children }: { on: boolean; onClick: () => void; icon?: ReactNode; disabled?: boolean; children: ReactNode }) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] font-bold transition disabled:opacity-50"
    style={on ? { backgroundColor: AMBER, color: "#ffffff" } : { backgroundColor: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}
  >
    {icon}
    {children}
  </button>
);
