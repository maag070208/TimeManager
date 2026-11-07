import { useEffect, useState } from "react";
import { LuFingerprint, LuScanFace, LuSmartphone } from "react-icons/lu";

type Kind = "ENTRADA" | "SALIDA" | "RETARDO";
type Method = "Rostro" | "Huella" | "Web";

interface Punch {
  name: string;
  area: string;
  time: string;
  kind: Kind;
  method: Method;
  color: string;
}

/** Personas ficticias del demo (Grupo Logístico Altamira). */
const STREAM: Punch[] = [
  { name: "Hugo Castañeda", area: "Almacén · Surtido", time: "06:52", kind: "ENTRADA", method: "Rostro", color: "#0E9F6E" },
  { name: "Mariana Flores", area: "Recepción", time: "06:55", kind: "ENTRADA", method: "Huella", color: "#2563EB" },
  { name: "Luis Ortega", area: "Embarques · Nocturno", time: "06:58", kind: "SALIDA", method: "Rostro", color: "#B45309" },
  { name: "Karla Núñez", area: "Finanzas · Home office", time: "08:57", kind: "ENTRADA", method: "Web", color: "#7C3AED" },
  { name: "Jorge Medina", area: "Operadores de ruta", time: "06:21", kind: "RETARDO", method: "Rostro", color: "#DB2777" },
  { name: "Daniela Ruiz", area: "Almacén · Recepción", time: "06:49", kind: "ENTRADA", method: "Rostro", color: "#0891B2" },
  { name: "Arturo Vázquez", area: "Mantenimiento", time: "07:03", kind: "ENTRADA", method: "Huella", color: "#4F46E5" },
  { name: "Sofía Domínguez", area: "Compras", time: "09:01", kind: "ENTRADA", method: "Rostro", color: "#059669" },
];

const KIND_TAG: Record<Kind, string> = {
  ENTRADA: "cl-tag cl-tag-mint",
  SALIDA: "cl-tag cl-tag-amber",
  RETARDO: "cl-tag cl-tag-rose",
};
const KIND_LABEL: Record<Kind, string> = { ENTRADA: "Entrada", SALIDA: "Salida", RETARDO: "Retardo · 21 min" };
const METHOD_ICON = { Rostro: LuScanFace, Huella: LuFingerprint, Web: LuSmartphone } as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

const useReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Consola de "Asistencia de hoy" con checadas que van entrando, como la ve RH
 * cuando el agente sincroniza el reloj. Todo es ilustrativo.
 */
export default function HeroConsole() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 2200);
    return () => window.clearInterval(id);
  }, [reduced]);

  const rows = Array.from({ length: 4 }, (_, i) => STREAM[(tick + STREAM.length - i) % STREAM.length]);
  const onTime = 31 + (tick % 4);
  const pending = Math.max(2, 7 - (tick % 6));

  return (
    <div className="relative" role="img" aria-label="Consola de asistencia de hoy con checadas en tiempo real (datos ilustrativos)">
      <div className="cl-card p-4 sm:p-5" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold">Asistencia de hoy</p>
            <p className="cl-faint truncate text-[11.5px]">Grupo Logístico Altamira · CEDIS Tlalnepantla</p>
          </div>
          <span className="cl-tag cl-tag-plain">
            <span className="cl-pulse" /> En vivo
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "A tiempo", value: onTime, tone: "var(--mint)", bg: "var(--mint-soft)" },
            { label: "Con retardo", value: 3, tone: "var(--amber-ink)", bg: "var(--amber-soft)" },
            { label: "Sin llegar", value: pending, tone: "var(--rose)", bg: "var(--rose-soft)" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl px-3 py-2.5" style={{ background: stat.bg }}>
              <p className="text-[10.5px] font-bold" style={{ color: stat.tone }}>
                {stat.label}
              </p>
              <p className="text-2xl font-black tabular-nums tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="cl-faint text-[10.5px] font-bold uppercase tracking-[0.08em]">Últimas checadas</p>
          <p className="cl-faint text-[10.5px]">Andén 3 · hace segundos</p>
        </div>
        <ul className="mt-2 space-y-1.5">
          {rows.map((row, index) => {
            const Icon = METHOD_ICON[row.method];
            return (
              <li
                key={`${tick}-${index}`}
                className={`cl-panel flex items-center gap-3 px-3 py-2 ${index === 0 ? "cl-feed-row" : ""}`}
                style={{ opacity: 1 - index * 0.14 }}
              >
                <span className="cl-avatar" style={{ background: row.color }}>
                  {initials(row.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold">{row.name}</p>
                  <p className="cl-faint truncate text-[11px]">{row.area}</p>
                </div>
                <span className="cl-faint hidden items-center gap-1 text-[11px] sm:inline-flex">
                  <Icon size={13} /> {row.method}
                </span>
                <span className="text-[12px] font-bold tabular-nums">{row.time}</span>
                <span className={KIND_TAG[row.kind]}>{KIND_LABEL[row.kind]}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="cl-card cl-float absolute -left-4 -top-6 hidden items-center gap-3 !rounded-2xl px-3.5 py-2.5 sm:flex" aria-hidden="true">
        <img src="/brand/svg/checklab-symbol-for-light-bg.svg" alt="" className="cl-logo-light h-9 w-9" />
        <img src="/brand/svg/checklab-symbol-for-dark-bg.svg" alt="" className="cl-logo-dark h-9 w-9" />
        <div>
          <p className="text-[12px] font-bold">Checada registrada</p>
          <p className="cl-faint text-[11px]">Inmutable · sello 06:52:14</p>
        </div>
      </div>

      <div className="cl-card cl-float-late absolute -bottom-5 -right-3 hidden !rounded-2xl px-4 py-3 sm:block" aria-hidden="true">
        <p className="cl-faint text-[10.5px] font-bold uppercase tracking-[0.08em]">Semana en curso</p>
        <p className="mt-0.5 text-[13px] font-bold">
          <span className="cl-mint">9.0 h</span> doble · <span className="cl-amber">1.5 h</span> triple
        </p>
      </div>
    </div>
  );
}
