import { useState } from "react";
import { ITBadget, ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuLaptop } from "react-icons/lu";
import type { useMyWorkday } from "../model/useMyWorkday";
import { dateOf, type PortalCardProps } from "./format";
import { CardHeader } from "./shared";

interface Props extends PortalCardProps {
  fx: ReturnType<typeof useMyWorkday>;
  /** Toca llenar el checklist (inicial o periódico). */
  checklistDue: boolean;
}

/** Teletrabajo (NOM-037): políticas, consentimiento y checklist del lugar de trabajo. */
export const TeleworkCard = ({ className, tr, fx, checklistDue }: Props) => {
  const t = tr;
  const telework = fx.telework;
  const checklistItems = telework?.checklistTemplate.items ?? [];
  const [answers, setAnswers] = useState<Record<string, "YES" | "NO">>({});
  const [refillChecklist, setRefillChecklist] = useState(false);

  const submitChecklist = async (kind: "INITIAL" | "PERIODIC") => {
    if (checklistItems.some((key) => !answers[key])) return;
    if (await fx.submitChecklist(kind, answers)) {
      setAnswers({});
      setRefillChecklist(false);
    }
  };

  return (
    <ITCard className={`tm-hero-card tm-hero-card--amber ${className ?? ""}`} contentClassName="!p-4 sm:!p-5">
      <ITFlex direction="column" gap={3}>
        <CardHeader icon={<LuLaptop size={16} />} title={t("telework.title")} help="NOM-037: el teletrabajo requiere registro, política de desconexión, aviso de privacidad, consentimiento y checklist del lugar. Sin consentimiento no se habilita reportar desde casa." />
        {telework?.registration && (
          <>
            <ITFlex align="center" gap={2} wrap="wrap">
              <ITBadget color="success" size="sm">
                {tr(`telework.mode.${telework.registration.mode}`)}
              </ITBadget>
              <ITText muted className="!text-[12px]">
                {t("telework.registration")}: {telework.registration.homeAddress ?? "—"}
              </ITText>
            </ITFlex>

            <div className="flex flex-col gap-2">
              {[
                { title: t("telework.policyTitle"), body: telework.policy.teleworkPolicy },
                { title: t("telework.disconnectTitle"), body: telework.policy.disconnectPolicy },
                { title: t("telework.equipmentTitle"), body: telework.policy.equipmentPolicy },
                { title: t("telework.returnTitle"), body: telework.policy.returnToOfficePolicy },
                { title: t("telework.privacyTitle"), body: telework.policy.privacyNotice },
              ].map((section) => (
                <details key={section.title} className="rounded-lg bg-slate-50 px-3 py-2">
                  <summary className="cursor-pointer text-[13px] font-semibold text-slate-800">{section.title}</summary>
                  <ITText className="mt-2 block whitespace-pre-line !text-[12px]">
                    {section.body ?? t("telework.noPolicy")}
                  </ITText>
                </details>
              ))}
            </div>

            {telework.consentCurrent ? (
              <ITFlex align="center" gap={2}>
                <ITBadget color="success" size="sm">{tr("telework.consentDone")}</ITBadget>
              </ITFlex>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <ITText className="!text-[12.5px] text-amber-900">{t("telework.consentPending")}</ITText>
                <ITButton variant="filled" color="primary" size="sm" className="w-full sm:w-auto" disabled={fx.busy} onClick={() => void fx.acceptPolicy()}>
                  {t("telework.accept")}
                </ITButton>
              </div>
            )}

            {!checklistDue && !refillChecklist ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
                <div>
                  <ITText className="block font-semibold !text-[13px]">{t("telework.checklistTitle")}</ITText>
                  <ITText muted className="block !text-[11.5px]">
                    {tr("telework.checklistOk", { date: dateOf(telework.lastChecklist!.completedAt) })}
                    {telework.nextPeriodicDueAt ? ` · ${tr("telework.checklistNext", { date: dateOf(telework.nextPeriodicDueAt) })}` : ""}
                  </ITText>
                </div>
                <ITButton variant="text" color="secondary" size="sm" onClick={() => setRefillChecklist(true)}>
                  {tr("telework.checklistRefill")}
                </ITButton>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-100 p-3">
                <ITText className="font-semibold !text-[13px]">{t("telework.checklistTitle")}</ITText>
                <ITText muted className="!text-[11px]">
                  {t("telework.checklistHint")}
                </ITText>
                {checklistItems.map((key) => (
                  <div
                    key={key}
                    className="flex flex-col gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <ITText className="!text-[12px]">{tr(`checklist.items.${key}`)}</ITText>
                    <div className="flex shrink-0 gap-1">
                      <ITButton
                        size="sm"
                        variant={answers[key] === "YES" ? "filled" : "outlined"}
                        color={answers[key] === "YES" ? "primary" : "secondary"}
                        onClick={() => setAnswers((prev) => ({ ...prev, [key]: "YES" }))}
                      >
                        {t("checklist.yes")}
                      </ITButton>
                      <ITButton
                        size="sm"
                        variant={answers[key] === "NO" ? "filled" : "outlined"}
                        color={answers[key] === "NO" ? "danger" : "secondary"}
                        onClick={() => setAnswers((prev) => ({ ...prev, [key]: "NO" }))}
                      >
                        {t("checklist.no")}
                      </ITButton>
                    </div>
                  </div>
                ))}
                <div>
                  <ITButton
                    variant="filled"
                    color="primary"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={fx.busy || checklistItems.some((key) => !answers[key])}
                    onClick={() => void submitChecklist(telework.lastChecklist ? "PERIODIC" : "INITIAL")}
                  >
                    {t("checklist.submit")}
                  </ITButton>
                </div>
              </div>
            )}
          </>
        )}
      </ITFlex>
    </ITCard>
  );
};
