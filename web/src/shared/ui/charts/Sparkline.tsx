interface Props {
  /** Serie real de valores; con menos de 2 puntos no se dibuja nada. */
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

/** Línea de tendencia mínima en SVG. Decorativa: el número real va en el texto. */
export default function Sparkline({ data, color, width = 132, height = 48 }: Props) {
  if (data.length < 2) return null;
  const pad = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((d - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3.5}
        fill="var(--it-card-bg, #ffffff)"
        stroke={color}
        strokeWidth={2.5}
        className="spark-dot"
      />
    </svg>
  );
}
