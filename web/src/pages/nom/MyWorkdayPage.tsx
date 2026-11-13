import { useEffect, useMemo, useState } from "react";
import { ITButton } from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { useTranslation } from "react-i18next";
import { LuCalendarCheck, LuClock, LuCoffee, LuFileText, LuLaptop, LuLogIn, LuLogOut, LuRefreshCw, LuUtensils } from "react-icons/lu";
import { isRemotePunchSource, type PunchType } from "@entities/nom";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { BentoKpiGrid, type BentoKpiItem } from "@shared/ui/bento-filter-cards";
import { TabBar, type TabBarItem } from "@shared/ui/tab-bar";
import {
  ErrorNote,
  LeaveCard,
  MyPunchesCard,
  OvertimeRequestsCard,
  PendingAgreements,
  PunchCard,
  RecordCard,
  TeleworkCard,
  sameDay,
  timeOf,
  useMyLeave,
  useMyWorkday,
  useWorkerCompliance,
  type Tr,
} from "@features/nom/worker-portal";

type Tab = "checada" | "telework" | "compliance" | "leave";

/**
 * Portal del trabajador (F2-07/F2-08): checada web, sus marcajes, teletrabajo,
 * prueba plena del registro y vacaciones. Cada pestaña es una tarjeta de
 * `features/nom/worker-portal/ui`; aquí solo se arma el estado del día.
 */
export default function MyWorkdayPage() {
  const { t } = useTranslation("nom");
  const tr = t as unknown as Tr;
  const fx = useMyWorkday();
  const wc = useWorkerCompliance();
  const leave = useMyLeave();
  const [tab, setTab] = useState<Tab>("checada");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayPunches = useMemo(() => fx.punches.filter((row) => sameDay(row.occurredAt)), [fx.punches]);
  const telework = fx.telework;
  const geoEnabled = telework?.remoteGeolocationEnabled ?? true;
  const lunchEnabled = telework?.lunchPunchEnabled ?? true;
  // La checada de ESTA pantalla es la web: se gatea por canal WEB, no por el
  // agregado `canPunchRemote` (que también cuenta la app).
  const canPunch = telework?.canPunchWeb ?? (telework?.canPunchRemote ?? true);
  /** Mismo candado que el API (REMOTE_AGREEMENT_REQUIRED): sin acuerdo con REMOTE no se checa. */
  const agreementLocked =
    canPunch &&
    telework?.remoteAgreementRequired === true &&
    (wc.loading || !wc.agreement?.acceptedAt || !wc.agreement.methods.includes("REMOTE"));
  /** Sin canal CLOCK la empresa no tiene reloj checador: nunca se le menciona. */
  const hasClock = telework?.punchChannels?.includes("CLOCK") ?? true;
  /** Cliente con app pero sin checada web: la pantalla lo manda a la app. */
  const appOnly = !hasClock && telework?.canPunchApp === true;
  const checklistDue =
    !telework?.lastChecklist || (telework.nextPeriodicDueAt != null && new Date(telework.nextPeriodicDueAt) <= now);
  const pendingRequests = wc.requests.filter((request) => request.status === "PENDING").length;
  const teleworkPending = telework?.registration ? (telework.consentCurrent ? 0 : 1) + (checklistDue ? 1 : 0) : 0;

  // La ubicación la decide la empresa (Configuración); la modalidad, el registro
  // de teletrabajo de RH. La persona solo marca.
  const doPunch = (type: PunchType) => fx.punch(type, { withGeolocation: geoEnabled });


  // Flujo de checada web: entrada → salida a comer → regreso → salida.
  const PUNCH_LABEL: Record<PunchType, string> = {
    ENTRY: tr("punch.entryShort"),
    LUNCH_START: tr("punch.lunchStart"),
    LUNCH_END: tr("punch.lunchEnd"),
    EXIT: tr("punch.exitShort"),
  };
  const remoteToday = useMemo(
    () => todayPunches.filter((row) => isRemotePunchSource(row.source)).reverse(),
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
    none: todayPunches.length > 0 && hasClock ? tr("punch.status.clockOnly") : tr("punch.status.none"),
    ENTRY: tr("punch.status.working"),
    LUNCH_START: tr("punch.status.lunch"),
    LUNCH_END: tr("punch.status.back"),
    EXIT: tr("punch.status.done"),
  };
  const statusTone = !lastType ? "gray" : lastType === "LUNCH_START" ? "warning" : lastType === "EXIT" ? "gray" : "success";
  /** Un solo clic: acepta el acuerdo y registra el siguiente paso. */
  const acceptAndPunch = async () => {
    if ((await wc.acceptAgreement()) && primaryNext) await doPunch(primaryNext);
  };

  const show = (id: Tab, span: string) => (tab === id ? span : "hidden");

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
        ] as TabBarItem<Tab>[]}
        value={tab}
        onChange={setTab}
      />

      {wc.error && tab !== "compliance" && (
        <div className="mb-4">
          <ErrorNote>{wc.error}</ErrorNote>
        </div>
      )}
      <PendingAgreements tr={tr} wc={wc} hideMethod={agreementLocked && tab === "checada"} />

      <div className={tab === "checada" ? "" : "hidden"}>
        <BentoKpiGrid
          items={(
            [
              { id: "entry", type: "ENTRY", icon: <LuLogIn size={14} />, tone: "success" },
              { id: "lunch-start", type: "LUNCH_START", icon: <LuUtensils size={14} />, tone: "warning" },
              { id: "lunch-end", type: "LUNCH_END", icon: <LuCoffee size={14} />, tone: "info" },
              { id: "exit", type: "EXIT", icon: <LuLogOut size={14} />, tone: "neutral" },
            ] as const
          )
            .filter((step) => lunchEnabled || (step.type !== "LUNCH_START" && step.type !== "LUNCH_END"))
            .map((step): BentoKpiItem => {
              const time = timeByType(step.type);
              return { id: step.id, label: PUNCH_LABEL[step.type], value: time ?? "—", caption: time ? "Registrada" : "Pendiente", icon: step.icon, tone: step.tone };
            })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 pb-12 lg:grid-cols-12">
        {fx.error && (
          <div className="lg:col-span-12">
            <ErrorNote>{fx.error}</ErrorNote>
          </div>
        )}

        {fx.loading && fx.punches.length === 0 ? (
          <ContentSkeleton />
        ) : (
          <>
            <PunchCard
              className={show("checada", "lg:col-span-7")}
              tr={tr}
              clock={timeOf(now.toISOString())}
              status={{ label: statusLabel[lastType ?? "none"], tone: statusTone }}
              labels={PUNCH_LABEL}
              nextTypes={nextTypes}
              canPunch={canPunch}
              hasClock={hasClock}
              appOnly={appOnly}
              geoEnabled={geoEnabled}
              agreementLocked={agreementLocked}
              proposal={wc.proposal}
              stage={wc.busy === "agreement" ? "accepting" : fx.punchStage}
              onPunch={(type) => void doPunch(type)}
              onAcceptAndPunch={() => void acceptAndPunch()}
            />
            <MyPunchesCard className={show("checada", "lg:col-span-5")} tr={tr} fx={fx} labels={PUNCH_LABEL} />
            <TeleworkCard className={show("telework", "lg:col-span-12")} tr={tr} fx={fx} checklistDue={checklistDue} />
            {wc.requests.length > 0 && <OvertimeRequestsCard className={show("compliance", "lg:col-span-5")} tr={tr} wc={wc} />}
            <RecordCard className={show("compliance", wc.requests.length > 0 ? "lg:col-span-7" : "lg:col-span-12")} tr={tr} wc={wc} />
            <LeaveCard className={show("leave", "lg:col-span-12")} tr={tr} leave={leave} />
          </>
        )}
      </div>
    </ITPage>
  );
}
