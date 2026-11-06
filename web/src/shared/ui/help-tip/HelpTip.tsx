import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuInfo } from "react-icons/lu";

/**
 * Ayuda contextual con tooltip en portal (no lo recorta la tarjeta). Se abre
 * con hover o foco y se cierra al salir; queda accesible por teclado.
 */
export default function HelpTip({ text, label = "Ayuda" }: { text: string; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth * 0.7);
    const left = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 8), window.innerWidth - width / 2 - 8);
    setPosition({ top: Math.max(8, rect.top - 8), left });
  }, []);
  const hide = useCallback(() => setPosition(null), []);

  return (
    <span ref={ref} className="inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <LuInfo size={12} />
      </button>
      {position &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: "fixed", top: position.top, left: position.left, transform: "translate(-50%, -100%)", width: Math.min(280, window.innerWidth * 0.7) }}
            className="pointer-events-none z-[9999] rounded-lg bg-slate-900 px-3 py-2 text-[11.5px] font-normal leading-snug text-white shadow-xl"
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
