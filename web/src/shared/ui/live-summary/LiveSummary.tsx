import type { ReactNode } from "react";
import { ITBentoSegments, ITCard, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";

interface Props {
  /** Título de la tarjeta (por defecto "Resumen"). */
  title?: string;
  /** Total de secciones del formulario; sin él no se dibuja el progreso. */
  total?: number;
  /** Secciones completas. */
  done?: number;
  /** Filas del resumen en lenguaje humano (`LiveSummaryRow`). */
  children?: ReactNode;
  /** Espacio al pie (p. ej. la guía de Langostín). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Resumen vivo de un formulario (plantilla P4): tarjeta con lo capturado hasta
 * ahora y el avance en segmentos. En pantallas grandes se queda fija mientras
 * se hace scroll; en móvil va en línea, debajo del formulario.
 */
export default function LiveSummary({ title, total = 0, done = 0, children, footer, className = "" }: Props) {
  const { t } = useTranslation("common");
  return (
    <ITCard className={`self-start lg:sticky lg:top-4 ${className}`}>
      <ITText as="h3" className="m-0 mb-3 !text-[16px] font-bold !text-slate-800">{title ?? t("liveSummary.title")}</ITText>
      {children && <ITStack spacing={2.5}>{children}</ITStack>}
      {total > 0 && (
        <div className={`${children ? "mt-4" : ""} flex flex-col gap-1.5`}>
          <ITBentoSegments total={total} done={done} />
          <ITText className="m-0 text-[11.5px] text-slate-500">{t("liveSummary.progress", { done, total })}</ITText>
        </div>
      )}
      {footer && <div className="mt-4">{footer}</div>}
    </ITCard>
  );
}

/** Fila etiqueta/valor del resumen; sin valor se muestra tenue con "—". */
export function LiveSummaryRow({ label, value }: { label: string; value?: ReactNode }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <ITText as="span" className="shrink-0 text-slate-500">{label}</ITText>
      <ITText as="span" className={`min-w-0 text-right font-semibold ${empty ? "text-slate-400" : "text-slate-800"}`}>{empty ? "—" : value}</ITText>
    </div>
  );
}
