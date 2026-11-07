import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuCloud, LuLaptop, LuScanFace } from "react-icons/lu";

/** Encabezado común de cada celda: etiqueta, título y bajada. */
export const CellHead = ({ icon: Icon, label, title, text }: { icon: IconType; label: string; title: string; text: string }) => (
  <div>
    <span className="cl-eyebrow">
      <Icon size={14} /> {label}
    </span>
    <h3 className="cl-h3 mt-2.5 text-balance">{title}</h3>
    <p className="cl-muted mt-2 max-w-md text-pretty text-[14px] leading-relaxed">{text}</p>
  </div>
);

const Demo = ({ children }: { children: ReactNode }) => (
  <div aria-hidden="true" className="select-none">
    {children}
  </div>
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
    <p className="mt-2 text-[12.5px] font-bold leading-tight">{title}</p>
    <p className="cl-faint text-[11px] leading-tight">{sub}</p>
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
            <p className="text-[12px] font-bold">{title}</p>
            <p className="cl-faint text-[10.5px] leading-tight">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  </Demo>
);

// ── Reforma 48 → 40 h ─────────────────────────────────────────────────────
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
          <span className={`text-[12.5px] font-bold tabular-nums ${row.year === 2026 ? "" : "cl-muted"}`}>{row.year}</span>
          <div className="flex h-7 overflow-hidden rounded-lg" style={{ background: "var(--surface-2)" }}>
            <div
              className="cl-hbar flex h-full"
              style={{ width: `${((row.weekly + row.double) / 60) * 100}%`, transitionDelay: `${i * 90}ms` }}
            >
              <span className="flex items-center pl-2.5 text-[11.5px] font-bold text-white" style={{ flex: row.weekly, background: "var(--navy-2)" }}>
                {row.weekly} h
              </span>
              <span className="flex items-center justify-center text-[11px] font-bold" style={{ flex: row.double, background: "var(--mint)", color: "#06281C" }}>
                +{row.double}
              </span>
            </div>
          </div>
          <span className="cl-faint w-12 text-right text-[11px] font-semibold">{row.year === 2026 ? "hoy" : row.year === 2030 ? "meta" : ""}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11.5px]">
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
