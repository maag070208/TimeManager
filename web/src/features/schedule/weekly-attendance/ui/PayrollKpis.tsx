import { ITButton, ITText } from "@axzydev/axzy_ui_system";
import { LuArrowRight, LuBadgeCheck, LuClock, LuTriangleAlert, LuUsers } from "react-icons/lu";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";

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
 * Las cifras de la semana en el mosaico bento (tarjetas blancas con olas):
 * personas con checadas, horas trabajadas, horas extra aprobadas y faltas sin
 * justificar. La salida a Asistencia queda como acción de texto debajo.
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
    <div className="flex flex-col gap-2">
      <BentoKpiGrid
        items={[
          {
            id: "people",
            label: labels.people,
            value: linked,
            caption: labels.peopleCaption,
            tone: "info",
            icon: <LuUsers size={14} />,
          },
          {
            id: "worked",
            label: labels.worked,
            value: workedHours,
            caption: labels.workedCaption,
            icon: <LuClock size={14} />,
          },
          {
            id: "approved",
            label: labels.approved,
            value: approvedHours,
            caption: labels.approvedCaption,
            tone: "success",
            icon: <LuBadgeCheck size={14} />,
          },
          {
            id: "absences",
            label: labels.absences,
            value: absences,
            caption: labels.goToAttendance,
            tone: absences > 0 ? "danger" : "neutral",
            icon: <LuTriangleAlert size={14} />,
          },
        ]}
      />
      <ITButton variant="text" color="danger" size="sm" className="tm-row-button self-start" onClick={onGoToAttendance}>
        <ITText as="span" className="flex items-center gap-1 text-[11.5px] font-bold">
          {labels.goToAttendance}
          <LuArrowRight size={12} />
        </ITText>
      </ITButton>
    </div>
  );
}
