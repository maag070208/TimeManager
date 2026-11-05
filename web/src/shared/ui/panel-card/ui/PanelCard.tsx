import type { ReactNode } from "react";
import { ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuArrowUpRight } from "react-icons/lu";

interface Props {
  title?: string;
  /** Ícono de línea, tenue, a la izquierda del título. */
  icon?: ReactNode;
  /** Texto de apoyo bajo el título. */
  description?: string;
  /** Acciones a la derecha del encabezado (botones, badges). */
  actions?: ReactNode;
  /** Si se da, muestra el botón redondo "↗" arriba a la derecha para abrir el detalle. */
  onOpen?: () => void;
  /** Etiqueta accesible del botón de abrir (por defecto "Abrir"). */
  openLabel?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Tarjeta de sección: `ITCard` sin estilos forzados, así que fondo, borde, radio,
 * sombra y padding los decide la apariencia del proveedor (bento: blanca sin borde
 * y radio 24 px; flat: borde fino plano; soft: flotante). Dibuja su propio
 * encabezado (ícono + título en negritas, descripción, acciones y botón de abrir).
 */
export default function PanelCard({ title, icon, description, actions, onOpen, openLabel, className = "", children }: Props) {
  const { t } = useTranslation("common");
  const hasHeader = title || description || actions || onOpen;
  return (
    <ITCard className={`bento-rise ${className ?? ""}`}>
      {hasHeader && (
        <ITFlex align="start" justify="between" gap={3} className={children ? "mb-4" : undefined}>
          <ITFlex className="min-w-0 flex-1">
            {title && (
              <ITFlex align="center" gap={2}>
                {icon && <span className="icon-breathe flex shrink-0 items-center text-slate-400">{icon}</span>}
                <h3 className="m-0 truncate !text-[16px] font-bold !text-slate-800">{title}</h3>
              </ITFlex>
            )}
            {description && <ITText className={`text-[12px] text-slate-500 ${title ? "mt-1" : ""}`}>{description}</ITText>}
          </ITFlex>
          {(actions || onOpen) && (
            <ITFlex align="center" gap={2} wrap="wrap" className="shrink-0">
              {actions}
              {onOpen && (
                <button
                  type="button"
                  onClick={onOpen}
                  aria-label={openLabel ?? t("actions.open")}
                  title={openLabel ?? t("actions.open")}
                  style={{ backgroundColor: "var(--it-bento-ink-bg, var(--color-primary))", color: "var(--it-bento-ink-text, #ffffff)" }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full !border-0 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
                >
                  <LuArrowUpRight size={16} />
                </button>
              )}
            </ITFlex>
          )}
        </ITFlex>
      )}
      {children}
    </ITCard>
  );
}
