import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { dyn } from "@shared/i18n";
import { usePrefersReducedMotion } from "@shared/lib/usePrefersReducedMotion";
import Langostin from "./Langostin";
import type { LangostinAnim } from "./langostinSprite";
import { ITText } from "@axzydev/axzy_ui_system";

export type LangostinStateKind = "empty" | "noResults" | "forbidden" | "error" | "offline" | "loading";

interface Props {
  kind: LangostinStateKind;
  /** Sustituye el título por defecto del caso. */
  title?: string;
  /** Sustituye la descripción por defecto del caso. */
  description?: string;
  /** Acción opcional (botón, enlace) bajo el texto. */
  action?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** Animación de Langostín por caso (nivel L4 del plan de rediseño). */
const ANIM_BY_KIND: Record<LangostinStateKind, LangostinAnim> = {
  empty: "sleep",
  noResults: "search",
  forbidden: "lock",
  error: "err",
  offline: "offline",
  loading: "loading",
};

const MASCOT_SIZE = { sm: 72, md: 112 } as const;

/**
 * Estado de lista/feed/tablero: vacío, sin resultados, sin permiso, error,
 * sin conexión o cargando. Centrado y tranquilo; sin movimiento si el sistema
 * pide menos animación.
 */
export default function LangostinState({ kind, title, description, action, size = "md", className }: Props) {
  const { t } = useTranslation("langostin");
  const reduced = usePrefersReducedMotion();
  const tr = dyn(t);

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex flex-col items-center justify-center gap-2 text-center ${size === "sm" ? "px-4 py-6" : "px-6 py-12"} ${className ?? ""}`}
    >
      <Langostin anim={ANIM_BY_KIND[kind]} size={MASCOT_SIZE[size]} animated={!reduced} label={t("guide.label")} />
      <ITText className={`m-0 font-semibold text-slate-700 dark:text-slate-100 ${size === "sm" ? "text-sm" : "text-base"}`}>
        {title ?? tr(`state.${kind}.title`)}
      </ITText>
      <ITText className={`m-0 max-w-sm text-slate-500 dark:text-slate-400 ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {description ?? tr(`state.${kind}.description`)}
      </ITText>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
