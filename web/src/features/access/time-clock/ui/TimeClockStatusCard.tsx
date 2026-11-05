import { ITBadget, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import {
  CLOCK_STATUS_COLOR,
  clockStatus,
  type TimeClockImport,
  type TimeClockState,
  type TimeClockStatus,
} from "@entities/time-clock";
import { PanelCard } from "@shared/ui/panel-card";
import { dateLocale } from "@shared/i18n";
import type { UseTimeClock } from "../model/useTimeClock";
import TimeClockDeviceCard from "./TimeClockDeviceCard";

type BadgeColor = "success" | "warning" | "danger" | "gray" | "info";
type OverallState = "notConfigured" | "withoutClocks" | TimeClockState;
type ImportStatus = "running" | "ok" | "error";

const STATUS_COLOR: Record<OverallState, BadgeColor> = {
  notConfigured: "gray",
  withoutClocks: "gray",
  ...CLOCK_STATUS_COLOR,
};

const IMPORT_COLOR: Record<ImportStatus, BadgeColor> = {
  running: "info",
  ok: "success",
  error: "warning",
};

/** El estado general es el del reloj que más atención pide. */
const PRIORITY: TimeClockState[] = ["running", "paused", "error", "pending", "ok"];

const statusOf = (s: TimeClockStatus): OverallState => {
  if (!s.configured) return "notConfigured";
  if (s.devices.length === 0) return "withoutClocks";
  const statuses = new Set(s.devices.map(clockStatus));
  return PRIORITY.find((e) => statuses.has(e)) ?? "ok";
};

const importStatusOf = (i: TimeClockImport): ImportStatus =>
  !i.finishedAt ? "running" : i.error ? "error" : "ok";

const number = (n: number): string => n.toLocaleString(dateLocale());

/** Día `YYYY-MM-DD` → `DD/MM/AAAA` (es una clave, no un instante). */
const day = (key: string): string => key.split("-").reverse().join("/");

/** Segundos → texto corto para el ETA ("2 h 5 min", "3 min", "45 s"). */
const duration = (seconds: number): string => {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

/**
 * Los relojes dados de alta, uno por tarjeta: su estado, cuándo checaron por
 * última vez, cuándo se sincronizaron y qué traen guardado. Arriba va el estado
 * general (el del reloj que más atención pide) y la importación por rango.
 */
export default function TimeClockStatusCard({ fx }: { fx: UseTimeClock }) {
  const { t, status, inProgress, progress, importing, starting, handleSyncAll } = fx;
  if (!status) return null;

  const overallState = statusOf(status);

  const message = ((): string | null => {
    switch (overallState) {
      case "notConfigured":
      case "withoutClocks":
      case "paused":
      case "error":
      case "pending":
        return t(`status.messages.${overallState}`);
      case "running": {
        if (!progress) return null;
        if (progress.total == null || progress.missing == null) {
          return t("status.messages.runningNoTotal", {
            readCount: number(progress.readCount),
            newCount: number(progress.newCount),
          });
        }
        const base = t("status.messages.running", {
          readCount: number(progress.readCount),
          total: number(progress.total),
          newCount: number(progress.newCount),
          remaining: number(progress.missing),
        });
        const item = [
          progress.percent != null ? t("sync.percent", { percent: number(progress.percent) }) : null,
          progress.rate != null ? t("sync.speed", { rate: number(Math.round(progress.rate)) }) : null,
          progress.eta != null ? t("sync.eta", { eta: duration(progress.eta) }) : null,
        ]
          .filter((s): s is string => s !== null)
          .join(" · ");
        return item ? `${base} · ${item}` : base;
      }
      default:
        return null;
    }
  })();

  const importJob = status.importJob;
  const importStatus = importJob ? importStatusOf(importJob) : null;
  const importMessage = ((): string | null => {
    if (!importJob) return null;
    const range = { from: day(importJob.from), to: day(importJob.to) };
    if (importStatus === "error") return importJob.error;
    if (importStatus === "ok") {
      return t("import.done", {
        ...range,
        newCount: number(importJob.newCount),
        readCount: number(importJob.readCount),
      });
    }
    return importJob.total != null
      ? t("import.progress", {
          ...range,
          readCount: number(importJob.readCount),
          total: number(importJob.total),
          newCount: number(importJob.newCount),
        })
      : t("import.progressNoTotal", range);
  })();

  const sincronizando = inProgress || importing || starting;

  return (
    <PanelCard title={t("status.title")}>
      <ITFlex direction="column" gap={3}>
        <ITFlex align="center" wrap="wrap" gap={2}>
          <ITBadget color={STATUS_COLOR[overallState]} size="lg">
            {t(`status.states.${overallState}`)}
          </ITBadget>
          {message && <ITText className="text-[12px] text-slate-600">{message}</ITText>}
        </ITFlex>

        {importJob && importStatus && (
          <ITFlex align="center" wrap="wrap" gap={2}>
            <ITBadget color={IMPORT_COLOR[importStatus]} size="lg">
              {t(`import.states.${importStatus}`)}
            </ITBadget>
            {importMessage && <ITText className="text-[12px] text-slate-600">{importMessage}</ITText>}
          </ITFlex>
        )}

        {status.devices.length > 0 && (
          <div className="!grid gap-4 md:!grid-cols-2">
            {status.devices.map((d) => (
              <TimeClockDeviceCard
                key={d.clockSerial}
                device={d}
                onRetry={() => void handleSyncAll()}
                retrying={sincronizando}
              />
            ))}
          </div>
        )}
      </ITFlex>
    </PanelCard>
  );
}
