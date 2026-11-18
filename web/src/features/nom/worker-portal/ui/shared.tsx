import type { CSSProperties, ReactNode } from "react";
import { ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuHand } from "react-icons/lu";
import { HelpTip } from "@shared/ui/help-tip";

export const CardHeader = ({ icon, title, help }: { icon: ReactNode; title: string; help?: string }) => (
  <ITFlex align="center" gap={2} className="min-w-0">
    <span className="text-slate-500">{icon}</span>
    <ITText className="truncate font-bold">{title}</ITText>
    {help && <HelpTip text={help} />}
  </ITFlex>
);

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <ITText className="block rounded-lg border border-red-200 bg-red-50 px-3 py-2 !text-[12.5px] text-red-700">{children}</ITText>
);

export type HeroTone = "mint" | "sky" | "amber" | "slate" | "lavender" | "rose";

/** Tarjeta grande bento del portal: fondo blanco con la ola del tono. */
export const HeroCard = ({ tone, children }: { tone: HeroTone; children: ReactNode }) => (
  <ITCard contentClassName="!p-0">
    <div className={`tm-hero-card tm-hero-card--${tone} dash-card rounded-2xl p-5 pb-11 text-slate-900`} style={{ borderColor: "#eef1f5" }}>
      {children}
    </div>
  </ITCard>
);

/** Encabezado del hero: rótulo en versalitas, título y una etiqueta a la derecha. */
export const HeroHeader = ({ eyebrow, title, aside }: { eyebrow: string; title: ReactNode; aside?: ReactNode }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0">
      <ITText className="!text-[10.5px] font-semibold uppercase tracking-[0.12em] !text-slate-500">{eyebrow}</ITText>
      <ITText className="!text-[15px] font-bold !text-slate-900">{title}</ITText>
    </div>
    {aside}
  </div>
);

/**
 * Acción principal del portal: botón sólido del color indicado. Con `cta`
 * late y muestra «Toca» para que se note que hay que presionarlo.
 */
export const SolidButton = ({
  color, icon, eyebrow, label, busy = false, disabled = false, cta = false, onClick,
}: {
  color: string;
  icon: ReactNode;
  eyebrow?: string;
  label: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  cta?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={busy || disabled}
    aria-busy={busy}
    onClick={onClick}
    style={{ backgroundColor: color, color: "#ffffff", "--tm-cta": color } as CSSProperties}
    className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${eyebrow ? "min-h-[80px] py-4" : "min-h-[60px] py-3"} ${cta && !busy && !disabled ? "tm-punch-cta" : ""}`}
  >
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col" aria-live="polite">
      {eyebrow && <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ opacity: 0.8 }}>{eyebrow}</span>}
      <span className={`font-extrabold leading-tight ${eyebrow ? "text-[20px]" : "text-[16px]"}`}>{label}</span>
    </span>
    {cta && !busy && (
      <span className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ backgroundColor: "#ffffff", color }}>
        <LuHand size={14} /> Toca
      </span>
    )}
    {busy && <span className="tm-punch-progress" />}
  </button>
);

/** Enlace discreto debajo de una acción principal. */
export const QuietLink = ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="self-center px-2 py-1 text-[12.5px] font-semibold text-slate-500 underline underline-offset-2 disabled:opacity-50"
  >
    {children}
  </button>
);

/** Aviso dentro de un hero cuando no hay acción que tomar. */
export const Notice = ({ icon, chip, title, hint }: { icon: ReactNode; chip: string; title: string; hint: string }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-slate-50/80 px-4 py-4">
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${chip}`}>{icon}</span>
    <span className="flex flex-col">
      <span className="text-[17px] font-extrabold leading-tight text-slate-900">{title}</span>
      <span className="text-[12.5px] text-slate-600">{hint}</span>
    </span>
  </div>
);
