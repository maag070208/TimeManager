import { useMemo, useState } from "react";
import {
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITInput,
  ITPage,
  ITSelect,
  ITText,
  ITTextarea,
} from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuCalendarCheck, LuClock, LuMapPin, LuRefreshCw } from "react-icons/lu";
import type { MyPunch, PunchType } from "@entities/nom";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { useMyWorkday } from "@features/nom/worker-portal/model/useMyWorkday";

const SOURCE_LABEL: Record<MyPunch["source"], string> = {
  CLOCK: "sourceClock",
  ACCESS: "sourceAccess",
  REMOTE: "sourceRemote",
};

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

/**
 * Portal del trabajador (F2-07/F2-08): marcaje remoto (home office/campo),
 * consulta de sus marcajes, reporte de discrepancia y estado de teletrabajo
 * (política, consentimiento y checklist del lugar de trabajo).
 */
export default function MyWorkdayPage() {
  const { t } = useTranslation("nom");
  const tr = t as unknown as (key: string, vars?: Record<string, unknown>) => string;
  const fx = useMyWorkday();
  const [note, setNote] = useState("");
  const [withGeo, setWithGeo] = useState(false);
  const [workMode, setWorkMode] = useState<"PRESENCIAL" | "HIBRIDO" | "REMOTO" | "CAMPO">("REMOTO");
  const [selectedPunch, setSelectedPunch] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, "YES" | "NO">>({});

  const todayPunches = useMemo(
    () =>
      fx.punches.filter(
        (row) => new Date(row.occurredAt).toDateString() === new Date().toDateString()
      ),
    [fx.punches]
  );
  const lastRemote = useMemo(
    () => todayPunches.find((row) => row.source === "REMOTE") ?? null,
    [todayPunches]
  );
  const telework = fx.telework;
  const checklistItems = telework?.checklistTemplate.items ?? [];

  const doPunch = async (type: PunchType) => {
    const ok = await fx.punch(type, { note: note.trim() || undefined, withGeolocation: withGeo, workMode });
    if (ok) setNote("");
  };

  const submitDiscrepancy = async () => {
    if (!selectedPunch || reason.trim().length < 5) return;
    const ok = await fx.reportDiscrepancy(selectedPunch, reason.trim());
    if (ok) {
      setSelectedPunch(null);
      setReason("");
    }
  };

  const submitChecklist = async (kind: "INITIAL" | "PERIODIC") => {
    if (checklistItems.some((key) => !answers[key])) return;
    const ok = await fx.submitChecklist(kind, answers);
    if (ok) setAnswers({});
  };

  return (
    <ITPage
      title={t("title")}
      description={t("description")}
      icon={<LuCalendarCheck size={20} />}
      maxWidth="4xl"
      actions={
        <ITButton variant="outlined" color="secondary" size="lg" onClick={() => void fx.refresh()}>
          <LuRefreshCw size={14} className="mr-1" />
          {t("refresh")}
        </ITButton>
      }
    >
      <ITFlex direction="column" gap={4} className="pb-12">
        {fx.error && (
          <ITText className="rounded-md border border-red-200 bg-red-50 px-3 py-2 !text-[13px] text-red-700">
            {fx.error}
          </ITText>
        )}

        {fx.loading && fx.punches.length === 0 ? (
          <ContentSkeleton />
        ) : (
          <>
            {/* Marcaje del día */}
            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={3}>
                <ITFlex align="center" gap={2}>
                  <LuClock size={16} />
                  <ITText className="font-bold">{t("punch.title")}</ITText>
                  {lastRemote?.type === "ENTRY" && (
                    <ITBadget color="warning" size="sm">
                      {t("punch.open")}
                    </ITBadget>
                  )}
                </ITFlex>
                <ITText muted className="!text-[12px]">
                  {t("punch.hint")}
                </ITText>
                <ITFlex gap={2} wrap="wrap" align="end">
                  <ITSelect
                    name="punchMode"
                    label={t("punch.mode")}
                    value={workMode}
                    onChange={(event) => setWorkMode(event.target.value as typeof workMode)}
                    options={[
                      { value: "REMOTO", label: t("telework.mode.REMOTO") },
                      { value: "HIBRIDO", label: t("telework.mode.HIBRIDO") },
                      { value: "PRESENCIAL", label: t("telework.mode.PRESENCIAL") },
                      { value: "CAMPO", label: t("telework.mode.CAMPO") },
                    ]}
                  />
                  <ITInput
                    name="punchNote"
                    label={t("punch.note")}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-w-[220px] flex-1"
                  />
                  <label className="flex items-center gap-2 text-[12px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={withGeo}
                      onChange={(event) => setWithGeo(event.target.checked)}
                    />
                    <LuMapPin size={12} />
                    {t("punch.shareLocation")}
                  </label>
                </ITFlex>
                <ITFlex gap={2} wrap="wrap">
                  <ITButton
                    variant="filled"
                    color="primary"
                    onClick={() => void doPunch("ENTRY")}
                  >
                    {t("punch.entry")}
                  </ITButton>
                  <ITButton
                    variant="outlined"
                    color="secondary"
                    onClick={() => void doPunch("EXIT")}
                  >
                    {t("punch.exit")}
                  </ITButton>
                </ITFlex>
                <ITText muted className="!text-[11px]">
                  {t("punch.privacy")}
                </ITText>
              </ITFlex>
            </ITCard>

            {/* Mis marcajes */}
            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={3}>
                <ITText className="font-bold">{t("punches.title")}</ITText>
                <ITFlex gap={2} wrap="wrap">
                  <label className="flex flex-col gap-1 text-[12px] text-slate-600">
                    {t("punches.from")}
                    <input
                      type="date"
                      value={fx.from}
                      onChange={(event) => fx.setFrom(event.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-[13px]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] text-slate-600">
                    {t("punches.to")}
                    <input
                      type="date"
                      value={fx.to}
                      onChange={(event) => fx.setTo(event.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-[13px]"
                    />
                  </label>
                </ITFlex>
                {fx.punches.length === 0 ? (
                  <ITText muted>{t("punches.empty")}</ITText>
                ) : (
                  <ITFlex direction="column" gap={2}>
                    {fx.punches.map((row) => (
                      <ITFlex
                        key={row.id}
                        align="center"
                        justify="between"
                        gap={2}
                        className="rounded-md border border-slate-100 px-3 py-2"
                      >
                        <ITFlex align="center" gap={2} className="min-w-0">
                          <ITBadget color={row.source === "REMOTE" ? "info" : "gray"} size="sm">
                            {tr(SOURCE_LABEL[row.source])}
                          </ITBadget>
                          <ITText className="!text-[13px]">{dateOf(row.occurredAt)}</ITText>
                          <ITText className="font-semibold !text-[13px]">{timeOf(row.occurredAt)}</ITText>
                          <ITText muted className="!text-[12px]">
                            {row.type ? tr(row.type === "ENTRY" ? "punches.entry" : "punches.exit") : t("punches.noType")}
                          </ITText>
                        </ITFlex>
                        {row.source === "CLOCK" && (
                          <ITButton
                            variant="outlined"
                            color="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedPunch(row.id);
                              setReason("");
                            }}
                          >
                            {t("punches.report")}
                          </ITButton>
                        )}
                      </ITFlex>
                    ))}
                  </ITFlex>
                )}

                {selectedPunch && (
                  <ITFlex direction="column" gap={2} className="rounded-md bg-slate-50 p-3">
                    <ITTextarea
                      name="reason"
                      label={t("discrepancy.reason")}
                      value={reason}
                      onChange={(value) => setReason(value)}
                      rows={2}
                    />
                    <ITFlex gap={2}>
                      <ITButton
                        variant="filled"
                        color="primary"
                        disabled={reason.trim().length < 5}
                        onClick={() => void submitDiscrepancy()}
                      >
                        {t("discrepancy.send")}
                      </ITButton>
                      <ITButton variant="outlined" color="secondary" onClick={() => setSelectedPunch(null)}>
                        {t("cancel")}
                      </ITButton>
                    </ITFlex>
                  </ITFlex>
                )}
              </ITFlex>
            </ITCard>

            {/* Teletrabajo */}
            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={3}>
                <ITText className="font-bold">{t("telework.title")}</ITText>
                {!telework || !telework.registration ? (
                  <ITText muted>{t("telework.notRegistered")}</ITText>
                ) : (
                  <>
                    <ITFlex align="center" gap={2} wrap="wrap">
                      <ITBadget color="success" size="sm">
                        {tr(`telework.mode.${telework.registration.mode}`)}
                      </ITBadget>
                      <ITText muted className="!text-[12px]">
                        {t("telework.registration")}: {telework.registration.homeAddress ?? "—"}
                      </ITText>
                    </ITFlex>

                    <ITFlex direction="column" gap={1}>
                      <ITText className="font-semibold !text-[13px]">{t("telework.policyTitle")}</ITText>
                      <ITText className="whitespace-pre-line !text-[12px]">
                        {telework.policy.teleworkPolicy ?? t("telework.noPolicy")}
                      </ITText>
                      <ITText className="font-semibold !text-[13px]">{t("telework.disconnectTitle")}</ITText>
                      <ITText className="whitespace-pre-line !text-[12px]">
                        {telework.policy.disconnectPolicy ?? t("telework.noPolicy")}
                      </ITText>
                      <ITText className="font-semibold !text-[13px]">{t("telework.privacyTitle")}</ITText>
                      <ITText className="whitespace-pre-line !text-[12px]">
                        {telework.policy.privacyNotice ?? t("telework.noPolicy")}
                      </ITText>
                    </ITFlex>

                    {!telework.consentCurrent && (
                      <ITFlex align="center" gap={2} wrap="wrap">
                        <ITText muted className="!text-[12px]">
                          {t("telework.consentPending")}
                        </ITText>
                        <ITButton
                          variant="filled"
                          color="primary"
                          size="sm"
                          onClick={() => void fx.acceptPolicy()}
                        >
                          {t("telework.accept")}
                        </ITButton>
                      </ITFlex>
                    )}

                    <ITFlex direction="column" gap={2} className="rounded-md border border-slate-100 p-3">
                      <ITText className="font-semibold !text-[13px]">{t("telework.checklistTitle")}</ITText>
                      <ITText muted className="!text-[11px]">
                        {t("telework.checklistHint")}
                      </ITText>
                      {checklistItems.map((key) => (
                        <ITFlex key={key} align="center" justify="between" gap={2}>
                          <ITText className="!text-[12px]">{tr(`checklist.items.${key}`)}</ITText>
                          <ITFlex gap={1}>
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
                          </ITFlex>
                        </ITFlex>
                      ))}
                      <ITFlex gap={2}>
                        <ITButton
                          variant="filled"
                          color="primary"
                          size="sm"
                          disabled={checklistItems.some((key) => !answers[key])}
                          onClick={() => void submitChecklist(telework.lastChecklist ? "PERIODIC" : "INITIAL")}
                        >
                          {t("checklist.submit")}
                        </ITButton>
                        {telework.lastChecklist && (
                          <ITText muted className="!text-[11px]">
                            {t("telework.lastChecklist")}: {dateOf(telework.lastChecklist.completedAt)}
                          </ITText>
                        )}
                      </ITFlex>
                    </ITFlex>
                  </>
                )}
              </ITFlex>
            </ITCard>
          </>
        )}
      </ITFlex>
    </ITPage>
  );
}
