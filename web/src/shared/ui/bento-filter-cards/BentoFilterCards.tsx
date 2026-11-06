import type { ReactNode } from "react";

export interface BentoFilterItem {
  id: string;
  label: string;
  value: string | number;
  caption?: string;
  icon?: ReactNode;
}

interface Props {
  items: BentoFilterItem[];
  activeId?: string;
  onSelect: (id: string) => void;
}

const Waves = ({ color }: { color: string }) => (
  <svg aria-hidden viewBox="0 0 600 70" preserveAspectRatio="none" className="dash-waves pointer-events-none absolute inset-x-0 bottom-0 h-[52px] w-[200%]">
    <path d="M0,42 C90,14 150,62 240,40 C330,18 390,60 480,36 C540,24 570,30 600,42 L600,70 L0,70 Z" fill={color} />
    <path d="M0,52 C100,30 160,66 260,48 C360,28 420,62 520,44 C560,38 580,42 600,52 L600,70 L0,70 Z" fill={color} opacity="0.5" />
  </svg>
);

/**
 * Tarjetas de filtro del bento. Regla: la tarjeta activa se marca con la ola
 * verde y sombra, sin borde de color.
 */
export default function BentoFilterCards({ items, activeId, onSelect }: Props) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {items.map((item) => {
        const selected = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={selected}
            className={`dash-kpi dash-card relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition ${selected ? "shadow-md" : "hover:-translate-y-0.5 hover:shadow-md"}`}
            style={{ borderColor: "#eef1f5" }}
          >
            <Waves color={selected ? "rgba(16,185,129,0.28)" : "rgba(15,46,61,0.10)"} />
            <span className="relative flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {item.icon && <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${selected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.icon}</span>}
              {item.label}
            </span>
            <span className="relative mt-1 block text-[30px] font-black tabular-nums text-slate-900">{item.value}</span>
            {item.caption && <span className="relative text-[11.5px] text-slate-500">{item.caption}</span>}
          </button>
        );
      })}
    </div>
  );
}
