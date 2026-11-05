import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  LuBell,
  LuClipboardCheck,
  LuFileUp,
  LuMessageSquare,
  LuTicket,
  LuTrash2,
  LuUserMinus,
  LuUserPlus,
} from "react-icons/lu";
import type { Notification } from "@entities/notification";
import { formatTimeInTZ } from "@shared/utils/dates";
import { ITText } from "@axzydev/axzy_ui_system";

type Tone = "primary" | "success" | "warning" | "danger" | "info";

/** Ícono de línea y chip pastel por tipo de notificación. */
const TYPE_STYLES: Record<string, { icon: ReactNode; tone: Tone }> = {
  COMMENT: { icon: <LuMessageSquare size={15} />, tone: "info" },
  ASSIGNED: { icon: <LuTicket size={15} />, tone: "primary" },
  TICKET_UPDATED: { icon: <LuTicket size={15} />, tone: "warning" },
  TICKET_CREATED: { icon: <LuTicket size={15} />, tone: "success" },
  USER_CREATED: { icon: <LuUserPlus size={15} />, tone: "success" },
  USER_DEACTIVATED: { icon: <LuUserMinus size={15} />, tone: "danger" },
  EMPLOYEE_DOC_UPLOADED: { icon: <LuFileUp size={15} />, tone: "info" },
  INVENTORY_AUDIT: { icon: <LuClipboardCheck size={15} />, tone: "warning" },
  KITCHEN_ALERTS: { icon: <LuBell size={15} />, tone: "warning" },
};

const FALLBACK = TYPE_STYLES.TICKET_UPDATED;

/**
 * Fila del feed de notificaciones: chip pastel por tipo, título (en negritas si
 * no se ha leído), detalle, hora y borrar. Se dibuja igual que `ITBentoFeed`
 * (que no admite acciones por fila ni marca de no leído).
 */
export default function NotificationItem({
  notification,
  onSlotClick,
  onDelete,
}: {
  notification: Notification;
  onSlotClick: (n: Notification) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation(["notifications", "common"]);
  const n = notification;
  const style = TYPE_STYLES[n.type] ?? FALLBACK;

  return (
    <div className="group flex items-center gap-1 rounded-[11px] hover:bg-[color-mix(in_srgb,currentColor_6%,transparent)]">
      <button
        type="button"
        onClick={() => onSlotClick(n)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[11px] !border-0 !bg-transparent px-1.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
      >
        <ITText as="span"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]"
          style={{ background: `var(--color-${style.tone}-soft)`, color: `var(--color-${style.tone})` }}
        >
          {style.icon}
        </ITText>
        <ITText as="span" className="min-w-0 flex-1">
          <ITText as="span" className={`block truncate text-[13px] ${n.read ? "font-medium text-slate-600" : "font-bold text-slate-800"}`}>
            {n.title}
          </ITText>
          {n.detail && <ITText as="span" className="block truncate text-[12px] text-slate-500">{n.detail}</ITText>}
        </ITText>
        <ITText as="span" className="flex shrink-0 items-center gap-2">
          <ITText as="span" className="text-[11.5px] tabular-nums text-slate-400">{formatTimeInTZ(n.createdAt)}</ITText>
          {!n.read && (
            <span
              role="img"
              aria-label={t("unread")}
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--color-primary)" }}
            />
          )}
        </ITText>
      </button>
      <button
        type="button"
        onClick={(e) => onDelete(n.id, e)}
        title={t("common:actions.delete")}
        aria-label={t("common:actions.delete")}
        className="mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full !border-0 !bg-transparent text-slate-300 transition hover:text-[color:var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
      >
        <LuTrash2 size={15} />
      </button>
    </div>
  );
}
