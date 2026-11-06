import type { ReactNode } from "react";

export interface BentoKpiItem {
  id: string;
  label: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const Waves = ({ color }: { color: string }) => (
  <svg aria-hidden viewBox="0 0 600 70" preserveAspectRatio="none" className="dash-waves pointer-events-none absolute inset-x-0 bottom-0 h-[52px] w-[200%]">
    <path d="M0,42 C90,14 150,62 240,40 C330,18 390,60 480,36 C540,24 570,30 600,42 L600,70 L0,70 Z" fill={color} />
    <path d="M0,52 C100,30 160,66 260,48 C360,28 420,62 520,44 C560,38 580,42 600,52 L600,70 L0,70 Z" fill={color} opacity="0.5" />
  </svg>
);

const TONE = {
  neutral: { wave: "rgba(15,46,61,0.10)", chip: "bg-slate-100 text-slate-600" },
  success: { wave: "rgba(16,185,129,0.14)", chip: "bg-emerald-50 text-emerald-700" },
  warning: { wave: "rgba(245,158,11,0.16)", chip: "bg-amber-50 text-amber-700" },
  danger: { wave: "rgba(244,63,94,0.12)", chip: "bg-rose-50 text-rose-700" },
  info: { wave: "rgba(14,165,233,0.12)", chip: "bg-sky-50 text-sky-700" },
} as const;

/** KPIs bento en tarjetas blancas con olas; no son filtros. */
export default function BentoKpiGrid({ items }: { items: BentoKpiItem[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {items.map((item) => {
        const tone = TONE[item.tone ?? "neutral"];
        return (
          <div key={item.id} className="dash-card relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" style={{ borderColor: "#eef1f5" }}>
            <Waves color={tone.wave} />
            <span className="relative flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {item.icon && <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tone.chip}`}>{item.icon}</span>}
              {item.label}
            </span>
            <span className="relative mt-1 block text-[26px] font-black tabular-nums text-slate-900">{item.value}</span>
            {item.caption && <span className="relative text-[11.5px] text-slate-500">{item.caption}</span>}
          </div>
        );
      })}
    </div>
  );
}
