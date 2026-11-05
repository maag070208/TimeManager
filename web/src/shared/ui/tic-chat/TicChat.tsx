import { useEffect, useRef, type ReactNode } from "react";
import { ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LangostinAvatar } from "@shared/ui/langostin";

interface Props {
  /** Nombre que se muestra en el encabezado (p. ej. «Langostín»). */
  title: string;
  /** Línea de contexto bajo el nombre. */
  subtitle?: string;
  /** Texto del estado en línea (si no se pasa, no se muestra el punto). */
  online?: string;
  /** Etiqueta del botón para reiniciar la conversación. */
  restartLabel?: string;
  onRestart?: () => void;
  /** Alto **fijo** del hilo: el chat no crece ni se encoge entre pasos (360). */
  height?: number;
  /** Conversación: burbujas del agente y del usuario. */
  children: ReactNode;
  /** Controles del paso actual (opciones, campos, acciones). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Chat con Langostín reutilizable: encabezado con avatar y estado, hilo con
 * scroll propio (`maxHeight`) y pie para las opciones del paso. Solo pinta; la
 * conversación y sus reglas viven en cada pantalla. Las burbujas entran con
 * animación (`agent-pop`), y con `prefers-reduced-motion` se desactiva.
 */
export default function LangostinChat({
  title,
  subtitle,
  online,
  restartLabel,
  onRestart,
  height = 360,
  children,
  footer,
  className,
}: Props) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const lastHeight = useRef(0);

  // Baja solo cuando el hilo crece (mensaje nuevo); si el usuario subió a leer,
  // escribir en un campo no le regresa el scroll al final.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (el.scrollHeight > lastHeight.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    lastHeight.current = el.scrollHeight;
  });

  return (
    <ITCard contentClassName="!p-0" className={className}>
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <LangostinAvatar anim="idle" size={26} />
        <ITFlex className="min-w-0 flex-1">
          <ITText className="truncate text-[13px] font-bold text-slate-800">{title}</ITText>
          {subtitle && <ITText className="truncate text-[11px] text-slate-500">{subtitle}</ITText>}
          {online && (
            <ITText className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--color-success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
              {online}
            </ITText>
          )}
        </ITFlex>
        {onRestart && restartLabel && (
          <ITButton variant="outlined" color="gray" size="sm" onClick={onRestart}>
            <ITText className="text-[11px] font-bold">{restartLabel}</ITText>
          </ITButton>
        )}
      </header>

      <div
        ref={threadRef}
        className="flex flex-col gap-3 overflow-y-auto px-4 py-4 [scrollbar-width:thin]"
        style={{ height }}
      >
        {children}
      </div>

      {footer && <div className="border-t border-slate-100 px-4 py-3">{footer}</div>}
    </ITCard>
  );
}

/** Burbuja del agente (a la izquierda). `avatar` solo en la pregunta actual. */
export function AgentBubble({ text, avatar = false, delay = 0 }: { text: string; avatar?: boolean; delay?: number }) {
  return (
    <ITFlex align="start" gap={2} className="agent-bubble" style={{ animationDelay: `${delay}ms` }}>
      {avatar ? <LangostinAvatar anim="idle" size={22} /> : <span className="w-9 shrink-0" aria-hidden />}
      <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-[12.5px] font-medium text-slate-700">
        {text}
      </div>
    </ITFlex>
  );
}

/** Burbuja del usuario (a la derecha, en color de marca). */
export function UserBubble({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <ITFlex justify="end" className="agent-bubble" style={{ animationDelay: `${delay}ms` }}>
      <div className="rounded-2xl rounded-br-sm bg-primary-500 px-3.5 py-2 text-[12.5px] font-medium text-white">
        {text}
      </div>
    </ITFlex>
  );
}
