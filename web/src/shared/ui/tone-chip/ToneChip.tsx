import type { ReactNode } from "react";
import { ITText } from "@axzydev/axzy_ui_system";

export type ToneChipTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "alert"
  | "danger";

export type ToneChipSize = "sm" | "md";

interface Props {
  label: string;
  tone?: ToneChipTone;
  size?: ToneChipSize;
  /** Ícono a la izquierda del texto. */
  icon?: ReactNode;
  /** Punto de color a la izquierda (si no hay `icon`). */
  dot?: boolean;
  className?: string;
}

const SIZE: Record<ToneChipSize, string> = {
  sm: "px-2.5 py-0.5 text-[11px]",
  md: "px-3 py-1 text-xs",
};

/**
 * Chip pastel de estado/prioridad: fondo suave del tono y texto del mismo
 * tono un poco más oscuro. Usa tokens del tema (`--color-<tono>`; sigue modo
 * oscuro y apariencia), sin hex ni mayúsculas.
 */
export default function ToneChip({ label, tone = "neutral", size = "sm", icon, dot = false, className = "" }: Props) {
  const color = tone === "neutral" ? "var(--color-slate-500)" : `var(--color-${tone})`;
  const mix = `color-mix(in srgb, ${color} 16%, transparent)`;
  // Fondo del kit (`--color-<tono>-soft`) si existe; si no, el tono al 16 %.
  const background = tone === "neutral" ? mix : `var(--color-${tone}-soft, ${mix})`;
  return (
    <ITText as="span"
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold ${SIZE[size]} ${className}`}
      style={{
        background,
        color: `color-mix(in srgb, ${color} 78%, #000)`,
      }}
    >
      {icon ??
        (dot ? (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        ) : null)}
      {label}
    </ITText>
  );
}
