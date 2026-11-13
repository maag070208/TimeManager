import { useState } from "react";
import { ITBadget, ITButton, ITCard, ITDatePicker, ITFlex, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuX } from "react-icons/lu";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import type { useMyLeave } from "../model/useMyLeave";
import { dateOf, dateStrToLocal, localToDateStr, type PortalCardProps } from "./format";
import { CardHeader } from "./shared";

interface Props extends PortalCardProps {
  leave: ReturnType<typeof useMyLeave>;
}

/** Vacaciones y permisos: saldo, solicitud y estado de las últimas solicitudes. */
export const LeaveCard = ({ className, tr, leave }: Props) => {
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  return (
    <ITCard className={`tm-hero-card tm-hero-card--sky ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
      <ITFlex direction="column" gap={3}>
        <CardHeader icon={<LuCalendarCheck size={16} />} title={tr("leave.title")} />
        <ITText muted className="!text-[12px]">{tr("leave.hint")}</ITText>
        {leave.balance && (
          <ITFlex gap={2} wrap="wrap">
            <ITBadget color="success" size="sm">
              {tr("leave.available")}: {leave.balance.availableDays} d
            </ITBadget>
            <ITBadget color="gray" size="sm">
              {tr("leave.used")}: {leave.balance.usedDays} d
            </ITBadget>
            <ITBadget color="warning" size="sm">
              {tr("leave.pending")}: {leave.balance.pendingDays} d
            </ITBadget>
          </ITFlex>
        )}
        {leave.error && (
          <ITText className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[12px] text-red-700">
            {leave.error}
          </ITText>
        )}
        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
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
          <ITButton
            variant="filled"
            color="primary"
            className="w-full sm:w-auto"
            disabled={leave.busy || !leaveFrom || !leaveTo}
            onClick={() => {
              const typeId = leaveTypeId || leave.types[0]?.id;
              if (!typeId) return;
              void leave.request({ typeId, startDate: leaveFrom, endDate: leaveTo, reason: leaveReason || undefined }).then((ok) => {
                if (!ok) return;
                setLeaveFrom("");
                setLeaveTo("");
                setLeaveReason("");
              });
            }}
          >
            {tr("leave.request")}
          </ITButton>
        </div>
        {leave.requests.length > 0 && (
          <ITFlex direction="column" gap={2}>
            {leave.requests.slice(0, 5).map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2.5">
                <div className="min-w-0">
                  <ITText className="!text-[12.5px] font-semibold">{request.type.name}</ITText>
                  <ITText muted className="!text-[11px]">
                    {dateOf(request.startDate)} – {dateOf(request.endDate)} · {request.days} d
                  </ITText>
                </div>
                <ITFlex align="center" gap={1}>
                  <ITBadget
                    color={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "PENDING" ? "warning" : "gray"}
                    size="sm"
                  >
                    {tr(`leave.status.${request.status}`)}
                  </ITBadget>
                  {request.status === "PENDING" && (
                    <ITButton variant="outlined" color="secondary" size="sm" disabled={leave.busy} title={tr("leave.cancel")} aria-label={tr("leave.cancel")} onClick={() => void leave.cancel(request.id)}>
                      <LuX size={12} />
                    </ITButton>
                  )}
                </ITFlex>
              </div>
            ))}
          </ITFlex>
        )}
      </ITFlex>
    </ITCard>
  );
};
