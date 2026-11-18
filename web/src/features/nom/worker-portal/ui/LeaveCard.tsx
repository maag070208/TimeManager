import { useState } from "react";
import { ITBadget, ITButton, ITCard, ITDatePicker, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { LuCalendarClock, LuCalendarDays, LuHourglass, LuPlane, LuSend, LuX } from "react-icons/lu";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import type { useMyLeave } from "../model/useMyLeave";
import { dateOf, dateStrToLocal, localToDateStr, type PortalCardProps } from "./format";
import { CardHeader, ErrorNote, HeroCard, HeroHeader, QuietLink, SolidButton } from "./shared";

interface Props extends PortalCardProps {
  leave: ReturnType<typeof useMyLeave>;
}

const STATUS_COLOR = { APPROVED: "success", REJECTED: "danger", PENDING: "warning", CANCELLED: "gray" } as const;

/** Vacaciones y permisos: saldo, solicitud y estado de las últimas solicitudes. */
export const LeaveCard = ({ className, tr, leave }: Props) => {
  const [requesting, setRequesting] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const balance = leave.balance;

  const close = () => {
    setRequesting(false);
    setLeaveFrom("");
    setLeaveTo("");
    setLeaveReason("");
  };

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <HeroCard tone="sky">
        <HeroHeader eyebrow={tr("leave.title")} title={tr("leave.hint")} />

        <div className="mt-3 flex items-end gap-2">
          <span className="text-[48px] font-black leading-none tracking-tight tabular-nums">{balance?.availableDays ?? 0}</span>
          <span className="pb-1 text-[15px] font-bold text-slate-500">días {tr("leave.available").toLowerCase()}</span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {leave.error && <ErrorNote>{leave.error}</ErrorNote>}
          {requesting ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-50/80 p-4">
              {leave.types.length > 1 && (
                <ITSearchSelect
                  name="leaveType"
                  label={tr("leave.type")}
                  value={leaveTypeId || leave.types[0]?.id || ""}
                  onChange={(event) => setLeaveTypeId(String(event.target.value))}
                  options={leave.types.map((type) => ({ value: type.id, label: `${type.name}${type.paid ? "" : " (sin goce)"}` }))}
                />
              )}
              <ITDatePicker
                name="leaveRange"
                label={`${tr("leave.from")} – ${tr("leave.to")}`}
                range
                value={[dateStrToLocal(leaveFrom) ?? null, dateStrToLocal(leaveTo) ?? null]}
                onChange={(event) => {
                  const [start, end] = event.target.value as [Date | null, Date | null];
                  if (start) setLeaveFrom(localToDateStr(start));
                  if (end) setLeaveTo(localToDateStr(end));
                }}
              />
              <ITInput name="leaveReason" label={tr("leave.reason")} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
              <SolidButton
                color="#0284c7"
                icon={<LuSend size={20} />}
                label={tr("leave.request")}
                busy={leave.busy}
                disabled={!leaveFrom || !leaveTo}
                onClick={() => {
                  const typeId = leaveTypeId || leave.types[0]?.id;
                  if (!typeId) return;
                  void leave.request({ typeId, startDate: leaveFrom, endDate: leaveTo, reason: leaveReason || undefined }).then((ok) => {
                    if (ok) close();
                  });
                }}
              />
              <QuietLink onClick={close}>{tr("cancel")}</QuietLink>
            </div>
          ) : (
            <SolidButton
              color="#0284c7"
              icon={<LuPlane size={22} />}
              eyebrow="¿Necesitas días?"
              label="Pedir vacaciones o permiso"
              disabled={leave.types.length === 0}
              onClick={() => setRequesting(true)}
            />
          )}
        </div>
      </HeroCard>

      {balance && (
        <BentoKpiGrid
          minItemWidth={140}
          items={[
            { id: "used", label: tr("leave.used"), value: balance.usedDays, caption: "días", icon: <LuCalendarDays size={14} />, tone: "neutral" },
            { id: "pending", label: tr("leave.pending"), value: balance.pendingDays, caption: "días", icon: <LuHourglass size={14} />, tone: balance.pendingDays > 0 ? "warning" : "neutral" },
          ]}
        />
      )}

      {leave.requests.length > 0 && (
        <ITCard contentClassName="!p-4 sm:!p-5">
          <CardHeader icon={<LuCalendarClock size={16} />} title="Mis solicitudes" />
          <div className="tm-rows mt-2">
            {leave.requests.slice(0, 5).map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <ITText className="!text-[13px] font-semibold">{request.type.name}</ITText>
                  <ITText muted className="!text-[11.5px]">
                    {dateOf(request.startDate)} – {dateOf(request.endDate)} · {request.days} d
                  </ITText>
                </div>
                <span className="flex items-center gap-1">
                  <ITBadget color={STATUS_COLOR[request.status as keyof typeof STATUS_COLOR] ?? "gray"} size="sm">
                    {tr(`leave.status.${request.status}`)}
                  </ITBadget>
                  {request.status === "PENDING" && (
                    <ITButton variant="outlined" color="secondary" size="sm" disabled={leave.busy} title={tr("leave.cancel")} aria-label={tr("leave.cancel")} onClick={() => void leave.cancel(request.id)}>
                      <LuX size={12} />
                    </ITButton>
                  )}
                </span>
              </div>
            ))}
          </div>
        </ITCard>
      )}
    </div>
  );
};
