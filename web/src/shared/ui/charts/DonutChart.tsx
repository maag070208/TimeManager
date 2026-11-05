import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@shared/lib/usePrefersReducedMotion";
import { ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  /** Leyenda integrada junto a la dona; ocúltala si quien llama dibuja la suya. */
  showLegend?: boolean;
  /** Texto tenue bajo el total, al centro (p. ej. "resueltos"). */
  caption?: string;
}

/** Separación entre segmentos (px de arco), para que cada uno se distinga sin depender solo del color. */
const GAP = 2;

/**
 * Dona simple en SVG inline (no hay librería de gráficas en el proyecto): total
 * al centro, leyenda con valor y porcentaje, y el detalle de cada segmento al
 * pasar el mouse. Los segmentos deben ser partes de un todo (suman el total).
 *
 * Al montarse, los segmentos se dibujan uno tras otro (respeta
 * `prefers-reduced-motion`).
 */
export default function DonutChart({ segments, size = 128, showLegend = true, caption }: Props) {
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(reduced);
  const total = segments.reduce((s, sec) => s + sec.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  let offset = 0;
  let visibleIndex = -1;

  return (
    <div className={`flex items-center w-full ${showLegend ? "gap-5" : "justify-center"}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeOpacity={0.15}
          strokeWidth={12}
        />
        {total > 0 &&
          segments.map((sec) => {
            if (sec.value === 0) return null;
            const fraction = sec.value / total;
            const dash = fraction * circumference;
            const visible = segments.filter((x) => x.value > 0).length > 1 ? Math.max(dash - GAP, 1) : dash;
            const dashArray = `${visible} ${circumference - visible}`;
            const dashOffset = -offset;
            offset += dash;
            visibleIndex += 1;
            return (
              <circle
                key={sec.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                style={{
                  stroke: sec.color,
                  transition: reduced
                    ? undefined
                    : `stroke-dasharray 800ms cubic-bezier(.2,.7,.3,1) ${visibleIndex * 110}ms, opacity 150ms`,
                }}
                strokeWidth={12}
                strokeDasharray={reduced || drawn ? dashArray : `0 ${circumference}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${center} ${center})`}
                strokeLinecap="butt"
                className="hover:opacity-80"
              >
                <title>{`${sec.label}: ${sec.value} (${Math.round(fraction * 100)}%)`}</title>
              </circle>
            );
          })}
        <text
          x={center}
          y={caption ? center - size * 0.04 : center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-700 font-black"
          style={{ fontSize: size * (caption ? 0.2 : 0.18) }}
        >
          {total}
        </text>
        {caption && (
          <text
            x={center}
            y={center + size * 0.13}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-400 font-medium"
            style={{ fontSize: Math.max(10, size * 0.075) }}
          >
            {caption}
          </text>
        )}
      </svg>
      {showLegend && (
        <ITStack className="min-w-0 flex-1" spacing={2}>
          {segments.map((sec) => {
            const pct = total > 0 ? Math.round((sec.value / total) * 100) : 0;
            return (
              <ITFlex align="center" gap={2} key={sec.label}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                <ITText as="span" className="text-[10px] font-bold text-slate-500 truncate">{sec.label}</ITText>
                <ITText as="span" className="text-[10px] font-black text-slate-700 ml-auto">
                  {sec.value} · {pct}%
                </ITText>
              </ITFlex>
            );
          })}
        </ITStack>
      )}
    </div>
  );
}
