import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@shared/lib/usePrefersReducedMotion";

interface Props {
  /** Nivel real 0..1 (se recorta al rango). */
  level: number;
  /** Color de acento de la ola. */
  color: string;
}

/** Tope de altura (% del recuadro) para que la ola nunca tape el título de la tarjeta. */
const MAX_HEIGHT_PCT = 65;
const MIN_HEIGHT_PCT = 14;

/**
 * Ola de fondo a todo el ancho del recuadro (se usa como `backdrop` de `KpiTile`):
 * dos capas suaves en el color de acento, con altura proporcional a `level`.
 * Decorativa: el número real va en el texto. Ocupa el 100 % del ancho y se ancla
 * abajo; el padre debe ser un contenedor con alto definido.
 *
 * Al montarse sube desde el borde inferior hasta su nivel (respeta
 * `prefers-reduced-motion`).
 */
export default function WaveFill({ level, color }: Props) {
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(reduced);
  const v = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  const heightPct = MIN_HEIGHT_PCT + v * (MAX_HEIGHT_PCT - MIN_HEIGHT_PCT);

  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  if (v === 0) return null;
  // Lienzo 200x100 estirado con `preserveAspectRatio="none"`. La ola se dibuja
  // más ancha que el recuadro (-20..220) para que el vaivén no deje huecos.
  const wave = (top: number, amp: number, phase: number) =>
    `M -20 ${top + phase} C 20 ${top - amp} 60 ${top + amp} 100 ${top + phase} S 180 ${top - amp} 220 ${top + phase} L 220 100 L -20 100 Z`;
  return (
    <div
      className="absolute inset-x-0 bottom-0"
      style={{
        height: reduced || drawn ? `${heightPct}%` : "0%",
        transition: reduced ? undefined : "height 900ms cubic-bezier(.2,.7,.3,1)",
      }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="none" className="block">
        <path
          d={wave(14, 9, 5)}
          fill={color}
          fillOpacity={0.16}
          className={reduced ? undefined : "wave-layer-a"}
        />
        <path
          d={wave(14, -9, 0)}
          fill={color}
          fillOpacity={0.26}
          className={reduced ? undefined : "wave-layer-b"}
        />
      </svg>
    </div>
  );
}
