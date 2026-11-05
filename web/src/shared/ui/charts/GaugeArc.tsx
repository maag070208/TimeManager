import { useEffect, useId, useState } from "react";
import { usePrefersReducedMotion } from "@shared/lib/usePrefersReducedMotion";

interface Props {
  /** Proporción real 0..1 (se recorta al rango). */
  value: number;
  /** Color de acento del arco. */
  color: string;
  width?: number;
}

/**
 * Semicírculo con pista tenue (el mismo acento al 16 %, visible sobre cualquier
 * fondo) y arco degradado hacia el acento, con puntas redondeadas y una perilla
 * al final. Decorativo: el número real va en el texto.
 *
 * Al montarse, el arco se dibuja de izquierda a derecha y la perilla aparece al
 * final (respeta `prefers-reduced-motion`).
 */
export default function GaugeArc({ value, color, width = 120 }: Props) {
  const id = useId();
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(reduced);
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const stroke = 11;
  const r = (width - stroke) / 2 - 4;
  const cx = width / 2;
  const cy = r + stroke / 2 + 4;
  const height = cy + stroke / 2 + 2;
  // Ángulo: 180° (izquierda) → 0° (derecha) sobre el semicírculo superior.
  const angle = Math.PI * (1 - v);
  const ex = cx + r * Math.cos(angle);
  const ey = cy - r * Math.sin(angle);
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
  // Longitud del arco dibujado (proporción `v` del semicírculo de radio `r`).
  const arcLength = Math.PI * r * v;

  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <path d={track} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} strokeLinecap="round" />
      {v > 0 && (
        <path
          d={arc}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={reduced ? undefined : arcLength}
          strokeDashoffset={reduced ? undefined : drawn ? 0 : arcLength}
          style={{ transition: reduced ? undefined : "stroke-dashoffset 900ms cubic-bezier(.2,.7,.3,1)" }}
        />
      )}
      {v > 0 && (
        <circle
          cx={ex}
          cy={ey}
          r={stroke / 2 + 1.5}
          fill="var(--it-card-bg, #ffffff)"
          stroke={color}
          strokeWidth={3}
          className={reduced ? undefined : "gauge-knob"}
          style={{
            opacity: reduced ? 1 : drawn ? 1 : 0,
            transition: reduced ? undefined : "opacity 220ms ease-out 700ms",
          }}
        />
      )}
    </svg>
  );
}
