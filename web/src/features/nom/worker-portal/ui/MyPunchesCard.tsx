import { Fragment, useMemo, useState } from "react";
import { ITBadget, ITButton, ITCard, ITDatePicker, ITDialog, ITFlex, ITText, ITTextarea, ITTimePicker } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuMapPin } from "react-icons/lu";
import { isRemotePunchSource, type MyPunch, type PunchSource, type PunchType } from "@entities/nom";
import { DialogHeader } from "@shared/ui/dialog-header";
import { LocationMap } from "@shared/ui/location-map";
import type { useMyWorkday } from "../model/useMyWorkday";
import { useTenantTimezone } from "@entities/user";
import { dateOf, dateStrToLocal, dayLabelOf, localToDateStr, sameDay, timeOf as timeIn, zonedIso, type PortalCardProps } from "./format";
import { dateKeyInTimeZone } from "@shared/utils/dates";
import { CardHeader } from "./shared";

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

/** Mis marcajes: lista por día, ubicación de cada checada y reporte de discrepancia. */
export const MyPunchesCard = ({ className, tr, fx, labels: PUNCH_LABEL }: Props) => {
  const t = tr;
  const timezone = useTenantTimezone();
  const timeOf = (iso: string) => timeIn(iso, timezone);
  const [mapPunch, setMapPunch] = useState<MyPunch | null>(null);
  const [selectedPunch, setSelectedPunch] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [correctTime, setCorrectTime] = useState("");

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

  const submitDiscrepancy = async () => {
    if (!selectedPunch || reason.trim().length < 5) return;
    const punch = fx.punches.find((row) => row.id === selectedPunch);
    const expected =
      punch && correctTime ? zonedIso(dateKeyInTimeZone(new Date(punch.occurredAt), timezone), correctTime, timezone) : undefined;
    if (await fx.reportDiscrepancy(selectedPunch, reason.trim(), expected)) {
      setSelectedPunch(null);
      setReason("");
      setCorrectTime("");
    }
  };

  return (
    <>
      <ITCard className={`tm-hero-card tm-hero-card--sky ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
        <ITFlex direction="column" gap={3}>
          <CardHeader icon={<LuCalendarCheck size={16} />} title={t("punches.title")} />
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
                          {row.source !== "ACCESS" && (
                            <ITButton
                              variant="text"
                              color="secondary"
                              size="sm"
                              className="!h-7 !min-h-7 !border-0 !bg-slate-100 !px-2 !text-[11px] !text-slate-600"
                              aria-label={`${t("punches.report")} · ${timeOf(row.occurredAt)}`}
                              onClick={() => {
                                setSelectedPunch(selectedPunch === row.id ? null : row.id);
                                setReason("");
                              }}
                            >
                              {t("punches.reportShort")}
                            </ITButton>
                          )}
                        </div>
                      </div>
                      {selectedPunch === row.id && (
                        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
                          <ITTimePicker name="correctTime" label={t("discrepancy.correctTime")} value={correctTime} onChange={(event) => setCorrectTime(event.target.value)} />
                          <ITTextarea
                            name="reason"
                            label={t("discrepancy.reason")}
                            value={reason}
                            onChange={(value) => setReason(value)}
                            rows={2}
                          />
                          {reason.trim().length < 5 && <ITText muted className="!text-[11px]">{t("discrepancy.reasonMin")}</ITText>}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <ITButton
                              variant="filled"
                              color="primary"
                              className="w-full"
                              disabled={fx.busy || reason.trim().length < 5}
                              onClick={() => void submitDiscrepancy()}
                            >
                              {t("discrepancy.send")}
                            </ITButton>
                            <ITButton variant="outlined" color="secondary" className="w-full" onClick={() => setSelectedPunch(null)}>
                              {t("cancel")}
                            </ITButton>
                          </div>
                        </div>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
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
