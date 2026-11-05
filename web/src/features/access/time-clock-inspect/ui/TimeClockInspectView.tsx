import { ITButton, ITFlex, ITSelect, ITText } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { dateLocale } from "@shared/i18n/format";
import { useTimeClockInspect, type InspectTab } from "../model/useTimeClockInspect";

const ALL_TABS: InspectTab[] = ["overview", "users", "cards", "events"];

/** Tipos de evento de la tabla del equipo que tienen texto propio. */
const EVENT_KEYS: Record<number, string> = {
  1: "inspect.minors.card",
  38: "inspect.minors.fingerprint",
  75: "inspect.minors.face",
  104: "inspect.minors.failed",
};

interface Props {
  /** Reloj elegido por el panel; si viene, no se muestra selector. */
  clockSerial?: string;
  /** Pestañas visibles (por defecto, todas). */
  tabs?: InspectTab[];
}

export default function TimeClockInspectView({ clockSerial, tabs = ALL_TABS }: Props) {
  const { t } = useTranslation("time-clock");
  const fx = useTimeClockInspect(clockSerial);
  const controlled = clockSerial !== undefined;
  const singleTab = tabs.length === 1;
  // Con el panel, la vista de resumen no repite barra de herramientas ni pestañas.
  const hideToolbar = controlled && singleTab && tabs[0] === "overview";

  const tabLabel = (tab: InspectTab) => t(`inspect.tabs.${tab}`);
  const eventLabel = (minor: number): string => {
    const key = EVENT_KEYS[minor];
    return key ? t(key as "inspect.minors.face") : t("inspect.minors.other", { minor });
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

  return (
    <ITFlex direction="column" gap={4} className={controlled ? "" : "p-6"}>
      {!hideToolbar && (
        <ITFlex align="center" gap={3} wrap="wrap">
          {!controlled && (
            <ITSelect
              name="clock"
              label={t("inspect.clock")}
              options={fx.devices.map((d) => ({ value: d.clockSerial, label: d.name }))}
              value={fx.serial}
              onChange={(e) => fx.setSerial(e.target.value)}
            />
          )}
          {fx.tab === "events" && (
            <ITSelect
              name="days"
              label={t("inspect.days")}
              options={[1, 2, 7, 30].map((n) => ({ value: String(n), label: t("inspect.daysOption", { count: n }) }))}
              value={String(fx.days)}
              onChange={(e) => fx.setDays(Number(e.target.value))}
            />
          )}
          <ITButton variant="outlined" color="secondary" size="sm" disabled={fx.loading} onClick={fx.reload}>
            {t("inspect.refresh")}
          </ITButton>
        </ITFlex>
      )}

      {!singleTab && (
        <div role="tablist" className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={fx.tab === tab}
              onClick={() => fx.setTab(tab)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                fx.tab === tab
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-[var(--it-card-bg)] text-slate-600 hover:border-slate-400"
              }`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      )}

      {fx.error && <ITText role="alert" className="text-sm text-red-600">{fx.error}</ITText>}
      {fx.loading && <ITText className="text-sm text-slate-400">{t("inspect.loading")}</ITText>}

      {fx.tab === "overview" && fx.overview && (
        <div className="grid grid-cols-1 gap-4 md:!grid-cols-2">
          <Card title={t("inspect.overview.device")}>
            <Field label={t("inspect.overview.name")} value={fx.overview.device.deviceName} />
            <Field label={t("inspect.overview.model")} value={fx.overview.device.model} />
            <Field label={t("inspect.overview.serial")} value={fx.overview.device.serialNumber} />
            <Field label={t("inspect.overview.firmware")} value={fx.overview.device.firmwareVersion} />
            <Field label={t("inspect.overview.mac")} value={fx.overview.device.macAddress} />
            <Field label={t("inspect.overview.url")} value={fx.overview.clock.url} />
          </Card>
          <Card title={t("inspect.overview.time")}>
            <Field label={t("inspect.overview.localTime")} value={fmt(fx.overview.time.localTime)} />
            <Field label={t("inspect.overview.timeMode")} value={fx.overview.time.timeMode} />
            <Field label={t("inspect.overview.timeZone")} value={fx.overview.time.timeZone} />
          </Card>
          <Card title={t("inspect.overview.counts")}>
            <Field label={t("inspect.overview.people")} value={String(fx.overview.counts.userNumber)} />
            <Field label={t("inspect.overview.withFace")} value={String(fx.overview.counts.bindFaceUserNumber)} />
            <Field label={t("inspect.overview.withFingerprint")} value={String(fx.overview.counts.bindFingerprintUserNumber)} />
            <Field label={t("inspect.overview.withCard")} value={String(fx.overview.counts.bindCardUserNumber)} />
          </Card>
        </div>
      )}

      {fx.tab === "users" && fx.users && (
        <Table
          caption={t("inspect.users.caption", { shown: fx.users.shown, total: fx.users.total })}
          headers={[t("inspect.users.number"), t("inspect.users.name")]}
          rows={fx.users.people.map((p) => [p.employeeNumber, p.name])}
          empty={t("inspect.users.empty")}
        />
      )}

      {fx.tab === "cards" && fx.cards && (
        <Table
          caption={t("inspect.cards.caption", { shown: fx.cards.shown, total: fx.cards.total })}
          headers={[t("inspect.cards.card"), t("inspect.cards.number"), t("inspect.cards.type")]}
          rows={fx.cards.cards.map((c) => [c.cardNo, c.employeeNumber, c.cardType ?? "—"])}
          empty={t("inspect.cards.empty")}
        />
      )}

      {fx.tab === "events" && fx.events && (
        <Table
          caption={t("inspect.events.caption", { shown: fx.events.shown, total: fx.events.total })}
          headers={[t("inspect.events.time"), t("inspect.events.type"), t("inspect.events.number"), t("inspect.events.name")]}
          rows={fx.events.events.map((e) => [fmt(e.time), eventLabel(e.minor), e.employeeNumber ?? "—", e.name ?? "—"])}
          empty={t("inspect.events.empty")}
        />
      )}
    </ITFlex>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-[var(--it-card-bg)] p-5 shadow-sm">
      <ITText className="text-sm font-bold text-slate-800">{title}</ITText>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-dashed border-slate-200 pt-2">
      <ITText as="span" className="text-xs text-slate-500">{label}</ITText>
      <ITText as="span" className="text-right text-sm text-slate-900">{value || "—"}</ITText>
    </div>
  );
}

function Table({
  caption,
  headers,
  rows,
  empty,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <ITText className="text-xs text-slate-500">{caption}</ITText>
      {rows.length === 0 ? (
        <ITText className="text-sm text-slate-400">{empty}</ITText>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[var(--it-card-bg)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2 text-slate-800">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
