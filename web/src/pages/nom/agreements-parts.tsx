import type { ReactNode } from "react";
import { LuCircleCheck, LuHourglass, LuPenLine } from "react-icons/lu";
import { ProfileAvatar } from "@shared/ui/profile-avatar";

export type StatusTone = "todo" | "wait" | "ok" | "idle";

const STATUS_STYLE: Record<StatusTone, { bg: string; fg: string; icon: ReactNode }> = {
  todo: { bg: "#fffbeb", fg: "#b45309", icon: <LuPenLine size={12} /> },
  wait: { bg: "#f0f9ff", fg: "#0369a1", icon: <LuHourglass size={12} /> },
  ok: { bg: "#ecfdf5", fg: "#047857", icon: <LuCircleCheck size={12} /> },
  idle: { bg: "#f8fafc", fg: "#64748b", icon: null },
};

/** Pestaña con explicación: qué es el tema y si hay algo pendiente. */
export function TopicCard({
  active, onSelect, icon, title, description, status,
}: {
  active: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  status: { tone: StatusTone; text: string };
}) {
  const tone = STATUS_STYLE[status.tone];
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`tm-hero-card tm-hero-card--${active ? "mint" : "slate"} dash-card flex flex-col items-start gap-2 rounded-2xl p-4 pb-10 text-left transition ${active ? "shadow-md" : "hover:-translate-y-0.5 hover:shadow-md"}`}
    >
      <span className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={active ? { backgroundColor: "#ecfdf5", color: "#047857" } : { backgroundColor: "#f1f5f9", color: "#475569" }}>
          {icon}
        </span>
        {title}
      </span>
      <span className="text-[12.5px] leading-relaxed text-slate-600">{description}</span>
      <span
        className="mt-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {tone.icon}
        {status.text}
      </span>
    </button>
  );
}

/** Cómo funciona el tema en tres pasos; resalta el que le toca a RH. */
export function TopicGuide({
  color, tone, title, note, steps, action,
}: {
  color: string;
  tone: "mint" | "lavender" | "sky";
  title: string;
  note?: string;
  steps: Array<{ who: string; text: string; yours?: boolean }>;
  action?: ReactNode;
}) {
  return (
    <section className={`tm-hero-card tm-hero-card--${tone} dash-card rounded-2xl p-5 pb-14`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cómo funciona</p>
          <h2 className="mt-0.5 text-[18px] font-extrabold text-slate-900">{title}</h2>
          {note && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-600">{note}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.who + index}
            className="flex gap-3 rounded-xl p-3"
            style={step.yours ? { backgroundColor: "#ffffff", border: `1px solid ${color}55`, boxShadow: `0 10px 22px -18px ${color}` } : { backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid #eef1f5" }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
              style={step.yours ? { backgroundColor: color, color: "#ffffff" } : { backgroundColor: "#e2e8f0", color: "#475569" }}
            >
              {index + 1}
            </span>
            <p className="text-[12.5px] leading-relaxed text-slate-600">
              <span className="font-extrabold" style={{ color: step.yours ? color : "#0f172a" }}>{step.who}</span> {step.text}
              {step.yours && <span className="ml-1 text-[11px] font-bold" style={{ color }}>← aquí</span>}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Botón sólido de la acción principal (color en línea: el Tailwind del design system gana a las clases). */
export function SolidAction({ color, icon, disabled, onClick, children }: { color: string; icon: ReactNode; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-extrabold transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
      style={{ backgroundColor: color, color: "#ffffff", boxShadow: `0 12px 24px -14px ${color}` }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>{icon}</span>
      {children}
    </button>
  );
}

/** Tarjeta de una persona: avatar, estado, contenido y pie. Las pendientes llevan acento ámbar. */
export function PersonCard({
  name, subtitle, pending, status, footer, children,
}: {
  name: string;
  subtitle?: string;
  pending: boolean;
  status: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className="flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "#eef1f5", borderLeft: `4px solid ${pending ? "#f59e0b" : "#10b981"}` }}
    >
      <header className="flex items-center gap-3">
        <ProfileAvatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-slate-900">{name}</p>
          {subtitle && <p className="text-[11.5px] text-slate-500">{subtitle}</p>}
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={pending ? { backgroundColor: "#fffbeb", color: "#b45309" } : { backgroundColor: "#ecfdf5", color: "#047857" }}
        >
          {pending ? <LuHourglass size={11} /> : <LuCircleCheck size={11} />} {status}
        </span>
      </header>
      <div className="mt-3 flex-1">{children}</div>
      <footer className="mt-3 border-t border-slate-100 pt-3 text-[12px] font-semibold text-slate-600">{footer}</footer>
    </article>
  );
}
