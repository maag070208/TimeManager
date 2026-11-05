import { Fragment, type ReactNode } from "react";
import { ITButton, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaCheck, FaChevronLeft, FaChevronRight } from "react-icons/fa";

export interface WizardStep {
  label: string;
}

interface Props {
  steps: WizardStep[];
  /** Índice (0-based) del paso activo. */
  current: number;
  /** Cambia de paso (los pasos futuros no se pueden saltar). */
  onChange: (next: number) => void;
  /** Acción del botón del último paso. */
  onFinish: () => void;
  nextLabel: string;
  backLabel: string;
  finishLabel: string;
  /** "Paso 1 de 3". */
  stepCounter: string;
  disableNext?: boolean;
  saving?: boolean;
  children: ReactNode;
}

/**
 * Encabezado de pasos compacto y propio (píldoras pequeñas en vez de los
 * círculos grandes del kit) más el pie con Atrás/Siguiente. Solo deja volver a
 * un paso anterior haciendo clic; hacia adelante, con el botón (y su validación).
 */
export default function StepWizard({
  steps,
  current,
  onChange,
  onFinish,
  nextLabel,
  backLabel,
  finishLabel,
  stepCounter,
  disableNext,
  saving,
  children,
}: Props) {
  const last = current === steps.length - 1;

  const pill = (state: "done" | "active" | "todo") =>
    [
      "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
      state === "active"
        ? "!border-[color:var(--color-primary)] !bg-[color:var(--color-primary)] !text-white"
        : state === "done"
          ? "!border-[color:var(--color-success-soft-border)] !bg-[color:var(--color-success-soft)] !text-[color:var(--color-success)] cursor-pointer"
          : "!border-[color:var(--it-card-border,#e2e8f0)] !bg-[color:var(--it-card-bg,#ffffff)] !text-[color:var(--color-text-muted)]",
    ].join(" ");

  const circle = (state: "done" | "active" | "todo") =>
    [
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
      state === "active"
        ? "!bg-white !text-[color:var(--color-primary)]"
        : state === "done"
          ? "!bg-[color:var(--color-success)] !text-white"
          : "!bg-[color:var(--it-bento-control-bg,#f1f5f9)] !text-[color:var(--color-text-muted)]",
    ].join(" ");

  return (
    <ITFlex direction="column" gap={4}>
      <ITFlex align="center" gap={2} className="overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const state: "done" | "active" | "todo" = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <Fragment key={i}>
              <button
                type="button"
                onClick={() => i < current && onChange(i)}
                disabled={i > current}
                className={pill(state)}
                aria-current={i === current ? "step" : undefined}
              >
                <ITText as="span" className={circle(state)}>{i < current ? <FaCheck size={9} /> : i + 1}</ITText>
                <ITText
                  as="span"
                  className={[
                    "text-[11px] font-bold whitespace-nowrap",
                    state === "active" ? "!text-white" : state === "done" ? "!text-[color:var(--color-success)]" : "!text-[color:var(--color-text-muted)]",
                  ].join(" ")}
                >
                  {s.label}
                </ITText>
              </button>
              {i < steps.length - 1 && <div className="h-0.5 min-w-[14px] flex-1 rounded-full !bg-[color:var(--it-bento-control-bg-hover,#e2e8f0)]" />}
            </Fragment>
          );
        })}
      </ITFlex>

      <div className="min-h-[240px]">{children}</div>

      <ITFlex align="center" justify="between" gap={2}>
        <ITButton variant="outlined" color="secondary" disabled={current === 0 || saving} onClick={() => onChange(current - 1)}>
          <ITFlex align="center" gap={1}>
            <FaChevronLeft size={10} />
            <ITText className="font-bold text-[11px]">{backLabel}</ITText>
          </ITFlex>
        </ITButton>

        <ITFlex align="center" gap={3}>
          <ITText className="hidden text-[11px] text-[color:var(--color-text-muted)] sm:block">{stepCounter}</ITText>
          <ITButton
            variant="filled"
            color="primary"
            disabled={disableNext || saving}
            onClick={() => (last ? onFinish() : onChange(current + 1))}
          >
            <ITFlex align="center" gap={1}>
              <ITText className="font-bold text-[11px]">{last ? finishLabel : nextLabel}</ITText>
              {last ? <FaCheck size={10} /> : <FaChevronRight size={10} />}
            </ITFlex>
          </ITButton>
        </ITFlex>
      </ITFlex>
    </ITFlex>
  );
}
