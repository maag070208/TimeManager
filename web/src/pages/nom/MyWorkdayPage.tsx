import { ITSearchSelect } from "@shared/ui/it-search-select";
import { useMemo, useState, type ReactNode } from "react";
import {
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITInput,
  ITPage,
  ITText,
  ITTextarea,
} from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import {
  LuCalendarCheck,
  LuCheck,
  LuClock,
  LuFileText,
  LuLaptop,
  LuCoffee,
  LuLogIn,
  LuLogOut,
  LuMapPin,
  LuUtensils,
  LuRefreshCw,
  LuX,
} from "react-icons/lu";
import type { PunchType } from "@entities/nom";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { dateLocale } from "@shared/i18n";
import { HelpTip } from "@shared/ui/help-tip";
import { useMyWorkday } from "@features/nom/worker-portal/model/useMyWorkday";
import { useWorkerCompliance } from "@features/nom/worker-portal/model/useWorkerCompliance";
import { useMyLeave } from "@features/nom/worker-portal/model/useMyLeave";

const SOURCE_LABEL: Record<"CLOCK" | "ACCESS" | "REMOTE", string> = {
  CLOCK: "sourceClock",
  ACCESS: "sourceAccess",
  REMOTE: "sourceRemote",
};

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });

const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" });

const sameDay = (iso: string): boolean =>
  new Date(iso).toDateString() === new Date().toDateString();

const CardHeader = ({ icon, title, help }: { icon: ReactNode; title: string; help?: string }) => (
  <ITFlex align="center" gap={2} className="min-w-0">
    <span className="text-slate-500">{icon}</span>
    <ITText className="truncate font-bold">{title}</ITText>
    {help && <HelpTip text={help} />}
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
  const wc = useWorkerCompliance();
  const leave = useMyLeave();
  const [note, setNote] = useState("");
  const [withGeo, setWithGeo] = useState(false);
  const [workMode, setWorkMode] = useState<"PRESENCIAL" | "HIBRIDO" | "REMOTO" | "CAMPO">("REMOTO");
  const [selectedPunch, setSelectedPunch] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, "YES" | "NO">>({});
  const [ackNote, setAckNote] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const todayPunches = useMemo(() => fx.punches.filter((row) => sameDay(row.occurredAt)), [fx.punches]);
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

  // Flujo de checada web: entrada → salida a comer → regreso → salida.
  const PUNCH_LABEL: Record<PunchType, string> = {
    ENTRY: tr("punch.entryShort"),
    LUNCH_START: tr("punch.lunchStart"),
    LUNCH_END: tr("punch.lunchEnd"),
    EXIT: tr("punch.exitShort"),
  };
  const remoteToday = useMemo(
    () => todayPunches.filter((row) => row.source === "REMOTE").reverse(),
    [todayPunches]
  );
  const lastType = remoteToday.length > 0 ? remoteToday[remoteToday.length - 1].type : null;
  const nextTypes: PunchType[] =
    lastType === null
      ? ["ENTRY"]
      : lastType === "ENTRY"
        ? ["LUNCH_START", "EXIT"]
        : lastType === "LUNCH_START"
          ? ["LUNCH_END"]
          : lastType === "LUNCH_END"
            ? ["EXIT"]
            : ["ENTRY"];
  const primaryNext = nextTypes[0];
  const timeByType = (type: PunchType): string | null => {
    const row = [...remoteToday].reverse().find((punch) => punch.type === type);
    return row ? timeOf(row.occurredAt) : null;
  };
  const statusLabel: Record<string, string> = {
    none: todayPunches.length > 0 ? tr("punch.status.clockOnly") : tr("punch.status.none"),
    ENTRY: tr("punch.status.working"),
    LUNCH_START: tr("punch.status.lunch"),
    LUNCH_END: tr("punch.status.back"),
    EXIT: tr("punch.status.done"),
  };
  const statusTone = !lastType ? "gray" : lastType === "LUNCH_START" ? "warning" : lastType === "EXIT" ? "gray" : "success";
  const primaryLabel =
    primaryNext === "ENTRY" || primaryNext === "EXIT"
      ? tr("punch.register", { action: PUNCH_LABEL[primaryNext] })
      : PUNCH_LABEL[primaryNext];
  const PUNCH_ICON: Record<PunchType, ReactNode> = {
    ENTRY: <LuLogIn size={18} />,
    LUNCH_START: <LuUtensils size={18} />,
    LUNCH_END: <LuCoffee size={18} />,
    EXIT: <LuLogOut size={18} />,
  };

  return (
    <ITPage
      className="min-w-full! max-w-none!"
      title={t("title")}
      description={t("description")}
      icon={<LuCalendarCheck size={20} />}
      maxWidth="7xl"
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
      <div className="grid grid-cols-1 items-start gap-4 pb-12 lg:grid-cols-12">
        {fx.error && (
          <ITText className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[13px] text-red-700 lg:col-span-12">
            {fx.error}
          </ITText>
        )}

        {fx.loading && fx.punches.length === 0 ? (
          <ContentSkeleton />
        ) : (
          <>
            {/* Checada del día: siguiente paso grande + los 4 movimientos. */}
            <ITCard className="lg:col-span-7" contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={4}>
                <ITFlex align="center" justify="between" gap={2} wrap="wrap">
                  <ITFlex direction="column" gap={0.5}>
                    <ITText muted className="!text-[11px] font-semibold uppercase tracking-[0.08em]">
                      {tr("punch.today")}
                    </ITText>
                    <ITText className="!text-[15px] font-bold">
                      {new Date().toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" })}
                    </ITText>
                  </ITFlex>
                  <ITBadget color={statusTone as never} size="sm">
                    {statusLabel[lastType ?? "none"]}
                  </ITBadget>
                </ITFlex>

                <button
                  type="button"
                  disabled={fx.busy}
                  onClick={() => void doPunch(primaryNext)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-[#eaf6ef] px-4 py-4 text-left text-slate-900 transition hover:border-emerald-200 hover:brightness-[0.99] disabled:opacity-60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      {PUNCH_ICON[primaryNext]}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {tr("punch.next")}
                      </span>
                      <span className="text-[18px] font-extrabold leading-tight text-slate-900">
                        {primaryLabel}
                      </span>
                    </span>
                  </span>
                  <span className="text-[20px] font-black tabular-nums text-slate-900">
                    {fx.busy ? "…" : timeOf(new Date().toISOString())}
                  </span>
                </button>

                <ITFlex align="center" gap={1}>
                  <ITText muted className="!text-[11.5px]">
                    {tr("punch.channelHint")}
                  </ITText>
                  <HelpTip text="La checada web se marca con la hora del servidor y avanza entrada → comida → regreso → salida. La ubicación es opcional y solo se comparte si la activas." />
                </ITFlex>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["ENTRY", "LUNCH_START", "LUNCH_END", "EXIT"] as PunchType[]).map((type) => {
                    const suggested = nextTypes.includes(type);
                    const time = timeByType(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={fx.busy || !suggested}
                        onClick={() => void doPunch(type)}
                        className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                          suggested
                            ? "border-slate-300 bg-white hover:border-slate-400"
                            : "border-slate-100 bg-slate-50 opacity-60"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                          {PUNCH_ICON[type]}
                          {PUNCH_LABEL[type]}
                        </span>
                        <span className="text-[15px] font-extrabold tabular-nums text-slate-800">
                          {time ?? "--:--"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {todayPunches.length > 0 && (
                  <ITFlex direction="column" gap={1.5}>
                    <ITText muted className="!text-[11px] font-semibold uppercase tracking-[0.08em]">
                      {tr("punch.timeline")}
                    </ITText>
                    {[...todayPunches].reverse().map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                        <ITFlex align="center" gap={2}>
                          <ITText className="!text-[12.5px] font-semibold tabular-nums">{timeOf(row.occurredAt)}</ITText>
                          <ITText className="!text-[12px]">
                            {row.type
                              ? PUNCH_LABEL[row.type]
                              : row.source === "CLOCK"
                                ? tr("punches.clock")
                                : tr("punches.access")}
                          </ITText>
                        </ITFlex>
                        <ITBadget color={row.source === "REMOTE" ? "info" : "gray"} size="sm">
                          {tr(SOURCE_LABEL[row.source])}
                        </ITBadget>
                      </div>
                    ))}
                  </ITFlex>
                )}

                <details className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <summary className="cursor-pointer text-[12px] font-semibold text-slate-600">
                    {tr("punch.options")}
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ITSearchSelect
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
                    <label className="flex items-start gap-2 text-[12px] text-slate-700">
                      <input type="checkbox" className="mt-0.5" checked={withGeo} onChange={(event) => setWithGeo(event.target.checked)} />
                      <span className="flex items-center gap-1.5">
                        <LuMapPin size={13} />
                        {t("punch.shareLocation")}
                      </span>
                    </label>
                    <ITText muted className="!text-[11px]">{t("punch.privacy")}</ITText>
                  </div>
                </details>
              </ITFlex>
            </ITCard>

            {/* Mis marcajes */}
            <ITCard className="lg:col-span-5" contentClassName="!p-4 sm:!p-5">
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
                        {row.source !== "ACCESS" && (
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
            <ITCard className="lg:col-span-6" contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuLaptop size={16} />} title={t("telework.title")} help="NOM-037: el teletrabajo requiere registro, política de desconexión, aviso de privacidad, consentimiento y checklist del lugar. Sin consentimiento no se habilita reportar desde casa." />
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
            {/* Consentimiento de horas extra (F3/1.5) */}
            <ITCard className="lg:col-span-6" contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuClock size={16} />} title={tr("requests.title")} help="El trabajo fuera de jornada requiere tu consentimiento: aquí ves y decides cada solicitud antes de programarla. La decisión queda auditada." />
                <ITText muted className="!text-[12px]">{tr("requests.hint")}</ITText>
                {wc.requests.length === 0 ? (
                  <ITText muted className="!text-[12px]">{tr("requests.empty")}</ITText>
                ) : (
                  <ITFlex direction="column" gap={2}>
                    {wc.requests.map((request) => (
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
                )}
              </ITFlex>
            </ITCard>
            {/* Prueba plena (R-01): método de registro y conformidad semanal */}
            <ITCard className="lg:col-span-7" contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuFileText size={16} />} title={tr("record.title")} help="Prueba plena del registro electrónico: aceptas el método (reloj, web, app o mixto) y la conformidad semanal; si algo no coincide, reportas la discrepancia con nota." />
                <ITText muted className="!text-[12px]">{tr("record.hint")}</ITText>
                {wc.error && (
                  <ITText className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[12px] text-red-700">
                    {wc.error}
                  </ITText>
                )}
                {wc.proposal && (
                  <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                    <ITText className="font-semibold !text-[12.5px]">{tr("record.textTitle")}</ITText>
                    <ITText className="!text-[12px]">{wc.proposal.text}</ITText>
                    <ITFlex gap={1} wrap="wrap">
                      {wc.proposal.methods.map((method) => (
                        <ITBadget key={method} color="info" size="sm">{method}</ITBadget>
                      ))}
                    </ITFlex>
                  </div>
                )}

                {wc.agreement?.acceptedAt ? (
                  <ITFlex align="center" gap={2} wrap="wrap">
                    <ITBadget color="success" size="sm">{tr("record.accepted")}</ITBadget>
                    <ITText muted className="!text-[11px]">
                      {tr("record.version")} {wc.agreement.textVersion} · {dateOf(wc.agreement.acceptedAt)} ·{" "}
                      {wc.agreement.methods.join(" + ")}
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
                  <ITText muted className="!text-[11px]">{tr("record.ackHint")}</ITText>
                  {wc.acknowledgments[0] ? (
                    <ITText muted className="!text-[11px]">
                      {tr("record.lastAck")}: {dateOf(wc.acknowledgments[0].acceptedAt ?? wc.acknowledgments[0].periodEnd)} ·{" "}
                      {wc.acknowledgments[0].status === "ACCEPTED" ? tr("record.ackAccepted") : tr("record.ackDiscrepancySent")}
                    </ITText>
                  ) : (
                    <ITText muted className="!text-[11px]">{tr("record.noAck")}</ITText>
                  )}
                  <ITTextarea
                    name="ackNote"
                    label={tr("record.ackNote")}
                    value={ackNote}
                    onChange={(value) => setAckNote(value)}
                    rows={2}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ITButton
                      variant="filled"
                      color="primary"
                      className="w-full"
                      disabled={wc.busy !== null}
                      onClick={() => void wc.acknowledge(true)}
                    >
                      <LuCheck size={14} className="mr-1" />
                      {tr("record.ackAccept")}
                    </ITButton>
                    <ITButton
                      variant="outlined"
                      color="secondary"
                      className="w-full"
                      disabled={wc.busy !== null || ackNote.trim().length < 3}
                      onClick={() => void wc.acknowledge(false, ackNote.trim())}
                    >
                      {tr("record.ackDiscrepancy")}
                    </ITButton>
                  </div>
                </div>
              </ITFlex>
            </ITCard>

            {/* Vacaciones y permisos */}
            <ITCard className="lg:col-span-5" contentClassName="!p-4 sm:!p-5">
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
                  <label className="flex flex-col gap-1 text-[12px] text-slate-600">
                    {tr("leave.type")}
                    <select
                      value={leaveTypeId || leave.types[0]?.id || ""}
                      onChange={(event) => setLeaveTypeId(event.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-2 text-[13px]"
                    >
                      {leave.types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}{type.paid ? "" : " (sin goce)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[12px] text-slate-600">
                      {tr("leave.from")}
                      <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className="rounded-md border border-slate-200 px-2 py-2 text-[13px]" />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-slate-600">
                      {tr("leave.to")}
                      <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className="rounded-md border border-slate-200 px-2 py-2 text-[13px]" />
                    </label>
                  </div>
                  <ITInput name="leaveReason" label={tr("leave.reason")} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
                  <ITButton
                    variant="filled"
                    color="primary"
                    className="w-full sm:w-auto"
                    disabled={leave.busy || !leaveFrom || !leaveTo}
                    onClick={() => {
                      const typeId = leaveTypeId || leave.types[0]?.id;
                      if (!typeId) return;
                      void leave.request({ typeId, startDate: leaveFrom, endDate: leaveTo, reason: leaveReason || undefined });
                      setLeaveFrom("");
                      setLeaveTo("");
                      setLeaveReason("");
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
                            <ITButton variant="outlined" color="secondary" size="sm" onClick={() => void leave.cancel(request.id)}>
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
          </>
        )}
      </div>
    </ITPage>
  );
}
