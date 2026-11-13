import { useState } from "react";
import { ITBadget, ITButton, ITCard, ITFlex, ITText, ITTextarea } from "@axzydev/axzy_ui_system";
import { LuCheck, LuFileText } from "react-icons/lu";
import type { useWorkerCompliance } from "../model/useWorkerCompliance";
import { dateOf, type PortalCardProps } from "./format";
import { CardHeader } from "./shared";

interface Props extends PortalCardProps {
  wc: ReturnType<typeof useWorkerCompliance>;
}

/** Prueba plena (R-01): método de registro aceptado y conformidad semanal. */
export const RecordCard = ({ className, tr, wc }: Props) => {
  const t = tr;
  const [ackNote, setAckNote] = useState("");
  const [reportingWeek, setReportingWeek] = useState(false);

  return (
    <ITCard className={`tm-hero-card tm-hero-card--mint ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
      <ITFlex direction="column" gap={3}>
        <CardHeader icon={<LuFileText size={16} />} title={tr("record.title")} help="Prueba plena del registro electrónico: aceptas el método (reloj, web, app o mixto) y la conformidad semanal; si algo no coincide, reportas la discrepancia con nota." />
        <ITText muted className="!text-[12px]">{tr("record.hint")}</ITText>
        {wc.error && (
          <ITText className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[12px] text-red-700">
            {wc.error}
          </ITText>
        )}
        {wc.agreement?.acceptedAt ? (
          <ITFlex align="center" gap={2} wrap="wrap">
            <ITBadget color="success" size="sm">{tr("record.accepted")}</ITBadget>
            <ITText muted className="!text-[11px]">
              {tr("record.version")} {wc.agreement.textVersion} · {dateOf(wc.agreement.acceptedAt)} ·{" "}
              {wc.agreement.methods.map((method) => tr(`agreements.methods.${method}`)).join(" · ")}
            </ITText>
            <ITBadget color={wc.agreement.employerAcceptedAt ? "success" : "warning"} size="sm">
              {wc.agreement.employerAcceptedAt ? tr("record.employerSigned") : tr("record.employerPending")}
            </ITBadget>
          </ITFlex>
        ) : (
          <ITButton
            variant="outlined"
            color="secondary"
            className="w-full sm:w-auto"
            disabled={wc.busy !== null}
            onClick={() => void wc.acceptAgreement()}
          >
            {tr("record.accept")}
          </ITButton>
        )}

        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
          <ITText className="font-semibold !text-[13px]">{tr("record.ackTitle")}</ITText>
          {wc.weekAck ? (
            <ITFlex align="center" gap={2} wrap="wrap">
              <ITBadget color={wc.weekAck.status === "ACCEPTED" ? "success" : "warning"} size="sm">
                {wc.weekAck.status === "ACCEPTED" ? tr("record.ackAccepted") : tr("record.ackDiscrepancySent")}
              </ITBadget>
              <ITText muted className="!text-[11.5px]">{tr("record.ackDoneHint")}</ITText>
            </ITFlex>
          ) : (
            <>
              <ITText muted className="!text-[11.5px]">{tr("record.ackHint")}</ITText>
              {reportingWeek ? (
                <>
                  <ITTextarea name="ackNote" label={tr("record.ackNote")} value={ackNote} onChange={(value) => setAckNote(value)} rows={2} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ITButton
                      variant="filled"
                      color="primary"
                      className="w-full"
                      disabled={wc.busy !== null || ackNote.trim().length < 3}
                      onClick={() => {
                        void wc.acknowledge(false, ackNote.trim());
                        setReportingWeek(false);
                        setAckNote("");
                      }}
                    >
                      {tr("record.ackSend")}
                    </ITButton>
                    <ITButton variant="outlined" color="secondary" className="w-full" onClick={() => setReportingWeek(false)}>
                      {t("cancel")}
                    </ITButton>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ITButton variant="filled" color="primary" className="w-full" disabled={wc.busy !== null} onClick={() => void wc.acknowledge(true)}>
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <LuCheck size={14} />
                      {tr("record.ackAccept")}
                    </span>
                  </ITButton>
                  <ITButton variant="outlined" color="secondary" className="w-full" disabled={wc.busy !== null} onClick={() => setReportingWeek(true)}>
                    {tr("record.ackDiscrepancy")}
                  </ITButton>
                </div>
              )}
            </>
          )}
        </div>
      </ITFlex>
    </ITCard>
  );
};
