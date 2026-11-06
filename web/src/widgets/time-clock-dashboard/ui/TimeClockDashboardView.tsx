import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChartArea, FaChartBar, FaClock, FaFingerprint, FaServer, FaSyncAlt, FaUsers, FaVideo, FaChartLine, FaIdCard, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { ITButton, ITDataTable, ITFlex, ITSearchSelect, ITText } from "@axzydev/axzy_ui_system";
import type { Column, ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { dateLocale } from "@shared/i18n/format";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { PanelCard } from "@shared/ui/panel-card";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { TabBar, type TabBarItem } from "@shared/ui/tab-bar";
import type { ClockAlert, SummaryClock, TimeClockSummary } from "@entities/time-clock";
import { timeClockApi, type TimeClockPerson } from "@entities/time-clock";
import FingerprintReaderPanel from "./FingerprintReaderPanel";
import UnifiedPeopleView from "./UnifiedPeopleView";
import { PersonDetailDialog, TimeClockPeopleView } from "@features/access/time-clock-people";
import { TimeClockInspectView } from "@features/access/time-clock-inspect";
import { TimeClockCameraView } from "@features/access/time-clock-camera";
import { TimeClocksTab, useTimeClocks } from "@features/access/time-clocks";
import { useTimeClockDashboard } from "../model/useTimeClockDashboard";
import { useNavigate } from "react-router-dom";

type Section = "status" | "people" | "events" | "camera" | "reader" | "clocks";
const SECTIONS: Section[] = ["status", "people", "events", "camera", "reader", "clocks"];
const ALL_CLOCKS = "all";
const SECTION_ICON: Record<Section, React.ReactNode> = {
  status: <FaChartLine size={12} />,
  people: <FaUsers size={12} />,
  events: <FaClock size={12} />,
  camera: <FaVideo size={12} />,
  reader: <FaFingerprint size={12} />,
  clocks: <FaServer size={12} />,
};
type ChartVariant = "area" | "bar";
type OpenPerson = { serial: string; employeeNumber: string };
type Punch = SummaryClock["recentPunches"][number] & { id: string };

const CONNECTION_TONE: Record<SummaryClock["connection"], string> = {
  ONLINE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NO_RESPONSE: "bg-red-50 text-red-700 border-red-200",
  PAUSED_CREDENTIALS: "bg-red-50 text-red-700 border-red-200",
  NOT_READ: "bg-slate-100 text-slate-600 border-slate-200",
};

const MAX_NAMES_IN_TOOLTIP = 6;

type HourBucket = { hour: number; count: number; people: Array<{ employeeNumber: string; name: string }> };

/** Gráfica de checadas por hora. Área (línea) o barras; al pasar el cursor muestra quién checó. */
function HourlyChart({ hourly, variant, label }: { hourly: HourBucket[]; variant: ChartVariant; label: string }) {
  const { t } = useTranslation("time-clock");
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 640;
  const H = 150;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const rawMax = Math.max(1, ...hourly.map((h) => h.count));
  const step = Math.max(1, Math.ceil(rawMax / 4));
  const max = step * 4;
  const colW = plotW / 24;
  const x = (i: number) => padL + (i + 0.5) * colW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const barW = colW - 6;
  const line = hourly.map((h, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(h.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(23).toFixed(1)},${padT + plotH} L${x(0).toFixed(1)},${padT + plotH} Z`;
  const ticks = [0, 1, 2, 3, 4].map((k) => k * step);
  const active = hovered === null ? null : hourly[hovered];
  const hidden = active ? active.people.length - MAX_NAMES_IN_TOOLTIP : 0;
  const left = Math.min(86, Math.max(14, ((padL + (active ? active.hour + 0.5 : 0) * colW) / W) * 100));

  return (
    <div className="relative" onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet" className="h-40 w-full">
        <defs>
          <linearGradient id="hourly-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{v}</text>
          </g>
        ))}
        {variant === "bar" &&
          hourly.map((h, i) => (
            <rect key={h.hour} x={x(i) - barW / 2} y={y(h.count)} width={barW} height={padT + plotH - y(h.count)} rx="3"
              fill={hovered === i ? "#334155" : h.count > 0 ? "#0f172a" : "#e2e8f0"} />
          ))}
        {variant === "area" && (
          <>
            <path d={area} fill="url(#hourly-area)" />
            <path d={line} fill="none" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" />
            {hourly.map((h, i) => (
              <circle key={`d-${h.hour}`} cx={x(i)} cy={y(h.count)} r={hovered === i || h.count > 0 ? 3 : 0} fill="#fff" stroke="#0f172a" strokeWidth="2" />
            ))}
          </>
        )}
        {/* Columnas de captura del cursor: todo el alto de la gráfica. */}
        {hourly.map((h, i) => (
          <rect key={`hit-${h.hour}`} x={padL + i * colW} y={padT} width={colW} height={plotH} fill="transparent"
            onMouseEnter={() => setHovered(i)} />
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
          <text key={`x-${h}`} x={x(h)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {String(h).padStart(2, "0")}:00
          </text>
        ))}
      </svg>
      {active && active.count > 0 && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg"
          style={{ left: `${left}%` }}
        >
          <div className="mb-1 font-semibold text-slate-900">
            {String(active.hour).padStart(2, "0")}:00 · {t("dashboard.tooltip.punches", { count: active.count })}
          </div>
          <ul className="flex flex-col gap-0.5 text-slate-600">
            {active.people.slice(0, MAX_NAMES_IN_TOOLTIP).map((p) => (
              <li key={p.employeeNumber} className="truncate">{p.name}</li>
            ))}
          </ul>
          {hidden > 0 && <div className="mt-1 text-slate-400">{t("dashboard.tooltip.more", { count: hidden })}</div>}
        </div>
      )}
    </div>
  );
}

function AlertLine({ alert }: { alert: ClockAlert }) {
  const { t } = useTranslation("time-clock");
  const navigate = useNavigate();
  const tone =
    alert.severity === "critical"
      ? { wrap: "bg-rose-50/80 text-rose-900", chip: "bg-rose-100 text-rose-700", icon: <FaExclamationTriangle size={13} /> }
      : alert.severity === "warning"
        ? { wrap: "bg-amber-50/80 text-amber-900", chip: "bg-amber-100 text-amber-700", icon: <FaExclamationTriangle size={13} /> }
        : { wrap: "bg-slate-50 text-slate-700", chip: "bg-slate-200 text-slate-600", icon: <FaCheckCircle size={13} /> };
  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${tone.wrap}`}>
      <span className="flex min-w-0 items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>{tone.icon}</span>
        <span className="min-w-0 text-[12.5px] font-semibold leading-snug">{t(`dashboard.alerts.${alert.code}`)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {alert.code === "UNLINKED" && (
          <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => navigate("/hr/time-clock/employees")}>
            {t("dashboard.alerts.linkNow")}
          </ITButton>
        )}
        {alert.count !== undefined && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums ${tone.chip}`}>{alert.count}</span>
        )}
      </span>
    </li>
  );
}

/** Panel de un reloj: encabezado, métricas, gráfica, datos del equipo, checadas recientes y alertas. */
function DevicePanel({ clock, onOpenPerson }: { clock: SummaryClock; onOpenPerson: (p: OpenPerson) => void }) {
  const { t } = useTranslation("time-clock");
  const [variant, setVariant] = useState<ChartVariant>("area");
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" }) : t("dashboard.never");

  const columns: Column<Punch>[] = [
    {
      key: "name",
      type: "string",
      label: t("dashboard.table.person"),
      width: "45%",
      sortable: true,
      truncate: true,
      render: (row) =>
        row.employeeNumber ? (
          <button type="button" onClick={() => onOpenPerson({ serial: clock.serial, employeeNumber: row.employeeNumber })}
            className="truncate text-left font-semibold text-slate-900 underline-offset-2 hover:underline">
            {row.name}
          </button>
        ) : (
          <span className="text-slate-400">{t("dashboard.unknownPerson")}</span>
        ),
    },
    {
      key: "occurredAt",
      type: "string",
      label: t("dashboard.table.time"),
      width: "25%",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-slate-600">
          {new Date(row.occurredAt).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      key: "method",
      type: "string",
      label: t("dashboard.table.method"),
      width: "30%",
      sortable: true,
      render: (row) => <span className="text-slate-600">{t(`methods.${row.method}`, { defaultValue: row.method })}</span>,
    },
  ];
  const fetchPunches = useMemo(
    () => makeClientTableFetch<Punch>(async () => clock.recentPunches.map((p, i) => ({ ...p, id: `${p.occurredAt}-${i}` })), {}),
    [clock.recentPunches]
  );

  return (
    <PanelCard
      title={clock.name ?? clock.serial}
      description={`${clock.device?.model ?? "—"} · ${clock.countsAttendance ? t("dashboard.counts") : t("dashboard.noCounts")}`}
      actions={
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${CONNECTION_TONE[clock.connection]}`}>
          {t(`dashboard.connection.${clock.connection}`)}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 md:!grid-cols-4">
        {[
          { label: t("dashboard.people"), value: clock.counts?.people ?? "—", icon: <FaUsers size={13} />, tone: "bg-sky-50 text-sky-700" },
          { label: t("dashboard.cards"), value: clock.counts?.cards ?? "—", icon: <FaIdCard size={13} />, tone: "bg-violet-50 text-violet-700" },
          { label: t("dashboard.punchesToday"), value: clock.punchesToday, icon: <FaClock size={13} />, tone: "bg-emerald-50 text-emerald-700" },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-slate-50/80 p-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${metric.tone}`}>{metric.icon}</span>
            <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{metric.label}</span>
            <span className="block text-[22px] font-black leading-tight tabular-nums text-slate-900">{metric.value}</span>
          </div>
        ))}
        <div className="rounded-2xl bg-slate-50/80 p-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><FaSyncAlt size={13} /></span>
          <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("dashboard.lastSync")}</span>
          <span className="mt-0.5 block text-[11.5px] font-semibold leading-tight text-slate-800">{fmt(clock.lastSyncAt)}</span>
        </div>
      </div>

      {clock.countsAttendance && (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4">
          <ITFlex align="center" justify="between" wrap="wrap" gap={2} className="mb-2">
            <ITText className="!text-[12px] font-bold !text-slate-700">{t("dashboard.todayByHour")}</ITText>
            <div className="flex rounded-xl bg-slate-100 p-0.5">
              {(["area", "bar"] as ChartVariant[]).map((v) => (
                <button key={v} type="button" onClick={() => setVariant(v)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    variant === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}>
                  {v === "area" ? <FaChartArea size={11} /> : <FaChartBar size={11} />}
                  {t(`dashboard.chart.${v}`)}
                </button>
              ))}
            </div>
          </ITFlex>
          <HourlyChart hourly={clock.hourly} variant={variant} label={t("dashboard.todayByHour")} />
        </div>
      )}

      {clock.device && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
          <span className="font-mono text-slate-700">{clock.serial}</span>
          <span>{t("dashboard.device.firmware")} {clock.device.firmwareVersion ?? "—"}</span>
          <span>{t("dashboard.device.lastRead")} {fmt(clock.lastReadAt)}</span>
        </div>
      )}

      {clock.alerts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {clock.alerts.map((a) => (
            <AlertLine key={a.code} alert={a} />
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3">
        <ITText className="mb-2 block !text-[12px] font-bold !text-slate-700">{t("dashboard.recentPunches")}</ITText>
        <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          fetchData={
            fetchPunches as unknown as (p: ITDataTableFetchParams) => Promise<ITDataTableResponse<Record<string, unknown>>>
          }
          debounceMs={350}
          onRowClick={(row) => {
            const punch = row as unknown as Punch;
            if (punch.employeeNumber) onOpenPerson({ serial: clock.serial, employeeNumber: punch.employeeNumber });
          }}
        />
      </div>
    </PanelCard>
  );
}



/** Vista previa del personal: se pide al reloj solo cuando el usuario lo pide. */
function PeoplePreview({ serial, onSeeAll, onOpenPerson }: { serial: string; onSeeAll: () => void; onOpenPerson: (p: OpenPerson) => void }) {
  const { t } = useTranslation("time-clock");
  const [people, setPeople] = useState<TimeClockPerson[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(() => {
    setLoading(true);
    setError(null);
    timeClockApi
      .peopleList(serial)
      .then((r) => setPeople(r.people))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [serial]);

  // El personal siempre aparece: se lee al entrar y cada vez que cambia el reloj.
  useEffect(() => {
    setPeople(null);
    show();
  }, [show]);

  return (
    <PanelCard
      title={t("dashboard.personnel.title")}
      description={people ? t("dashboard.personnel.count", { count: people.length }) : t("dashboard.personnel.hint")}
      actions={
        <>
          <ITButton variant="outlined" color="secondary" size="sm" disabled={loading} onClick={show}>
            {t("dashboard.personnel.refresh")}
          </ITButton>
          <ITButton variant="filled" color="primary" size="sm" onClick={onSeeAll}>
            {t("dashboard.personnel.seeAll")}
          </ITButton>
        </>
      }
    >
      {loading && <ITText className="text-xs text-slate-400">{t("dashboard.personnel.loading")}</ITText>}
      {error && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-800">
          {t("dashboard.personnel.unavailable")}
        </div>
      )}
      {people && people.length === 0 && <ITText className="text-xs text-slate-400">{t("dashboard.personnel.empty")}</ITText>}
      {people && people.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-100">
          {people.slice(0, 10).map((p) => (
            <li key={p.employeeNumber}>
              <button type="button" onClick={() => onOpenPerson({ serial, employeeNumber: p.employeeNumber })}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition hover:text-slate-900">
                <span className="truncate font-medium text-slate-800">{p.name}</span>
                <span className="shrink-0 font-mono text-xs text-slate-400">{p.employeeNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {people && people.length > 10 && (
        <ITText className="mt-2 text-xs text-slate-400">{t("dashboard.personnel.more", { count: people.length - 10 })}</ITText>
      )}
    </PanelCard>
  );
}

function Estado({ data, visibleClocks, serial, onSeeAll, onOpenPerson }: {
  data: TimeClockSummary;
  visibleClocks: SummaryClock[];
  serial: string;
  onSeeAll: () => void;
  onOpenPerson: (p: OpenPerson) => void;
}) {
  const { t } = useTranslation("time-clock");
  const online = data.clocks.filter((c) => c.connection === "ONLINE").length;
  const people = data.clocks.reduce((sum, c) => sum + (c.counts?.people ?? 0), 0);
  const punches = data.clocks.filter((c) => c.countsAttendance).reduce((sum, c) => sum + c.punchesToday, 0);
  const alerts = [...data.alerts, ...data.clocks.flatMap((c) => c.alerts)];

  return (
    <ITFlex direction="column" gap={6}>
      {/* Cifras del reloj en la tira del mosaico, como el resto del sistema */}
      <BentoKpiGrid
        items={[
          { id: "online", label: t("dashboard.kpi.online"), value: `${online} / ${data.clocks.length}`, caption: t("dashboard.kpi.onlineHint"), tone: "success", icon: <FaServer size={13} /> },
          { id: "people", label: t("dashboard.kpi.people"), value: people, caption: t("dashboard.kpi.peopleHint"), tone: "info", icon: <FaUsers size={13} /> },
          { id: "punches", label: t("dashboard.kpi.punches"), value: punches, caption: t("dashboard.kpi.punchesHint"), tone: "warning", icon: <FaClock size={13} /> },
          { id: "alerts", label: t("dashboard.kpi.alerts"), value: alerts.length, caption: alerts.length > 0 ? t("dashboard.kpi.alertsHint") : t("dashboard.kpi.allGood"), tone: alerts.length > 0 ? "danger" : "neutral", icon: <FaSyncAlt size={13} /> },
        ]}
      />

      {data.alerts.length > 0 && (
        <PanelCard title={t("dashboard.alertsTitle")}>
          <ul className="grid grid-cols-1 gap-2 md:!grid-cols-2">
            {data.alerts.map((a) => (
              <AlertLine key={`g-${a.code}`} alert={a} />
            ))}
          </ul>
        </PanelCard>
      )}

      <div className="grid grid-cols-1 gap-6 xl:!grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {visibleClocks.map((c) => (
            <DevicePanel key={c.serial} clock={c} onOpenPerson={onOpenPerson} />
          ))}
          {data.clocks.length === 0 && <ITText className="text-sm text-slate-400">{t("dashboard.noClocks")}</ITText>}
        </div>
        <div className="flex flex-col gap-6">
          {serial && <PeoplePreview serial={serial} onSeeAll={onSeeAll} onOpenPerson={onOpenPerson} />}
        </div>
      </div>
    </ITFlex>
  );
}

/** Administración de relojes (alta, edición y baja del registro). Solo quien administra relojes llega aquí. */
function ClocksSection() {
  const fx = useTimeClocks();
  return <TimeClocksTab fx={fx} />;
}

/** Dashboard del reloj: Estado (relojes y alertas) y secciones por reloj: personas, eventos y cámara. */
export default function TimeClockDashboardView() {
  const { t } = useTranslation("time-clock");
  const fx = useTimeClockDashboard();
  const [section, setSection] = useState<Section>("status");
  const [picked, setPicked] = useState(ALL_CLOCKS);
  const [openPerson, setOpenPerson] = useState<OpenPerson | null>(null);
  const clocks = fx.data?.clocks ?? [];
  const selected = clocks.find((c) => c.serial === picked);
  const serial = selected?.serial ?? clocks.find((c) => c.countsAttendance)?.serial ?? clocks[0]?.serial ?? "";
  const visibleClocks = selected ? [selected] : clocks;

  const showClockPicker = section !== "clocks" && section !== "reader" && clocks.length > 0;

  return (
    <ITFlex direction="column" gap={5}>
      <ITFlex align="center" justify="between" gap={3} wrap="wrap">
        <TabBar
          items={SECTIONS.map((s) => ({
            id: s,
            label: t(`dashboard.sections.${s}`),
            icon: SECTION_ICON[s],
          })) as TabBarItem<Section>[]}
          value={section}
          onChange={setSection}
        />
        <ITFlex align="center" gap={3} wrap="wrap">
          {showClockPicker && (
            <ITSearchSelect
              name="timeClockDashboardClock"
              label={t("dashboard.clock")}
              options={[
                ...(clocks.length > 1 ? [{ value: ALL_CLOCKS, label: t("dashboard.allClocks") }] : []),
                ...clocks.map((c) => ({ value: c.serial, label: c.name ?? c.serial })),
              ]}
              value={selected ? picked : clocks.length > 1 ? ALL_CLOCKS : (clocks[0]?.serial ?? "")}
              onChange={(value) => setPicked(String(value))}
              className="min-w-[220px]"
            />
          )}
          {fx.data && (
            <ITText className="hidden text-xs text-slate-400 md:block">
              {t("dashboard.generatedAt", { time: new Date(fx.data.generatedAt).toLocaleTimeString(dateLocale()) })}
            </ITText>
          )}
          <ITButton variant="raised-text" color="primary" size="sm" disabled={fx.loading} onClick={fx.reload}>
            <ITFlex align="center" gap={2}>
              <FaSyncAlt size={11} className={fx.loading ? "animate-spin" : ""} />
              {t("dashboard.refresh")}
            </ITFlex>
          </ITButton>
        </ITFlex>
      </ITFlex>

      {fx.error && <ITText role="alert" className="text-sm text-red-600">{fx.error}</ITText>}
      {fx.loading && !fx.data && <ITText className="text-sm text-slate-400">{t("dashboard.loading")}</ITText>}

      {fx.data && section === "status" && (
        <Estado
          data={fx.data}
          visibleClocks={visibleClocks}
          serial={serial}
          onSeeAll={() => setSection("people")}
          onOpenPerson={setOpenPerson}
        />
      )}
      {fx.data && section !== "status" && section !== "clocks" && section !== "reader" && !serial && <ITText className="text-sm text-slate-400">{t("dashboard.noClocks")}</ITText>}
      {section === "reader" && <FingerprintReaderPanel />}
      {section === "clocks" && <ClocksSection />}
      {section === "people" && picked === ALL_CLOCKS && clocks.length > 1 && <UnifiedPeopleView />}
      {serial && section === "people" && (picked !== ALL_CLOCKS || clocks.length <= 1) && <TimeClockPeopleView clockSerial={serial} />}
      {serial && section === "events" && <TimeClockInspectView clockSerial={serial} tabs={["events"]} />}
      {serial && section === "camera" && <TimeClockCameraView clockSerial={serial} />}

      {openPerson && (
        <PersonDetailDialog clockSerial={openPerson.serial} employeeNumber={openPerson.employeeNumber} onClose={() => setOpenPerson(null)} />
      )}
    </ITFlex>
  );
}
