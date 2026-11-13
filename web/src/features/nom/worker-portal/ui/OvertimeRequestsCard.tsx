import { ITBadget, ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuCheck, LuClock, LuX } from "react-icons/lu";
import type { useWorkerCompliance } from "../model/useWorkerCompliance";
import { type PortalCardProps } from "./format";
import { CardHeader } from "./shared";

interface Props extends PortalCardProps {
  wc: ReturnType<typeof useWorkerCompliance>;
}

/** Consentimiento de horas extra (F3/1.5): la persona acepta o rechaza cada solicitud. */
export const OvertimeRequestsCard = ({ className, tr, wc }: Props) => (
  <ITCard className={`tm-hero-card tm-hero-card--amber ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
    <ITFlex direction="column" gap={3}>
      <CardHeader icon={<LuClock size={16} />} title={tr("requests.title")} help="El trabajo fuera de jornada requiere tu consentimiento: aquí ves y decides cada solicitud antes de programarla. La decisión queda auditada." />
      <ITText muted className="!text-[12px]">{tr("requests.hint")}</ITText>
      <ITFlex direction="column" gap={2}>
          {[...wc.requests].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING")).map((request) => (
            <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3">
              <ITFlex align="center" justify="between" gap={2} wrap="wrap">
                <ITText className="font-semibold !text-[13px]">{request.reason}</ITText>
                <ITBadget
                  color={request.status === "ACCEPTED" ? "success" : request.status === "REJECTED" ? "danger" : request.status === "CANCELLED" ? "gray" : "warning"}
                  size="sm"
                >
                  {tr(`requests.${request.status.toLowerCase()}`)}
                </ITBadget>
              </ITFlex>
              <ITText muted className="!text-[11px]">
                {tr("requests.planned")}: {Math.floor(request.plannedMin / 60)}h {request.plannedMin % 60}m
                {request.days.length > 0 ? ` · ${tr("requests.days")}: ${request.days.join(", ")}` : ""}
              </ITText>
              {request.workerNote && (
                <ITText muted className="!text-[11px]">{request.workerNote}</ITText>
              )}
              {request.status === "PENDING" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ITButton
                    variant="filled"
                    color="primary"
                    size="sm"
                    className="w-full"
                    disabled={wc.busy !== null}
                    onClick={() => void wc.decideRequest(request.id, true)}
                  >
                    <LuCheck size={13} className="mr-1" />
                    {tr("requests.accept")}
                  </ITButton>
                  <ITButton
                    variant="outlined"
                    color="secondary"
                    size="sm"
                    className="w-full"
                    disabled={wc.busy !== null}
                    onClick={() => void wc.decideRequest(request.id, false)}
                  >
                    <LuX size={13} className="mr-1" />
                    {tr("requests.reject")}
                  </ITButton>
                </div>
              )}
            </div>
          ))}
      </ITFlex>
    </ITFlex>
  </ITCard>
);
