import { ITSearchSelect } from "@shared/ui/it-search-select";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITInput,
  ITText,
  ITTextarea, ITDatePicker, ITDialog } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
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
import type { MyPunch, PunchType } from "@entities/nom";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { dateLocale } from "@shared/i18n";
import { HelpTip } from "@shared/ui/help-tip";
import { BentoKpiGrid, type BentoKpiItem } from "@shared/ui/bento-filter-cards";
import { TabBar, type TabBarItem } from "@shared/ui/tab-bar";
import { LocationMap } from "@shared/ui/location-map";
import { DialogHeader } from "@shared/ui/dialog-header";
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

const dayOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
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
const dateStrToLocal = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};
const localToDateStr = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function MyWorkdayPage() {
  const { t } = useTranslation("nom");
  const tr = t as unknown as (key: string, vars?: Record<string, unknown>) => string;
  const fx = useMyWorkday();
  const wc = useWorkerCompliance();
  const leave = useMyLeave();
  const [mapPunch, setMapPunch] = useState<MyPunch | null>(null);
  const [selectedPunch, setSelectedPunch] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, "YES" | "NO">>({});
  const [ackNote, setAckNote] = useState("");
  const [reportingWeek, setReportingWeek] = useState(false);
  const [refillChecklist, setRefillChecklist] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [tab, setTab] = useState<"checada" | "telework" | "compliance" | "leave">("checada");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayPunches = useMemo(() => fx.punches.filter((row) => sameDay(row.occurredAt)), [fx.punches]);
  const punchDays = useMemo(() => {
    const days = new Map<string, MyPunch[]>();
    for (const row of fx.punches) {
      const key = sameDay(row.occurredAt)
        ? t("punch.today")
        : new Date(row.occurredAt).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "short" });
      const list = days.get(key);
      if (list) list.push(row);
      else days.set(key, [row]);
    }
    return [...days.entries()];
  }, [fx.punches, t]);
  const telework = fx.telework;
  const geoEnabled = telework?.remoteGeolocationEnabled ?? true;
  const lunchEnabled = telework?.lunchPunchEnabled ?? true;
  const canPunch = telework?.canPunchRemote ?? true;
  const checklistItems = telework?.checklistTemplate.items ?? [];
  const checklistDue =
    !telework?.lastChecklist || (telework.nextPeriodicDueAt != null && new Date(telework.nextPeriodicDueAt) <= now);
  const pendingRequests = wc.requests.filter((request) => request.status === "PENDING").length;
  const teleworkPending = telework?.registration ? (telework.consentCurrent ? 0 : 1) + (checklistDue ? 1 : 0) : 0;

  // La ubicación la decide la empresa (Configuración); la modalidad, el registro
  // de teletrabajo de RH. La persona solo marca.
  const doPunch = (type: PunchType) => fx.punch(type, { withGeolocation: geoEnabled });

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
    if (ok) {
      setAnswers({});
      setRefillChecklist(false);
    }
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
        ? lunchEnabled ? ["LUNCH_START", "EXIT"] : ["EXIT"]
        : lastType === "LUNCH_START"
          ? lunchEnabled ? ["LUNCH_END"] : ["LUNCH_END", "EXIT"]
          : lastType === "LUNCH_END"
            ? ["EXIT"]
            : [];
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
  const primaryLabel = !primaryNext
    ? ""
    : primaryNext === "ENTRY" || primaryNext === "EXIT"
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
      className="m-0! min-w-full! p-0! px-8! pb-12!"
      noPadding
      title={t("title")}
      description={t("description")}
      icon={<LuCalendarCheck size={20} />}
      actions={
        <ITButton
          variant="outlined"
          color="secondary"
          className="tm-icon-button"
          onClick={() => void fx.refresh()}
          title={t("refresh")}
          aria-label={t("refresh")}
        >
          <LuRefreshCw size={14} />
        </ITButton>
      }
    >
      <TabBar
        items={[
          { id: "checada", label: "Mi checada", icon: <LuCalendarCheck size={13} /> },
          ...(telework?.registration ? [{ id: "telework" as const, label: "Teletrabajo", icon: <LuLaptop size={13} />, count: teleworkPending || undefined }] : []),
          { id: "compliance", label: "Registro y horas extra", icon: <LuFileText size={13} />, count: pendingRequests || undefined },
          { id: "leave", label: "Vacaciones y permisos", icon: <LuClock size={13} /> },
        ] as TabBarItem<"checada" | "telework" | "compliance" | "leave">[]}
        value={tab}
        onChange={setTab}
      />

      {wc.error && tab !== "compliance" && (
        <ITText className="mb-4 block rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[13px] text-red-700">{wc.error}</ITText>
      )}
      {!wc.loading && wc.proposal && !wc.agreement?.acceptedAt && (
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

      <div className={tab === "checada" ? "" : "hidden"}>
      <BentoKpiGrid
        items={(
          [
          { id: "entry", label: PUNCH_LABEL.ENTRY, value: timeByType("ENTRY") ?? "—", caption: timeByType("ENTRY") ? "Registrada" : "Pendiente", icon: <LuLogIn size={14} />, tone: "success" },
          { id: "lunch-start", label: PUNCH_LABEL.LUNCH_START, value: timeByType("LUNCH_START") ?? "—", caption: timeByType("LUNCH_START") ? "Registrada" : "Pendiente", icon: <LuUtensils size={14} />, tone: "warning" },
          { id: "lunch-end", label: PUNCH_LABEL.LUNCH_END, value: timeByType("LUNCH_END") ?? "—", caption: timeByType("LUNCH_END") ? "Registrada" : "Pendiente", icon: <LuCoffee size={14} />, tone: "info" },
          { id: "exit", label: PUNCH_LABEL.EXIT, value: timeByType("EXIT") ?? "—", caption: timeByType("EXIT") ? "Registrada" : "Pendiente", icon: <LuLogOut size={14} />, tone: "neutral" },
          ] satisfies BentoKpiItem[]
        ).filter((item) => lunchEnabled || (item.id !== "lunch-start" && item.id !== "lunch-end"))}
      />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 pb-12 lg:grid-cols-12">
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
            <ITCard className={`tm-hero-card tm-hero-card--mint ${tab === "checada" ? "lg:col-span-7" : "hidden"}`} contentClassName="!p-4 sm:!p-5">
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

                {!canPunch ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                      <LuClock size={18} />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[18px] font-extrabold leading-tight text-slate-900">{tr("punch.clockOnlyTitle")}</span>
                      <span className="text-[12.5px] text-slate-600">{tr("punch.clockOnlyHint")}</span>
                    </span>
                  </div>
                ) : primaryNext ? (
                  <>
                    <button
                      type="button"
                      disabled={fx.busy}
                      onClick={() => void doPunch(primaryNext!)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left text-slate-900 transition hover:brightness-[0.99] disabled:opacity-60"
                      style={{ backgroundColor: "#eaf6ef", borderColor: "#d1fae5", color: "#0f172a" }}
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          {PUNCH_ICON[primaryNext!]}
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
                        {fx.busy ? "…" : timeOf(now.toISOString())}
                      </span>
                    </button>
                    {nextTypes.slice(1).map((type) => (
                      <ITButton key={type} variant="outlined" color="secondary" className="w-full" disabled={fx.busy} onClick={() => void doPunch(type)}>
                        <span className="inline-flex items-center justify-center gap-2">
                          {PUNCH_ICON[type]}
                          {type === "EXIT" ? tr("punch.register", { action: PUNCH_LABEL[type] }) : PUNCH_LABEL[type]}
                        </span>
                      </ITButton>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <LuCalendarCheck size={18} />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[18px] font-extrabold leading-tight text-slate-900">{tr("punch.dayClosed")}</span>
                      <span className="text-[12.5px] text-slate-600">{tr("punch.dayClosedHint")}</span>
                    </span>
                  </div>
                )}
                {canPunch && (
                  <ITText muted className="!text-[11.5px]">
                    {tr("punch.channelHint")}
                  </ITText>
                )}
                {canPunch && geoEnabled && (
                  <ITText muted className="flex items-start gap-1.5 !text-[11.5px]">
                    <LuMapPin size={13} className="mt-0.5 shrink-0" />
                    <span>{tr("punch.locationNotice")}</span>
                  </ITText>
                )}
              </ITFlex>
            </ITCard>

            {/* Mis marcajes */}
            <ITCard className={`tm-hero-card tm-hero-card--sky ${tab === "checada" ? "lg:col-span-5" : "hidden"}`} contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuCalendarCheck size={16} />} title={t("punches.title")} />
                <div className="min-w-0">
                  <ITDatePicker
                    name="punchesRange"
                    label={`${t("punches.from")} – ${t("punches.to")}`}
                    range
                    value={[dateStrToLocal(fx.from) ?? null, dateStrToLocal(fx.to) ?? null]}
                    onChange={(event) => {
                      const [start, end] = event.target.value as [Date | null, Date | null];
                      if (start) fx.setFrom(localToDateStr(start));
                      if (end) fx.setTo(localToDateStr(end));
                    }}
                  />
                </div>

                {fx.punches.length === 0 ? (
                  <ITText muted>{t("punches.empty")}</ITText>
                ) : (
                  <div className="flex max-h-[540px] flex-col gap-1.5 overflow-y-auto pr-1">
                    {punchDays.map(([day, rows]) => (
                      <Fragment key={day}>
                        <ITText muted className="mt-1 !text-[11px] font-semibold uppercase tracking-[0.06em]">{day}</ITText>
                        {rows.map((row) => (
                          <Fragment key={row.id}>
                            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50/80 px-3 py-2">
                              <div className="flex min-w-0 items-center gap-3">
                                <ITText className="shrink-0 font-bold tabular-nums !text-[12.5px]">{timeOf(row.occurredAt)}</ITText>
                                <ITText className="truncate !text-[12px] !text-slate-700">
                                  {row.type ? PUNCH_LABEL[row.type] : t("punches.noType")}
                                </ITText>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <ITBadget color={row.source === "REMOTE" ? "info" : "gray"} size="sm">
                                  {tr(SOURCE_LABEL[row.source])}
                                </ITBadget>
                                {row.latitude != null && row.longitude != null && (
                                  <ITButton
                                    variant="text"
                                    color="secondary"
                                    size="sm"
                                    className="!h-7 !min-h-7 !w-7 !border-0 !bg-slate-100 !p-0 !text-slate-500"
                                    title="Ver ubicación en el mapa"
                                    aria-label="Ver ubicación en el mapa"
                                    onClick={() => setMapPunch(row)}
                                  >
                                    <LuMapPin size={12} />
                                  </ITButton>
                                )}
                                {row.source !== "ACCESS" && (
                                  <ITButton
                                    variant="text"
                                    color="secondary"
                                    size="sm"
                                    className="!h-7 !min-h-7 !border-0 !bg-slate-100 !px-2 !text-[11px] !text-slate-600"
                                    aria-label={`${t("punches.report")} · ${timeOf(row.occurredAt)}`}
                                    onClick={() => {
                                      setSelectedPunch(selectedPunch === row.id ? null : row.id);
                                      setReason("");
                                    }}
                                  >
                                    {t("punches.reportShort")}
                                  </ITButton>
                                )}
                              </div>
                            </div>
                            {selectedPunch === row.id && (
                              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
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
                                  <ITButton variant="outlined" color="secondary" className="w-full" onClick={() => setSelectedPunch(null)}>
                                    {t("cancel")}
                                  </ITButton>
                                </div>
                              </div>
                            )}
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                  </div>
                )}
              </ITFlex>
            </ITCard>

            {/* Teletrabajo */}
            <ITCard className={`tm-hero-card tm-hero-card--amber ${tab === "telework" ? "lg:col-span-12" : "hidden"}`} contentClassName="!p-4 sm:!p-5">
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
            {/* Consentimiento de horas extra (F3/1.5) */}
            <ITCard className={`tm-hero-card tm-hero-card--amber ${tab === "compliance" && wc.requests.length > 0 ? "lg:col-span-5" : "hidden"}`} contentClassName="!p-4 sm:!p-5">
              <ITFlex direction="column" gap={3}>
                <CardHeader icon={<LuClock size={16} />} title={tr("requests.title")} help="El trabajo fuera de jornada requiere tu consentimiento: aquí ves y decides cada solicitud antes de programarla. La decisión queda auditada." />
                <ITText muted className="!text-[12px]">{tr("requests.hint")}</ITText>
                {(
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
                )}
              </ITFlex>
            </ITCard>
            {/* Prueba plena (R-01): método de registro y conformidad semanal */}
            <ITCard className={`tm-hero-card tm-hero-card--mint ${tab === "compliance" ? (wc.requests.length > 0 ? "lg:col-span-7" : "lg:col-span-12") : "hidden"}`} contentClassName="!p-4 sm:!p-5">
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
                            <LuCheck size={14} className="mr-1" />
                            {tr("record.ackAccept")}
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

            {/* Vacaciones y permisos */}
            <ITCard className={`tm-hero-card tm-hero-card--sky ${tab === "leave" ? "lg:col-span-12" : "hidden"}`} contentClassName="!p-4 sm:!p-5">
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
      <ITDialog isOpen={!!mapPunch} onClose={() => setMapPunch(null)} className="max-w-2xl">
        <DialogHeader
          icon={<LuMapPin size={20} />}
          title="Ubicación de la checada web"
          subtitle={mapPunch ? `${dateOf(mapPunch.occurredAt)} · ${timeOf(mapPunch.occurredAt)}` : undefined}
        />
        {mapPunch?.latitude != null && mapPunch?.longitude != null && (
          <LocationMap latitude={mapPunch.latitude} longitude={mapPunch.longitude} height={320} caption="Solo se guardó al momento de la checada." />
        )}
        <ITFlex justify="end" className="mt-4">
          <ITButton variant="outlined" color="secondary" onClick={() => setMapPunch(null)}>Cerrar</ITButton>
        </ITFlex>
      </ITDialog>
    </ITPage>
  );
}
