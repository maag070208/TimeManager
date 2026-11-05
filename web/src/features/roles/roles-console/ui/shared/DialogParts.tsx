import type { ReactNode } from "react";
import { FaCheck } from "react-icons/fa";
import { ITText, ITFlex } from "@axzydev/axzy_ui_system";

/** Sección de un formulario en pasos: número, pregunta en lenguaje simple y ayuda. */
export function DialogSection({
  step,
  title,
  hint,
  children,
}: {
  step?: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <ITFlex align="start" gap={2}>
        {step !== undefined && (
          <ITText as="span" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[10px] font-black text-white">
            {step}
          </ITText>
        )}
        <div>
          <ITText className="text-[13px] font-bold text-slate-800">{title}</ITText>
          {hint && <ITText className="text-[11px] text-slate-500">{hint}</ITText>}
        </div>
      </ITFlex>
      <div className={step !== undefined ? "pl-7" : ""}>{children}</div>
    </section>
  );
}

type ChoiceTone = "primary" | "danger" | "success";

const TONE: Record<ChoiceTone, { selected: string; check: string }> = {
  primary: { selected: "border-primary-500 !bg-primary-500/5", check: "bg-primary-500" },
  danger: { selected: "border-rose-400 !bg-rose-50", check: "bg-rose-500" },
  success: { selected: "border-emerald-400 !bg-emerald-50", check: "bg-emerald-500" },
};

/** Opción grande tipo radio: título + explicación. */
export function ChoiceCard({
  selected,
  onClick,
  title,
  description,
  icon,
  tone = "primary",
  disabled = false,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: ChoiceTone;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? TONE[tone].selected : "border-slate-200 !bg-[var(--it-card-bg)] hover:border-slate-300"
      }`}
    >
      <ITText as="span"
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? `border-transparent ${TONE[tone].check} text-white` : "border-slate-300 bg-[var(--it-card-bg)]"
        }`}
      >
        {selected && <FaCheck size={7} />}
      </ITText>
      <ITText as="span" className="min-w-0 flex-1">
        <ITText as="span" className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
          {icon}
          {title}
        </ITText>
        {description && <ITText as="span" className="mt-0.5 block text-[11px] leading-snug text-slate-500">{description}</ITText>}
      </ITText>
    </button>
  );
}

/** Sugerencias clicables bajo un campo (p. ej. grupos o módulos existentes). */
export function SuggestionChips({
  options,
  value,
  onPick,
}: {
  options: readonly string[];
  value: string;
  onPick: (option: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${
            option === value
              ? "border-primary-500 !bg-primary-500 text-white"
              : "border-slate-200 !bg-[var(--it-card-bg)] text-slate-600 hover:border-primary-500 hover:text-primary-500"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Interruptor con título y explicación (en vez de una casilla suelta). */
export function ToggleRow({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 !bg-[var(--it-card-bg)] px-3 py-2.5 text-left hover:border-slate-300 disabled:opacity-50"
    >
      <ITText as="span"
        className={`relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition ${checked ? "bg-primary-500" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-[var(--it-card-bg)] shadow transition-all ${checked ? "left-3.5" : "left-0.5"}`}
        />
      </ITText>
      <ITText as="span" className="min-w-0 flex-1">
        <ITText as="span" className="block text-[12px] font-bold text-slate-800">{title}</ITText>
        {description && <ITText as="span" className="block text-[11px] leading-snug text-slate-500">{description}</ITText>}
      </ITText>
    </button>
  );
}

/** Pie de los diálogos: acción destructiva a la izquierda, cancelar/guardar a la derecha. */
export function DialogFooter({ left, children }: { left?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
      <div>{left}</div>
      <ITFlex align="center" gap={2}>{children}</ITFlex>
    </div>
  );
}

/** Mensaje de error bajo un campo. */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <ITText className="mt-1 text-[11px] font-semibold text-rose-600">{message}</ITText>;
}
