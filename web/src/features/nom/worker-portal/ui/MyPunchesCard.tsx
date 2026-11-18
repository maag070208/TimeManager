import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ITBadget, ITButton, ITCard, ITDatePicker, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuCircleCheck, LuCircleX, LuHourglass, LuMapPin, LuPencil } from "react-icons/lu";
import { isRemotePunchSource, type MyPunch, type PunchAdjustment, type PunchSource, type PunchType } from "@entities/nom";
import { DialogHeader } from "@shared/ui/dialog-header";
import { LocationMap } from "@shared/ui/location-map";
import type { useMyWorkday } from "../model/useMyWorkday";
import { useTenantTimezone } from "@entities/user";
import { dateOf, dateStrToLocal, dayLabelOf, localToDateStr, sameDay, timeOf as timeIn, type PortalCardProps } from "./format";
import { CorrectionRequestForm } from "./CorrectionRequestForm";
import { CardHeader } from "./shared";

const CORRECTION_STYLE: Record<PunchAdjustment["status"], { bg: string; fg: string; icon: ReactNode }> = {
  PENDING: { bg: "#fffbeb", fg: "#b45309", icon: <LuHourglass size={11} /> },
  APPROVED: { bg: "#ecfdf5", fg: "#047857", icon: <LuCircleCheck size={11} /> },
  REJECTED: { bg: "#fff1f2", fg: "#be123c", icon: <LuCircleX size={11} /> },
};

const SOURCE_LABEL: Record<PunchSource, string> = {
  CLOCK: "sourceClock",
  ACCESS: "sourceAccess",
  REMOTE: "sourceRemote",
  WEB: "sourceWeb",
  APP: "sourceApp",
};

interface Props extends PortalCardProps {
  fx: ReturnType<typeof useMyWorkday>;
  labels: Record<PunchType, string>;
}

/** Mis marcajes: lista por día, ubicación de cada checada y una sola entrada para pedir correcciones. */
export const MyPunchesCard = ({ className, tr, fx, labels: PUNCH_LABEL }: Props) => {
  const t = tr;
  const timezone = useTenantTimezone();
  const timeOf = (iso: string) => timeIn(iso, timezone);
  const [mapPunch, setMapPunch] = useState<MyPunch | null>(null);
  const [requesting, setRequesting] = useState(false);

  const punchDays = useMemo(() => {
    const days = new Map<string, MyPunch[]>();
    for (const row of fx.punches) {
      const key = sameDay(row.occurredAt, timezone) ? tr("punch.today") : dayLabelOf(new Date(row.occurredAt), timezone, "short");
      const list = days.get(key);
      if (list) list.push(row);
      else days.set(key, [row]);
    }
    return [...days.entries()];
  }, [fx.punches, tr, timezone]);

  return (
    <>
      <ITCard className={`tm-hero-card tm-hero-card--sky ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
        <ITFlex direction="column" gap={3}>
          <CardHeader icon={<LuCalendarCheck size={16} />} title={t("punches.title")} />
          {requesting ? (
            <CorrectionRequestForm tr={tr} fx={fx} labels={PUNCH_LABEL} onClose={() => setRequesting(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setRequesting(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-bold transition hover:brightness-95"
              style={{ backgroundColor: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}
            >
              <LuPencil size={14} /> {t("request.open")}
            </button>
          )}
          <div className="min-w-0">
            <ITDatePicker
              name="punchesRange"
              label={`${t("punches.from")} – ${t("punches.to")}`}
              range
              value={[dateStrToLocal(fx.from) ?? null, dateStrToLocal(fx.to) ?? null]}
              onChange={(event) => {
                const [start, end] = event.target.value as [Date | null, Date | null];
                if (start) fx.setFrom(localToDateStr(start));
                if (end) fx.setTo(localToDateStr(end));
              }}
            />
          </div>

          {fx.punches.length === 0 ? (
            <ITText muted>{t("punches.empty")}</ITText>
          ) : (
            <div className="flex max-h-[540px] flex-col gap-1.5 overflow-y-auto pr-1">
              {punchDays.map(([day, rows]) => (
                <Fragment key={day}>
                  <ITText muted className="mt-1 !text-[11px] font-semibold uppercase tracking-[0.06em]">{day}</ITText>
                  {rows.map((row) => (
                    <Fragment key={row.id}>
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50/80 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <ITText className="shrink-0 font-bold tabular-nums !text-[12.5px]">{timeOf(row.occurredAt)}</ITText>
                          <ITText className="truncate !text-[12px] !text-slate-700">
                            {row.type ? PUNCH_LABEL[row.type] : t("punches.noType")}
                          </ITText>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <ITBadget color={isRemotePunchSource(row.source) ? "info" : "gray"} size="sm">
                            {tr(SOURCE_LABEL[row.source])}
                          </ITBadget>
                          {row.latitude != null && row.longitude != null && (
                            <ITButton
                              variant="text"
                              color="secondary"
                              size="sm"
                              className="!h-7 !min-h-7 !w-7 !border-0 !bg-slate-100 !p-0 !text-slate-500"
                              title="Ver ubicación en el mapa"
                              aria-label="Ver ubicación en el mapa"
                              onClick={() => setMapPunch(row)}
                            >
                              <LuMapPin size={12} />
                            </ITButton>
                          )}
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </div>
          )}

          {fx.corrections.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: "#eef1f5" }}>
              <ITText className="!text-[11px] font-semibold uppercase tracking-[0.06em] !text-slate-500">{t("corrections.title")}</ITText>
              {fx.corrections.slice(0, 5).map((row) => {
                const style = CORRECTION_STYLE[row.status];
                const before = typeof row.previousState.occurredAt === "string" ? row.previousState.occurredAt : null;
                const after = typeof row.newState.occurredAt === "string" ? row.newState.occurredAt : null;
                const missingType = row.targetType === "MISSING" ? (row.newState.type as PunchType | undefined) : undefined;
                return (
                  <div key={row.id} className="flex flex-col gap-1 rounded-xl bg-white/80 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      {missingType && after ? (
                        <span className="text-[12px] font-bold tabular-nums text-slate-800">
                          {t("corrections.missingLabel", { type: PUNCH_LABEL[missingType], date: dateOf(after), time: timeOf(after) })}
                        </span>
                      ) : (
                      <span className="text-[12px] font-bold tabular-nums text-slate-800">
                        {before ? `${dateOf(before)} · ${timeOf(before)}` : "—"}
                        <span className="font-semibold text-slate-500">
                          {" · "}
                          {after && after !== before ? t("corrections.proposed", { time: timeOf(after) }) : t("corrections.noTime")}
                        </span>
                      </span>
                      )}
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: style.bg, color: style.fg }}>
                        {style.icon} {t(`corrections.status.${row.status}`)}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-[11.5px] text-slate-500">{row.reason}</span>
                    {row.decisionNote && <span className="text-[11.5px] text-slate-600">{t("corrections.note", { note: row.decisionNote })}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </ITFlex>
      </ITCard>
    <ITDialog isOpen={!!mapPunch} onClose={() => setMapPunch(null)} className="max-w-2xl">
      <DialogHeader
        icon={<LuMapPin size={20} />}
        title="Ubicación de la checada web"
        subtitle={mapPunch ? `${dateOf(mapPunch.occurredAt)} · ${timeOf(mapPunch.occurredAt)}` : undefined}
      />
      {mapPunch?.latitude != null && mapPunch?.longitude != null && (
        <LocationMap latitude={mapPunch.latitude} longitude={mapPunch.longitude} height={320} caption="Solo se guardó al momento de la checada." />
      )}
      <ITFlex justify="end" className="mt-4">
        <ITButton variant="outlined" color="secondary" onClick={() => setMapPunch(null)}>Cerrar</ITButton>
      </ITFlex>
    </ITDialog>
    </>
  );
};
