import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  LuBell,
  LuBuilding2,
  LuCheck,
  LuCloud,
  LuFileLock2,
  LuHouse,
  LuLaptop,
  LuLock,
  LuMapPin,
  LuPenLine,
  LuScanFace,
  LuShieldCheck,
  LuUserCheck,
} from "react-icons/lu";

/** Encabezado común de cada celda: etiqueta, título y bajada. */
export const CellHead = ({ icon: Icon, label, title, text }: { icon: IconType; label: string; title: string; text: string }) => (
  <div>
    <span className="cl-eyebrow">
      <Icon size={14} /> {label}
    </span>
    <h3 className="mt-2.5 text-balance text-[21px] font-extrabold leading-tight tracking-tight">{title}</h3>
    <p className="cl-muted mt-2 max-w-md text-pretty text-[13.5px] leading-relaxed">{text}</p>
  </div>
);

const Demo = ({ children }: { children: ReactNode }) => (
  <div aria-hidden="true" className="select-none">
    {children}
  </div>
);

// ── Motor de horas extra ───────────────────────────────────────────────────
const WEEK = [
  { day: "Mié", ord: 8, dbl: 0, tpl: 0 },
  { day: "Jue", ord: 8, dbl: 2.5, tpl: 0 },
  { day: "Vie", ord: 8, dbl: 3, tpl: 0 },
  { day: "Sáb", ord: 5, dbl: 3.5, tpl: 0 },
  { day: "Dom", ord: 0, dbl: 0, tpl: 0 },
  { day: "Lun", ord: 8, dbl: 0, tpl: 1.5 },
  { day: "Mar", ord: 8, dbl: 0, tpl: 0 },
];
const MAX_DAY = 12;

export const OvertimeVisual = () => (
  <Demo>
    <div className="cl-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12.5px] font-bold">Hugo Castañeda · Matutino almacén</p>
          <p className="cl-faint text-[11px]">Semana del 28 oct al 3 nov</p>
        </div>
        <div className="flex gap-1.5">
          <span className="cl-tag cl-tag-plain">Ordinaria</span>
          <span className="cl-tag cl-tag-mint">Doble</span>
          <span className="cl-tag cl-tag-amber">Triple</span>
        </div>
      </div>
      <div className="mt-5 flex h-44 items-end gap-2 sm:gap-3">
        {WEEK.map((d, i) => {
          const total = d.ord + d.dbl + d.tpl;
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="cl-faint text-[10.5px] font-bold tabular-nums">{total ? `${total} h` : "—"}</span>
              <div
                className="cl-bar flex w-full max-w-[38px] flex-col-reverse overflow-hidden rounded-lg"
                style={{ height: `${(total / MAX_DAY) * 100}%`, transitionDelay: `${i * 70}ms` }}
              >
                <span style={{ flex: d.ord, background: "var(--navy-2)" }} />
                <span style={{ flex: d.dbl, background: "var(--mint)" }} />
                <span style={{ flex: d.tpl, background: "var(--amber)" }} />
              </div>
              <span className="cl-muted text-[11px] font-semibold">{d.day}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
        {[
          { label: "Al doble", value: "9.0 h", sub: "tope semanal 2026", tone: "var(--mint)" },
          { label: "Al triple", value: "1.5 h", sub: "excedente art. 68", tone: "var(--amber-ink)" },
          { label: "Fuera de ley", value: "0 h", sub: "sin infracción", tone: "var(--fg)" },
        ].map((item) => (
          <div key={item.label}>
            <p className="cl-faint text-[10.5px] font-bold uppercase tracking-[0.06em]">{item.label}</p>
            <p className="text-xl font-black tabular-nums" style={{ color: item.tone }}>
              {item.value}
            </p>
            <p className="cl-faint text-[10.5px]">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  </Demo>
);

// ── Reloj y agente ─────────────────────────────────────────────────────────
const Node = ({ icon: Icon, title, sub, accent = false }: { icon: IconType; title: string; sub: string; accent?: boolean }) => (
  <div className="flex w-[30%] min-w-0 flex-col items-center text-center">
    <span
      className="flex h-12 w-12 items-center justify-center rounded-2xl"
      style={accent ? { background: "var(--navy)", color: "#34D399" } : { background: "var(--surface)", border: "1px solid var(--line-strong)" }}
    >
      <Icon size={21} />
    </span>
    <p className="mt-2 text-[12px] font-bold leading-tight">{title}</p>
    <p className="cl-faint text-[10.5px] leading-tight">{sub}</p>
  </div>
);

const Wire = () => (
  <div className="cl-wire mb-9 self-center">
    <span />
    <span />
    <span />
  </div>
);

export const AgentVisual = () => (
  <Demo>
    <div className="cl-panel px-3 py-5 sm:px-5">
      <div className="flex items-start">
        <Node icon={LuScanFace} title="Reloj Hikvision" sub="Rostro · huella · tarjeta" />
        <Wire />
        <Node icon={LuLaptop} title="CheckLab Agent" sub="PC en tu red local" />
        <Wire />
        <Node icon={LuCloud} title="CheckLab" sub="Nube, por cliente" accent />
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        {[
          ["Sin VPN", "solo conexiones de salida"],
          ["Cola local", "si se cae el internet"],
          ["Idempotente", "jamás duplica checadas"],
        ].map(([title, sub]) => (
          <div key={title} className="rounded-xl px-2 py-2" style={{ background: "var(--surface)" }}>
            <p className="text-[11.5px] font-bold">{title}</p>
            <p className="cl-faint text-[10px] leading-tight">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  </Demo>
);

// ── Portal Mi jornada ──────────────────────────────────────────────────────
export const PortalVisual = () => (
  <Demo>
    <div className="cl-phone">
      <div className="px-4 pb-5 pt-4">
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full" style={{ background: "var(--line-strong)" }} />
        <p className="cl-faint text-[10.5px] font-semibold">Mi jornada</p>
        <p className="text-[15px] font-extrabold">Hola, Andrea</p>
        <div className="mt-3 rounded-2xl p-3 text-center" style={{ background: "var(--navy)", color: "#F4F6FA" }}>
          <p className="text-[10px] font-semibold opacity-70">Jueves 5 de noviembre</p>
          <p className="text-[28px] font-black tabular-nums leading-none tracking-tight">08:57</p>
          <p className="mt-1 text-[10px] opacity-70">Administrativo · 09:00 a 17:00</p>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-extrabold" style={{ background: "var(--mint)", color: "#06281C" }}>
          <LuUserCheck size={16} /> Registrar entrada
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px]" style={{ color: "var(--muted)" }}>
          <LuMapPin size={11} /> Ubicación solo en este marcaje
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            ["Ayer", "08:54 – 17:06", "Remoto"],
            ["Martes", "08:59 – 17:02", "Remoto"],
          ].map(([day, range, mode]) => (
            <div key={day} className="cl-panel flex items-center justify-between !rounded-xl px-2.5 py-1.5 text-[10.5px]">
              <span className="font-bold">{day}</span>
              <span className="tabular-nums">{range}</span>
              <span className="cl-tag cl-tag-mint !px-1.5 !py-0.5 !text-[9px]">{mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Demo>
);

// ── Bitácora inmutable ─────────────────────────────────────────────────────
const TRAIL: Array<{ icon: IconType; title: string; who: string; when: string; tone: string }> = [
  { icon: LuLock, title: "Checada original · Salida 21:47", who: "Reloj Andén 3 · no se puede editar", when: "Lun 19:47", tone: "var(--muted)" },
  { icon: LuPenLine, title: "Ajuste solicitado → 15:05", who: "Verónica Ibarra (RH) · «Olvidó checar su salida»", when: "Mar 09:12", tone: "var(--amber-ink)" },
  { icon: LuUserCheck, title: "Aprobado por otra persona", who: "Ricardo Salinas (Dirección)", when: "Mar 10:03", tone: "var(--mint)" },
  { icon: LuFileLock2, title: "Export STPS con hash", who: "sha256 · 9f3c…a71e", when: "Cierre", tone: "var(--fg)" },
];

export const AuditVisual = () => (
  <Demo>
    <ol className="relative space-y-2.5">
      <span className="absolute bottom-6 left-[17px] top-6 w-px" style={{ background: "var(--line-strong)" }} />
      {TRAIL.map(({ icon: Icon, title, who, when, tone }) => (
        <li key={title} className="relative flex items-start gap-3">
          <span className="relative z-10 flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--line-strong)", color: tone }}>
            <Icon size={15} />
          </span>
          <div className="cl-panel flex min-w-0 flex-1 items-center justify-between gap-3 !rounded-xl px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-bold">{title}</p>
              <p className="cl-faint truncate text-[11px]">{who}</p>
            </div>
            <span className="cl-faint shrink-0 text-[10.5px] font-semibold">{when}</span>
          </div>
        </li>
      ))}
    </ol>
  </Demo>
);

// ── Pre-nómina ─────────────────────────────────────────────────────────────
const DEPTS = [
  { name: "Almacén", people: 26, done: true },
  { name: "Transporte", people: 8, done: true },
  { name: "Mantenimiento", people: 2, done: true },
  { name: "Administración", people: 6, done: false },
  { name: "Recursos Humanos", people: 2, done: false },
];

export const PayrollVisual = () => (
  <Demo>
    <div className="cl-panel p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold">Revisión por departamento</p>
        <span className="cl-faint text-[11px] font-bold tabular-nums">3 / 5</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
        <div className="cl-hbar h-full rounded-full" style={{ width: "60%", background: "var(--mint)" }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {DEPTS.map((dept) => (
          <li key={dept.name} className="flex items-center gap-2.5 text-[12px]">
            <span
              className="flex h-[18px] w-[18px] items-center justify-center rounded-md"
              style={dept.done ? { background: "var(--mint)", color: "#06281C" } : { border: "1.5px solid var(--line-strong)" }}
            >
              {dept.done && <LuCheck size={12} strokeWidth={3} />}
            </span>
            <span className={dept.done ? "font-semibold" : "cl-muted"}>{dept.name}</span>
            <span className="cl-faint ml-auto text-[11px] tabular-nums">{dept.people} pers.</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl py-2 text-center text-[12px] font-bold" style={{ background: "var(--surface)", border: "1px dashed var(--line-strong)", color: "var(--faint)" }}>
        Cerrar semana · faltan 2
      </div>
    </div>
  </Demo>
);

// ── Alertas ────────────────────────────────────────────────────────────────
const ALERTS = [
  { tag: "cl-tag-rose", label: "Tope diario", title: "Jornada de 13 h 40 min", sub: "Operador de ruta · ayer" },
  { tag: "cl-tag-amber", label: "Por aprobar", title: "2 ajustes de checada", sub: "Solicitados por RH" },
  { tag: "cl-tag-mint", label: "Padrón", title: "Baja pendiente en el reloj", sub: "Dejó de aparecer hace 8 días" },
];

export const AlertsVisual = () => (
  <Demo>
    <div className="space-y-2">
      {ALERTS.map((alert, index) => (
        <div
          key={alert.title}
          className="cl-panel flex items-start gap-3 !rounded-2xl px-3 py-2.5"
          style={{ transform: `scale(${1 - index * 0.025})`, opacity: 1 - index * 0.12 }}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <LuBell size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <span className={`cl-tag ${alert.tag} !px-2 !py-0.5 !text-[10px]`}>{alert.label}</span>
            <p className="mt-1 truncate text-[12.5px] font-bold">{alert.title}</p>
            <p className="cl-faint truncate text-[11px]">{alert.sub}</p>
          </div>
        </div>
      ))}
    </div>
  </Demo>
);

// ── Teletrabajo NOM-037 ────────────────────────────────────────────────────
export const TeleworkVisual = () => (
  <Demo>
    <div className="cl-panel p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-bold">
          <LuHouse size={14} /> Checklist del lugar de trabajo
        </p>
        <span className="cl-tag cl-tag-mint">Apto</span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {["Espacio adecuado", "Ergonomía", "Seguridad eléctrica", "Conectividad", "Iluminación", "Plan de emergencia"].map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-[11.5px]">
            <LuCheck size={13} className="cl-mint shrink-0" strokeWidth={3} />
            <span className="truncate">{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--surface)" }}>
        <div>
          <p className="text-[12px] font-bold">Desconexión digital</p>
          <p className="cl-faint text-[10.5px]">Sin avisos de 17:00 a 09:00</p>
        </div>
        <span className="cl-switch" />
      </div>
    </div>
  </Demo>
);

// ── Multi-cliente ──────────────────────────────────────────────────────────
const TENANTS = [
  { name: "Grupo Logístico Altamira", host: "altamira", people: 44, plan: "Empresarial", color: "#0F766E" },
  { name: "Clínica Santa Lucía", host: "santalucia", people: 30, plan: "Profesional", color: "#2563EB" },
  { name: "Café Origen", host: "origen", people: 21, plan: "Básico", color: "#B45309" },
];

export const TenantsVisual = () => (
  <Demo>
    <div className="space-y-2">
      {TENANTS.map((tenant, index) => (
        <div key={tenant.host} className="cl-panel flex items-center gap-3 !rounded-2xl px-3 py-2.5" style={index === 0 ? { borderColor: "var(--mint)" } : undefined}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: tenant.color }}>
            <LuBuilding2 size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold">{tenant.name}</p>
            <p className="cl-faint truncate text-[11px]">{tenant.host}.checklab.mx</p>
          </div>
          <span className="cl-faint hidden text-[11px] font-semibold tabular-nums sm:block">{tenant.people} pers.</span>
          <span className="cl-tag cl-tag-plain">{tenant.plan}</span>
        </div>
      ))}
      <p className="cl-faint flex items-center gap-1.5 pt-1 text-[11px]">
        <LuShieldCheck size={13} className="cl-mint" /> Aislamiento por cliente en la base de datos (RLS)
      </p>
    </div>
  </Demo>
);

// ── Reforma: transición a 40 horas ─────────────────────────────────────────
const REFORM = [
  { year: 2026, weekly: 48, double: 9 },
  { year: 2027, weekly: 46, double: 9 },
  { year: 2028, weekly: 44, double: 10 },
  { year: 2029, weekly: 42, double: 11 },
  { year: 2030, weekly: 40, double: 12 },
];

export const ReformVisual = () => (
  <Demo>
    <div className="space-y-2.5">
      {REFORM.map((row, i) => (
        <div key={row.year} className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
          <span className={`text-[12px] font-bold tabular-nums ${row.year === 2026 ? "" : "cl-muted"}`}>{row.year}</span>
          <div className="flex h-7 overflow-hidden rounded-lg" style={{ background: "var(--surface-2)" }}>
            <div
              className="cl-hbar flex h-full"
              style={{ width: `${((row.weekly + row.double) / 60) * 100}%`, transitionDelay: `${i * 90}ms` }}
            >
              <span className="flex items-center pl-2.5 text-[11px] font-bold text-white" style={{ flex: row.weekly, background: "var(--navy-2)" }}>
                {row.weekly} h
              </span>
              <span className="flex items-center justify-center text-[10.5px] font-bold" style={{ flex: row.double, background: "var(--mint)", color: "#06281C" }}>
                +{row.double}
              </span>
            </div>
          </div>
          <span className="cl-faint w-16 text-right text-[10.5px] font-semibold">{row.year === 2026 ? "hoy" : row.year === 2030 ? "meta" : ""}</span>
        </div>
      ))}
      <div className="flex gap-3 pt-1 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--navy-2)" }} /> Jornada ordinaria semanal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--mint)" }} /> Horas al doble permitidas
        </span>
      </div>
    </div>
  </Demo>
);
