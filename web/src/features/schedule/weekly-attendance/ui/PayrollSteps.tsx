import type { ReactNode } from "react";
import { ITText } from "@axzydev/axzy_ui_system";
import { LuCheck } from "react-icons/lu";

export type PayrollStepState = "done" | "active" | "todo";

export interface PayrollStep {
  title: string;
  caption: string;
  state: PayrollStepState;
  /** Abre la pantalla donde se atiende el paso (Asistencia, Tiempo extra). */
  onClick?: () => void;
}

/**
 * Los pasos del cierre de pre-nómina (Asistencia → Tiempo extra → Revisar
 * departamentos → Cerrar y exportar), como tarjetas con su estado: paloma
 * verde el atendido, número en tinta el activo y número gris el pendiente.
 */
export default function PayrollSteps({ steps }: { steps: PayrollStep[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((step, i) => (
        <StepCard key={step.title} n={i + 1} {...step} />
      ))}
    </div>
  );
}

function StepCard({ n, title, caption, state, onClick }: PayrollStep & { n: number }) {
  const circle: Record<PayrollStepState, ReactNode> = {
    done: (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--color-success) 16%, transparent)", color: "var(--color-success)" }}
      >
        <LuCheck size={15} strokeWidth={3} />
      </span>
    ),
    active: (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black text-white"
        style={{ background: "var(--color-primary-900)" }}
      >
        {n}
      </span>
    ),
    todo: (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black"
        style={{ background: "var(--it-bento-control-bg, #f1f5f9)", color: "var(--color-text-muted)" }}
      >
        {n}
      </span>
    ),
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex items-center gap-3 rounded-[14px] px-4 py-3.5 ${
        onClick ? "cursor-pointer transition-transform hover:-translate-y-0.5" : ""
      }`}
      style={{
        background: "var(--it-card-bg, #ffffff)",
        boxShadow:
          state === "active"
            ? "inset 0 0 0 1.5px var(--color-primary-900)"
            : "0 1px 2px rgb(15 23 42 / 0.06)",
      }}
    >
      {circle[state]}
      <div className="min-w-0">
        <ITText className="block truncate !text-[13px] font-black text-slate-800">{title}</ITText>
        <ITText muted className="block truncate !text-[11.5px]">
          {caption}
        </ITText>
      </div>
    </div>
  );
}
