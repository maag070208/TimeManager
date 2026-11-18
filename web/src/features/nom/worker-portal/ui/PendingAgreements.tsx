import { useState } from "react";
import { ITBadget, ITButton, ITCard, ITCheckbox, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuShieldCheck } from "react-icons/lu";
import type { useWorkerCompliance } from "../model/useWorkerCompliance";
import { dayOf, type Tr } from "./format";

interface Props {
  tr: Tr;
  wc: ReturnType<typeof useWorkerCompliance>;
  /** La tarjeta de checada ya muestra el acuerdo de método: aquí no se repite. */
  hideMethod: boolean;
}

/**
 * Aviso de privacidad del cliente: va primero porque cubre todo lo demás
 * (biometría y ubicación). Se acepta una vez por versión.
 */
const PrivacyNoticeCard = ({ tr, wc }: Pick<Props, "tr" | "wc">) => {
  const [read, setRead] = useState(false);
  const privacy = wc.privacy;
  if (!privacy?.notice || privacy.accepted) return null;
  return (
    <div className="mb-4">
      <ITCard className="tm-hero-card tm-hero-card--lavender" contentClassName="!p-4 sm:!p-5">
        <ITFlex direction="column" gap={3}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#ede9fe", color: "#6d28d9" }}>
              <LuShieldCheck size={18} />
            </span>
            <div className="min-w-0">
              <ITText className="font-bold">{tr("privacy.title")}</ITText>
              <ITText muted className="!text-[12.5px]">{tr("privacy.lead")}</ITText>
            </div>
          </div>
          <div
            tabIndex={0}
            aria-label={tr("privacy.title")}
            className="max-h-64 overflow-y-auto whitespace-pre-line rounded-xl border bg-white/90 p-3 text-[12.5px] leading-relaxed text-slate-700"
            style={{ borderColor: "#e9d5ff" }}
          >
            {privacy.notice}
          </div>
          <ITText muted className="!text-[11px]">{tr("privacy.version", { version: privacy.version })}</ITText>
          <ITCheckbox name="privacyRead" label={tr("privacy.check")} checked={read} onChange={(checked) => setRead(checked)} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ITButton variant="filled" color="primary" disabled={!read || wc.busy !== null} onClick={() => void wc.acceptPrivacy()}>
              {tr("privacy.accept")}
            </ITButton>
            <ITText muted className="!text-[11.5px]">{tr("privacy.noLocation")}</ITText>
          </div>
        </ITFlex>
      </ITCard>
    </div>
  );
};

/** Acuerdos que la persona tiene pendientes de aceptar (aviso de privacidad, método de registro y jornada). */
export const PendingAgreements = ({ tr, wc, hideMethod }: Props) => (
  <>
    {!wc.loading && <PrivacyNoticeCard tr={tr} wc={wc} />}
    {!wc.loading && wc.proposal && !wc.agreement?.acceptedAt && !hideMethod && (
      <div className="mb-4">
      <ITCard className="tm-hero-card tm-hero-card--amber" contentClassName="!p-4 sm:!p-5">
        <ITFlex direction="column" gap={2}>
          <ITText className="font-bold">{tr("agreements.methodTitle")}</ITText>
          <ITText className="!text-[13px]">{wc.proposal.text}</ITText>
          <ITFlex gap={1} wrap="wrap">
            {wc.proposal.methods.map((method) => (
              <ITBadget key={method} color="info" size="sm">{tr(`agreements.methods.${method}`)}</ITBadget>
            ))}
          </ITFlex>
          <div>
          <ITButton variant="filled" color="primary" disabled={wc.busy !== null} onClick={() => void wc.acceptAgreement()}>
            {tr("agreements.methodAccept")}
          </ITButton>
          </div>
        </ITFlex>
      </ITCard>
      </div>
    )}
    {wc.scheduleAgreements.filter((row) => !row.acceptedAt).map((row) => (
      <div key={row.id} className="mb-4">
      <ITCard className="tm-hero-card tm-hero-card--sky" contentClassName="!p-4 sm:!p-5">
        <ITFlex direction="column" gap={2}>
          <ITText className="font-bold">{tr("agreements.scheduleTitle")}</ITText>
          <ITText className="!text-[13px]">{row.evidenceText}</ITText>
          <ITText muted className="!text-[12px]">
            {row.effectiveTo
              ? tr("agreements.range", { from: dayOf(row.effectiveFrom), to: dayOf(row.effectiveTo) })
              : tr("agreements.from", { from: dayOf(row.effectiveFrom) })}
          </ITText>
          <ITText muted className="!text-[12px]">{tr("agreements.scheduleHint")}</ITText>
          <div>
          <ITButton variant="filled" color="primary" disabled={wc.busy !== null} onClick={() => void wc.acceptScheduleAgreement(row.id)}>
            {tr("agreements.scheduleAccept")}
          </ITButton>
          </div>
        </ITFlex>
      </ITCard>
      </div>
    ))}
  </>
);
