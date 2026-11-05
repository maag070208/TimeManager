import { useMemo, useState, type ReactNode } from "react";
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
import {
  LuCalendarCheck,
  LuClock,
  LuLaptop,
  LuLogIn,
  LuLogOut,
  LuMapPin,
  LuRefreshCw,
} from "react-icons/lu";
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

const sameDay = (iso: string): boolean =>
  new Date(iso).toDateString() === new Date().toDateString();

const CardHeader = ({ icon, title }: { icon: ReactNode; title: string }) => (
  <ITFlex align="center" gap={2} className="min-w-0">
    <span className="text-slate-500">{icon}</span>
    <ITText className="truncate font-bold">{title}</ITText>
  </ITFlex>
);

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

  const todayPunches = useMemo(() => fx.punches.filter((row) => sameDay(row.occurredAt)), [fx.punches]);
  const entry = useMemo(() => todayPunches.find((row) => row.type === "ENTRY") ?? null, [todayPunches]);
  const exit = useMemo(
    () => [...todayPunches].reverse().find((row) => row.type === "EXIT") ?? null,
    [todayPunches]
  );
  const open = useMemo(() => {
    const last = todayPunches[0];
    return !!last && last.type === "ENTRY";
  }, [todayPunches]);
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

  const summary = (label: string, icon: ReactNode, row: MyPunch | null) => (
    <ITCard contentClassName="!p-4">
      <ITFlex direction="column" gap={1}>
        <ITFlex align="center" gap={2} className="text-slate-500">
          {icon}
          <ITText muted className="!text-[11px] font-semibold uppercase tracking-wide">
            {label}
          </ITText>
        </ITFlex>
        <ITText className="!text-2xl font-extrabold tabular-nums">
          {row ? timeOf(row.occurredAt) : "--:--"}
        </ITText>
        <ITText muted className="!text-[11px]">
          {row ? tr(SOURCE_LABEL[row.source]) : "—"}
        </ITText>
      </ITFlex>
    </ITCard>
  );

  return (
    <ITPage
      title={t("title")}
      description={t("description")}
      icon={<LuCalendarCheck size={20} />}
      maxWidth="3xl"
      actions={
        <ITButton
          variant="outlined"
          color="secondary"
          className="w-full sm:w-auto"
          onClick={() => void fx.refresh()}
        >
          <LuRefreshCw size={14} className="mr-1" />
          {t("refresh")}
        </ITButton>
      }
    >
      <div className="flex flex-col gap-4 pb-12">
        {fx.error && (
          <ITText className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[13px] text-red-700">
            {fx.error}
          </ITText>
        )}

        {fx.loading && fx.punches.length === 0 ? (
          <ContentSkeleton />
        ) : (
          <>
            {/* Resumen de hoy: en móvil caben las dos tarjetas lado a lado. */}
            <div className="grid grid-cols-2 gap-3">
              {summary(t("punch.entry"), <LuLogIn size={14} />, entry)}
              {summary(t("punch.exit"), <LuLogOut size={14} />, exit)}
            </div>

            {/* Marcaje del día */}
            <ITCard contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <ITFlex align="center" justify="between" gap={2} className="min-w-0">
                  <CardHeader icon={<LuClock size={16} />} title={t("punch.title")} />
                  {open && (
                    <ITBadget color="warning" size="sm">
                      {t("punch.open")}
                    </ITBadget>
                  )}
                </ITFlex>
                <ITText muted className="!text-[12px]">
                  {t("punch.hint")}
                </ITText>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  />
                </div>

                <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={withGeo}
                    onChange={(event) => setWithGeo(event.target.checked)}
                  />
                  <span className="flex items-center gap-1.5">
                    <LuMapPin size={13} />
                    {t("punch.shareLocation")}
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ITButton
                    variant="filled"
                    color="primary"
                    className="w-full"
                    disabled={fx.busy}
                    onClick={() => void doPunch("ENTRY")}
                  >
                    {t("punch.entry")}
                  </ITButton>
                  <ITButton
                    variant="outlined"
                    color="secondary"
                    className="w-full"
                    disabled={fx.busy}
                    onClick={() => void doPunch("EXIT")}
                  >
                    {t("punch.exit")}
                  </ITButton>
                </div>
                <ITText muted className="!text-[11px]">
                  {t("punch.privacy")}
                </ITText>
              </ITFlex>
            </ITCard>

            {/* Mis marcajes */}
            <ITCard contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuCalendarCheck size={16} />} title={t("punches.title")} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-w-0 flex-col gap-1 text-[12px] text-slate-600">
                    {t("punches.from")}
                    <input
                      type="date"
                      value={fx.from}
                      onChange={(event) => fx.setFrom(event.target.value)}
                      className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-2 text-[13px]"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-[12px] text-slate-600">
                    {t("punches.to")}
                    <input
                      type="date"
                      value={fx.to}
                      onChange={(event) => fx.setTo(event.target.value)}
                      className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-2 text-[13px]"
                    />
                  </label>
                </div>

                {fx.punches.length === 0 ? (
                  <ITText muted>{t("punches.empty")}</ITText>
                ) : (
                  <ITFlex direction="column" gap={2}>
                    {fx.punches.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <ITBadget color={row.source === "REMOTE" ? "info" : "gray"} size="sm">
                            {tr(SOURCE_LABEL[row.source])}
                          </ITBadget>
                          <ITText className="!text-[13px]">{dateOf(row.occurredAt)}</ITText>
                          <ITText className="font-semibold tabular-nums !text-[13px]">
                            {timeOf(row.occurredAt)}
                          </ITText>
                          <ITText muted className="!text-[12px]">
                            {row.type ? tr(row.type === "ENTRY" ? "punches.entry" : "punches.exit") : t("punches.noType")}
                          </ITText>
                        </div>
                        {row.source === "CLOCK" && (
                          <ITButton
                            variant="outlined"
                            color="secondary"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setSelectedPunch(row.id);
                              setReason("");
                            }}
                          >
                            {t("punches.report")}
                          </ITButton>
                        )}
                      </div>
                    ))}
                  </ITFlex>
                )}

                {selectedPunch && (
                  <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                    <ITTextarea
                      name="reason"
                      label={t("discrepancy.reason")}
                      value={reason}
                      onChange={(value) => setReason(value)}
                      rows={2}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <ITButton
                        variant="filled"
                        color="primary"
                        className="w-full"
                        disabled={reason.trim().length < 5}
                        onClick={() => void submitDiscrepancy()}
                      >
                        {t("discrepancy.send")}
                      </ITButton>
                      <ITButton
                        variant="outlined"
                        color="secondary"
                        className="w-full"
                        onClick={() => setSelectedPunch(null)}
                      >
                        {t("cancel")}
                      </ITButton>
                    </div>
                  </div>
                )}
              </ITFlex>
            </ITCard>

            {/* Teletrabajo */}
            <ITCard contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuLaptop size={16} />} title={t("telework.title")} />
                {!telework || !telework.registration ? (
                  <div className="flex flex-col items-start gap-3 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                      <LuLaptop size={18} />
                    </span>
                    <ITText muted className="!text-[12px]">
                      {t("telework.notRegistered")}
                    </ITText>
                  </div>
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

                    <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3">
                      {[
                        { title: t("telework.policyTitle"), body: telework.policy.teleworkPolicy },
                        { title: t("telework.disconnectTitle"), body: telework.policy.disconnectPolicy },
                        { title: t("telework.privacyTitle"), body: telework.policy.privacyNotice },
                      ].map((section) => (
                        <div key={section.title} className="min-w-0">
                          <ITText className="font-semibold !text-[13px]">{section.title}</ITText>
                          <ITText className="whitespace-pre-line !text-[12px]">
                            {section.body ?? t("telework.noPolicy")}
                          </ITText>
                        </div>
                      ))}
                    </div>

                    {!telework.consentCurrent && (
                      <ITFlex align="center" gap={2} wrap="wrap">
                        <ITText muted className="!text-[12px]">
                          {t("telework.consentPending")}
                        </ITText>
                        <ITButton
                          variant="filled"
                          color="primary"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void fx.acceptPolicy()}
                        >
                          {t("telework.accept")}
                        </ITButton>
                      </ITFlex>
                    )}

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
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <ITButton
                          variant="filled"
                          color="primary"
                          size="sm"
                          className="w-full sm:w-auto"
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
                      </div>
                    </div>
                  </>
                )}
              </ITFlex>
            </ITCard>
          </>
        )}
      </div>
    </ITPage>
  );
}
