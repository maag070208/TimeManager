import { ITBadget, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaChevronRight } from "react-icons/fa";
import {
  CLOCK_STATUS_COLOR,
  clockStatus,
  type TimeClockDevice,
} from "@entities/time-clock";
import { formatDateTime } from "@shared/utils/dates";
import { dateLocale } from "@shared/i18n";
import type { UseTimeClocks } from "../model/useTimeClocks";

const number = (n: number): string => n.toLocaleString(dateLocale());

interface Props {
  fx: UseTimeClocks;
  clock: TimeClockDevice;
  onOpen: () => void;
}

/**
 * Tarjeta resumen de un reloj dado de alta. Al hacer clic se entra al detalle
 * (sincronización, configuración leída en vivo y acciones).
 */
export default function ClockCard({ fx, clock, onOpen }: Props) {
  const { t } = fx;
  const status = clockStatus(clock);

  const item = ((): string | null => {
    switch (status) {
      case "running":
        if (!clock.inProgress) return null;
        return clock.inProgress.total != null
          ? t("status.clock.running", {
              readCount: number(clock.inProgress.readCount),
              total: number(clock.inProgress.total),
              newCount: number(clock.inProgress.newCount),
            })
          : t("status.clock.runningNoTotal", {
              readCount: number(clock.inProgress.readCount),
              newCount: number(clock.inProgress.newCount),
            });
      case "paused":
        return t("status.clock.paused");
      case "error":
        return clock.lastRun?.error ?? null;
      case "pending":
        return t("status.clock.pending");
      default:
        return null;
    }
  })();

  return (
    <ITCard onClick={onOpen}>
      <ITFlex direction="column" gap={3}>
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

        {item && (
          <ITText className="text-[12px] text-slate-600 break-words">{item}</ITText>
        )}

        <ITFlex
          align="center"
          gap={4}
          wrap="wrap"
          className="border-t border-slate-100 pt-3"
        >
          <Mini label={t("clocks.sync.punches")} value={number(clock.punches)} />
          <Mini
            label={t("clocks.sync.lastSync")}
            value={clock.syncedAt ? formatDateTime(clock.syncedAt) : t("status.empty")}
          />
        </ITFlex>

        <ITFlex align="center" justify="end" gap={1} className="text-primary-600">
          <ITText className="text-[11px] font-bold">{t("clocks.actions.details")}</ITText>
          <FaChevronRight size={9} />
        </ITFlex>
      </ITFlex>
    </ITCard>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <ITFlex direction="column" gap={0.5} className="min-w-0">
      <ITText className="text-[12px] font-semibold text-slate-400">
        {label}
      </ITText>
      <ITText className="text-[12px] font-bold text-slate-800 break-words">{value}</ITText>
    </ITFlex>
  );
}
