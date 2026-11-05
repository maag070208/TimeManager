import { ITText } from "@axzydev/axzy_ui_system";
interface Segment {
  label: string;
  value: number;
  color: string;
  /** Valor como se muestra (p. ej. "03:20"); por defecto el número. */
  display?: string;
}

/**
 * Una barra horizontal repartida en partes de un todo (con separación entre
 * partes) y su leyenda con valores; el detalle aparece al pasar el mouse.
 */
export default function StackedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, transparent)" }}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                className="h-3 transition-opacity hover:opacity-80"
                style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
                title={`${s.label}: ${s.display ?? s.value} (${Math.round((s.value / total) * 100)}%)`}
              />
            ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <ITText as="span" key={s.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
            <ITText as="span" className="font-black text-slate-700">{s.display ?? s.value}</ITText>
          </ITText>
        ))}
      </div>
    </div>
  );
}
