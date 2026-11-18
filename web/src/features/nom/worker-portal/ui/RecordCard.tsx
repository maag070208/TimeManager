import { useState } from "react";
import { ITBadget, ITButton, ITTextarea } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuCheck, LuPenLine, LuFileText, LuTriangleAlert } from "react-icons/lu";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import type { useWorkerCompliance } from "../model/useWorkerCompliance";
import { dateOf, type PortalCardProps } from "./format";
import { ErrorNote, HeroCard, HeroHeader, Notice, QuietLink, SolidButton } from "./shared";

interface Props extends PortalCardProps {
  wc: ReturnType<typeof useWorkerCompliance>;
}

/** Prueba plena (R-01): conformidad de la semana y el acuerdo del método de registro. */
export const RecordCard = ({ className, tr, wc }: Props) => {
  const [ackNote, setAckNote] = useState("");
  const [reportingWeek, setReportingWeek] = useState(false);
  const busy = wc.busy !== null;
  const ack = wc.weekAck;
  const agreement = wc.agreement?.acceptedAt ? wc.agreement : null;

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <HeroCard tone={!ack ? "sky" : ack.status === "ACCEPTED" ? "mint" : "amber"}>
        <HeroHeader
          eyebrow={tr("record.ackTitle")}
          title={tr("record.title")}
          aside={ack && (
            <ITBadget color={ack.status === "ACCEPTED" ? "success" : "warning"} size="sm">
              {ack.status === "ACCEPTED" ? tr("record.ackAccepted") : tr("record.ackDiscrepancySent")}
            </ITBadget>
          )}
        />

        <div className="mt-4 flex flex-col gap-2">
          {wc.error && <ErrorNote>{wc.error}</ErrorNote>}
          {ack ? (
            <Notice
              icon={ack.status === "ACCEPTED" ? <LuCheck size={18} /> : <LuTriangleAlert size={18} />}
              chip={ack.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}
              title={ack.status === "ACCEPTED" ? tr("record.ackAccepted") : tr("record.ackDiscrepancySent")}
              hint={tr("record.ackDoneHint")}
            />
          ) : reportingWeek ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-50/80 p-4">
              <ITTextarea name="ackNote" label={tr("record.ackNote")} value={ackNote} onChange={(value) => setAckNote(value)} rows={3} />
              <SolidButton
                color="#d97706"
                icon={<LuTriangleAlert size={20} />}
                label={tr("record.ackSend")}
                busy={busy}
                disabled={ackNote.trim().length < 3}
                onClick={() => {
                  void wc.acknowledge(false, ackNote.trim());
                  setReportingWeek(false);
                  setAckNote("");
                }}
              />
              <QuietLink onClick={() => setReportingWeek(false)}>{tr("cancel")}</QuietLink>
            </div>
          ) : (
            <>
              <span className="text-[22px] font-black leading-tight">{tr("record.ackHint")}</span>
              <span className="mb-1 text-[12.5px] text-slate-500">{tr("record.hint")}</span>
              <SolidButton
                color="#059669"
                icon={<LuCalendarCheck size={22} />}
                eyebrow="Esta semana"
                label={tr("record.ackAccept")}
                busy={busy}
                cta
                onClick={() => void wc.acknowledge(true)}
              />
              <QuietLink disabled={busy} onClick={() => setReportingWeek(true)}>{tr("record.ackDiscrepancy")}</QuietLink>
            </>
          )}
        </div>
      </HeroCard>

      {agreement ? (
        <BentoKpiGrid
          minItemWidth={140}
          items={[
            {
              id: "agreement",
              label: tr("record.textTitle"),
              value: tr("record.accepted"),
              caption: `${tr("record.version")} ${agreement.textVersion} · ${dateOf(agreement.acceptedAt!)} · ${agreement.methods.map((method) => tr(`agreements.methods.${method}`)).join(", ")}`,
              icon: <LuFileText size={14} />,
              tone: "success",
            },
            {
              id: "employer",
              label: "Firma de la empresa",
              value: agreement.employerAcceptedAt ? "Firmado" : "Pendiente",
              caption: agreement.employerAcceptedAt ? tr("record.employerSigned") : tr("record.employerPending"),
              icon: <LuPenLine size={14} />,
              tone: agreement.employerAcceptedAt ? "success" : "warning",
            },
          ]}
        />
      ) : (
        <ITButton variant="outlined" color="secondary" className="w-full" disabled={busy} onClick={() => void wc.acceptAgreement()}>
          {tr("record.accept")}
        </ITButton>
      )}
    </div>
  );
};
