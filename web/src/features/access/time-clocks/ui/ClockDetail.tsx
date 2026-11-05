import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITGrid,
  ITText,
} from "@axzydev/axzy_ui_system";
import { FaArrowLeft, FaPen, FaRedo, FaTrashAlt } from "react-icons/fa";
import {
  CLOCK_STATUS_COLOR,
  clockStatus,
  type TimeClockDevice,
  type TimeClockConfig,
} from "@entities/time-clock";
import { formatDateTime } from "@shared/utils/dates";
import { dateLocale } from "@shared/i18n";
import type { ClockConfig, UseTimeClocks } from "../model/useTimeClocks";

/** A partir de esta diferencia con el servidor se avisa que el reloj no está en hora. */
const DRIFT_NOTICE_S = 60;

const number = (n: number): string => n.toLocaleString(dateLocale());

/** `2026-09-24T13:51:43-07:00` → `24/09/2026 13:51:43 (UTC-07:00)`, tal como lo marca el reloj. */
const clockTime = (iso: string): string => {
  const offset = iso.slice(19);
  const base = `${iso.slice(0, 10).split("-").reverse().join("/")} ${iso.slice(11, 19)}`;
  return offset ? `${base} (UTC${offset === "Z" ? "" : offset})` : base;
};

/** Segundos → "45 s", "3 min 20 s", "2 h 5 min". */
const time = (seconds: number): string => {
  const s = Math.abs(seconds);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return s % 60 ? `${min} min ${s % 60} s` : `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

interface Props {
  fx: UseTimeClocks;
  clock: TimeClockDevice;
  config: ClockConfig | undefined;
  onBack: () => void;
}

/**
 * Detalle de un reloj: su sincronización, su configuración leída en vivo y las
 * acciones (volver a leer, editar el registro y darlo de baja). Del reloj solo
 * se lee; nada de aquí le cambia nada al equipo.
 */
export default function ClockDetail({ fx, clock, config, onBack }: Props) {
  const { t, loadConfig, openEdit, setRetirementTarget } = fx;
  const status = clockStatus(clock);

  return (
    <ITFlex direction="column" gap={4}>
      <ITFlex align="center" justify="between" gap={3} wrap="wrap">
        <ITFlex align="center" gap={3} wrap="wrap">
          <ITButton variant="outlined" color="secondary" size="sm" onClick={onBack}>
            <ITFlex align="center" gap={1}>
              <FaArrowLeft size={11} />
              <ITText className="font-bold text-[11px]">{t("clocks.actions.back")}</ITText>
            </ITFlex>
          </ITButton>
          <ITFlex direction="column" gap={1} className="min-w-0">
            <ITFlex align="center" wrap="wrap" gap={2}>
              <ITText className="text-[15px] font-black text-slate-800">{clock.name}</ITText>
              <ITBadget color={CLOCK_STATUS_COLOR[status]} size="sm">
                {t(`status.states.${status}`)}
              </ITBadget>
              <ITBadget
                color={clock.countsAttendance ? "info" : "gray"}
                variant="outlined"
                size="sm"
              >
                {clock.countsAttendance
                  ? t("clocks.usage.countsAttendance")
                  : t("clocks.usage.onlyAccess")}
              </ITBadget>
            </ITFlex>
            <ITText className="text-[11px] font-bold text-slate-400 break-words">
              {clock.url}
            </ITText>
          </ITFlex>
        </ITFlex>

        <ITFlex align="center" gap={2}>
          <ITButton
            variant="outlined"
            color="secondary"
            size="sm"
            disabled={config?.loading}
            onClick={() => void loadConfig(clock.clockSerial)}
          >
            <ITFlex align="center" gap={1}>
              <FaRedo size={10} className={config?.loading ? "animate-spin" : undefined} />
              <ITText className="font-bold text-[11px]">
                {t("clocks.actions.update")}
              </ITText>
            </ITFlex>
          </ITButton>
          <ITButton variant="outlined" color="secondary" size="sm" onClick={() => openEdit(clock)}>
            <ITFlex align="center" gap={1}>
              <FaPen size={10} />
              <ITText className="font-bold text-[11px]">{t("clocks.actions.edit")}</ITText>
            </ITFlex>
          </ITButton>
          <ITButton
            variant="outlined"
            color="danger"
            size="sm"
            onClick={() => setRetirementTarget(clock)}
          >
            <ITFlex align="center" gap={1}>
              <FaTrashAlt size={10} />
              <ITText className="font-bold text-[11px]">
                {t("clocks.actions.retirement")}
              </ITText>
            </ITFlex>
          </ITButton>
        </ITFlex>
      </ITFlex>

      <ITCard className="!p-5">
        <Section title={t("clocks.sync.title")}>
          <Datum label={t("clocks.sync.punches")} value={number(clock.punches)} />
          <Datum
            label={t("clocks.sync.lastPunch")}
            value={clock.lastPunch ? formatDateTime(clock.lastPunch) : t("status.empty")}
          />
          <Datum
            label={t("clocks.sync.lastSync")}
            value={clock.syncedAt ? formatDateTime(clock.syncedAt) : t("status.empty")}
          />
          <Datum label={t("clocks.sync.number")} value={number(clock.lastSerialNo)} />
        </Section>
      </ITCard>

      <ITCard className="!p-5">
        <Section
          title={t("clocks.config.title")}
          note={
            config?.data
              ? `${t("clocks.config.hint")} ${t("clocks.config.readAt", {
                  hour: new Date(config.data.readAt).toLocaleTimeString(dateLocale()),
                })}`
              : t("clocks.config.hint")
          }
        >
          {config?.error ? (
            <ITGrid item xs={12}>
              <ITAlert variant="warning">{config.error}</ITAlert>
            </ITGrid>
          ) : config?.data ? (
            <Settings fx={fx} clock={clock} config={config.data} />
          ) : (
            <ITGrid item xs={12}>
              <ITText className="text-[12px] text-slate-500">
                {t("clocks.config.loading")}
              </ITText>
            </ITGrid>
          )}
        </Section>
      </ITCard>
    </ITFlex>
  );
}

function Settings({
  fx,
  clock,
  config,
}: {
  fx: UseTimeClocks;
  clock: TimeClockDevice;
  config: TimeClockConfig;
}) {
  const { t } = fx;
  const { device, hour, people } = config;
  const modes: Record<string, string> = {
    manual: t("clocks.config.modes.manual"),
    NTP: t("clocks.config.modes.NTP"),
  };
  const drift = hour?.driftSeconds ?? 0;
  const inHour = Math.abs(drift) < DRIFT_NOTICE_S;

  return (
    <>
      <Datum label={t("clocks.config.name")} value={device.name ?? t("status.empty")} />
      <Datum label={t("clocks.config.model")} value={device.model ?? t("status.empty")} />
      <Datum label={t("clocks.config.firmware")} value={device.firmware ?? t("status.empty")} />
      <Datum label={t("clocks.config.mac")} value={device.mac ?? t("status.empty")} />
      <Datum label={t("clocks.config.serial")} value={clock.clockSerial} md={6} />
      <Datum
        label={t("clocks.config.people")}
        value={people ? number(people.total) : t("status.empty")}
        item={
          people
            ? t("clocks.config.peopleItem", {
                withFace: number(people.withFace),
                withFingerprint: number(people.withFingerprint),
                withCard: number(people.withCard),
              })
            : undefined
        }
        md={6}
      />
      <Datum
        label={t("clocks.config.hour")}
        value={hour ? clockTime(hour.localTime) : t("status.empty")}
        md={6}
      />
      <Datum
        label={t("clocks.config.mode")}
        value={hour?.mode ? (modes[hour.mode] ?? hour.mode) : t("status.empty")}
        item={hour?.zone ?? undefined}
        md={6}
      />
      {hour && (
        <ITGrid item xs={12}>
          <ITFlex align="center" wrap="wrap" gap={2}>
            <ITBadget color={inHour ? "success" : "warning"} size="lg">
              {inHour
                ? t("clocks.config.inHour")
                : t(drift > 0 ? "clocks.config.ahead" : "clocks.config.behind", {
                    time: time(drift),
                  })}
            </ITBadget>
            <ITText className="text-[12px] text-slate-600">
              {inHour
                ? t("clocks.config.inItemHour", { seconds: Math.abs(drift) })
                : t("clocks.config.driftHint")}
            </ITText>
          </ITFlex>
        </ITGrid>
      )}
    </>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <ITFlex direction="column" gap={2}>
      <ITFlex align="baseline" wrap="wrap" gap={2}>
        <ITText className="text-[12px] font-semibold text-slate-500">
          {title}
        </ITText>
        {note && <ITText className="text-[11px] text-slate-400">{note}</ITText>}
      </ITFlex>
      <ITGrid container columns={12} spacing={4}>
        {children}
      </ITGrid>
    </ITFlex>
  );
}

function Datum({
  label,
  value,
  item,
  md = 3,
}: {
  label: string;
  value: string;
  item?: string;
  md?: number;
}) {
  return (
    <ITGrid item xs={12} md={md}>
      <ITFlex direction="column" gap={0.5} className="min-w-0">
        <ITText className="text-[12px] font-semibold text-slate-400">
          {label}
        </ITText>
        <ITText className="text-[12px] font-bold text-slate-800 break-words">{value}</ITText>
        {item && <ITText className="text-[11px] text-slate-500 break-words">{item}</ITText>}
      </ITFlex>
    </ITGrid>
  );
}
