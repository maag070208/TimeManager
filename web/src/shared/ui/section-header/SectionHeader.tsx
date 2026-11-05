import type { ReactNode } from "react";
import { ITText, ITFlex } from "@axzydev/axzy_ui_system";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Acción o contenido a la derecha (badge, botón…). */
  right?: ReactNode;
}

/** Encabezado de sección de tarjeta: ícono, título, descripción y acción opcional. */
export default function SectionHeader({ icon, title, description, right }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
      <ITFlex align="center" gap={2.5}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <ITText as="h2" className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</ITText>
          {description && <ITText className="text-[11px] text-slate-400">{description}</ITText>}
        </div>
      </ITFlex>
      {right}
    </div>
  );
}
