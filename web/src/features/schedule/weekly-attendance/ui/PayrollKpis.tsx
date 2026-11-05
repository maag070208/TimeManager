import type { ReactNode } from "react";
import { ITText } from "@axzydev/axzy_ui_system";
import { LuArrowRight } from "react-icons/lu";
import { Num } from "@shared/ui/bento-bits";

interface Props {
  /** Personas vinculadas al reloj (las que pueden tener checadas). */
  linked: number;
  workedHours: string;
  approvedHours: string;
  absences: number;
  labels: {
    people: string;
    /** Ya interpolado: "de 160 con reloj". */
    peopleCaption: string;
    worked: string;
    workedCaption: string;
    approved: string;
    /** Ya interpolado: "6.50 h por aprobar". */
    approvedCaption: string;
    absences: string;
    goToAttendance: string;
  };
  onGoToAttendance: () => void;
}

/**
 * Las cifras de la semana: personas con checadas (tarjeta en tinta), horas
 * trabajadas, horas extra aprobadas y faltas sin justificar (con salida a
 * Asistencia). Una fila de cuatro tarjetas, como el tablero del mockup.
 */
export default function PayrollKpis({
  linked,
  workedHours,
  approvedHours,
  absences,
  labels,
  onGoToAttendance,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[14px] px-4 py-3.5" style={{ background: "var(--color-primary-900)" }}>
        <ITText className="block !text-[12px] font-semibold !text-white/75">{labels.people}</ITText>
        <ITText className="mt-1 block !text-[26px] font-extrabold leading-none tabular-nums !text-white">
          <Num value={linked} />
        </ITText>
        <ITText className="mt-1.5 block !text-[11.5px] !text-white/60">{labels.peopleCaption}</ITText>
      </div>

      <KpiCard label={labels.worked} value={workedHours} caption={labels.workedCaption} />
      <KpiCard label={labels.approved} value={approvedHours} caption={labels.approvedCaption} />

      <div
        className="rounded-[14px] px-4 py-3.5"
        style={{ background: "var(--it-card-bg, #ffffff)", boxShadow: "0 1px 2px rgb(15 23 42 / 0.06)" }}
      >
        <ITText muted className="block !text-[12px] font-semibold">
          {labels.absences}
        </ITText>
        <ITText
          className="mt-1 block !text-[26px] font-extrabold leading-none tabular-nums"
          style={{ color: absences > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}
        >
          <Num value={absences} />
        </ITText>
        <button
          type="button"
          onClick={onGoToAttendance}
          className="mt-1.5 flex cursor-pointer items-center gap-1 !border-0 !bg-transparent !p-0 !text-[11.5px] font-bold text-[color:var(--color-danger)] hover:underline"
        >
          {labels.goToAttendance}
          <LuArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <div
      className="rounded-[14px] px-4 py-3.5"
      style={{ background: "var(--it-card-bg, #ffffff)", boxShadow: "0 1px 2px rgb(15 23 42 / 0.06)" }}
    >
      <ITText muted className="block !text-[12px] font-semibold">
        {label}
      </ITText>
      <ITText className="mt-1 block !text-[26px] font-extrabold leading-none tabular-nums text-slate-900">{value}</ITText>
      <ITText muted className="mt-1.5 block !text-[11.5px]">
        {caption}
      </ITText>
    </div>
  );
}
