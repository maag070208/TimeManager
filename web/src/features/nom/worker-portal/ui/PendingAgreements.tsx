import { ITBadget, ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import type { useWorkerCompliance } from "../model/useWorkerCompliance";
import { dayOf, type Tr } from "./format";

interface Props {
  tr: Tr;
  wc: ReturnType<typeof useWorkerCompliance>;
  /** La tarjeta de checada ya muestra el acuerdo de método: aquí no se repite. */
  hideMethod: boolean;
}

/** Acuerdos que la persona tiene pendientes de aceptar (método de registro y jornada). */
export const PendingAgreements = ({ tr, wc, hideMethod }: Props) => (
  <>
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
