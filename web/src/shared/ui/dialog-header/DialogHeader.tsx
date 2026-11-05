import type { ReactNode } from "react";
import { ITText, ITFlex } from "@axzydev/axzy_ui_system";

export type DialogHeaderTone = "primary" | "secondary" | "ternary" | "success" | "info" | "warning" | "danger";

interface Props {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Color del chip: usa `--color-<tone>-soft` de fondo y `--color-<tone>` en el ícono. */
  tone?: DialogHeaderTone;
}

/**
 * Encabezado de modal M2/M3: ícono en chip pastel + título + subtítulo.
 * Va como primer hijo dentro de `ITDialog`.
 */
export default function DialogHeader({ icon, title, subtitle, tone = "primary" }: Props) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <ITText as="span"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[20px]"
        style={{ background: `var(--color-${tone}-soft)`, color: `var(--color-${tone})` }}
      >
        {icon}
      </ITText>
      {/* Título arriba y subtítulo debajo: en fila se pegaban ("títuloSubtítulo"). */}
      <ITFlex direction="column" gap={0} className="min-w-0 flex-1">
        <ITText as="h2" className="m-0 line-clamp-1 !text-[18px] font-bold leading-tight !text-slate-800">
          {title}
        </ITText>
        {subtitle && (
          <ITText className="m-0 mt-0.5 line-clamp-2 !text-[12.5px] leading-snug text-slate-500">{subtitle}</ITText>
        )}
      </ITFlex>
    </div>
  );
}
