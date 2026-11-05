import { ITText } from "@axzydev/axzy_ui_system";
interface Row {
  label: string;
  value: number;
}

interface Props {
  rows: Row[];
  /** Color de las barras (una sola magnitud → un solo color). */
  color?: string;
  /** Cuántas barras mostrar; el resto se resume en "+N". */
  max?: number;
  /** Texto de "+N más" (lo traduce quien llama). */
  moreLabel?: (count: number) => string;
  /** Unidad del valor en el detalle al pasar el mouse (p. ej. "personas"). */
  unit?: string;
}

/**
 * Barras horizontales ordenadas de mayor a menor: etiqueta a la izquierda,
 * barra delgada con esquina redondeada y el valor al final. Al pasar el mouse
 * se resalta la fila y muestra el detalle.
 */
export default function HBarChart({ rows, color = "var(--color-primary)", max = 8, moreLabel, unit }: Props) {
  const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, max);
  const top = shown[0]?.value ?? 0;
  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((r) => (
        <div
          key={r.label}
          className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 rounded px-1 hover:bg-[color:var(--it-bento-control-bg,#f8fafc)]"
          title={`${r.label}: ${r.value}${unit ? ` ${unit}` : ""}`}
        >
          <ITText as="span" className="truncate text-[10px] font-bold text-slate-600">{r.label}</ITText>
          <div className="h-2 rounded-r" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
            <div
              className="h-2 rounded-r transition-opacity group-hover:opacity-80"
              style={{ width: `${top ? Math.max((r.value / top) * 100, 2) : 0}%`, backgroundColor: color }}
            />
          </div>
          <ITText as="span" className="text-[10px] font-black text-slate-700">{r.value}</ITText>
        </div>
      ))}
      {sorted.length > max && moreLabel && (
        <ITText as="span" className="px-1 text-[9px] font-bold text-slate-400">{moreLabel(sorted.length - max)}</ITText>
      )}
    </div>
  );
}
