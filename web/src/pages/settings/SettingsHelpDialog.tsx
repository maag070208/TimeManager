import { ITButton, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuCalendarDays, LuCircleHelp, LuClock, LuShieldCheck } from "react-icons/lu";

export type SettingsTab = "operation" | "attendance" | "limits" | "checks";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tab: SettingsTab;
}

const CONTENT: Record<SettingsTab, {
  icon: React.ReactNode;
  title: string;
  what: string;
  example: string;
  note: string;
  tone: string;
}> = {
  operation: {
    icon: <LuCalendarDays size={18} />,
    title: "Operación",
    what: "Define el primer día de la semana con el que se agrupan horarios, asistencia, tiempo extra, pre-nómina y reportes. La zona horaria la asigna el cliente y solo se consulta aquí.",
    example: "Si eliges miércoles, la semana corre de miércoles a martes en todos los cálculos y reportes.",
    note: "Cambiarlo no mueve registros ya guardados; aplica a los cálculos y agrupaciones nuevas.",
    tone: "mint",
  },
  attendance: {
    icon: <LuClock size={18} />,
    title: "Asistencia",
    what: "Son los valores que se proponen al crear un horario nuevo: tolerancia de entrada, tolerancia de salida, duración de la comida y mínimo de tiempo extra.",
    example: "Con tolerancia de 10 min y entrada a las 9:00, checar a las 9:08 no marca retardo; a las 9:12 sí.",
    note: "Solo aplica a horarios nuevos. Los horarios que ya existen conservan sus propios valores.",
    tone: "sky",
  },
  limits: {
    icon: <LuShieldCheck size={18} />,
    title: "Límites y retención",
    what: "Los topes diario y semanal se validan contra la ley: solo puedes ser igual o más estricto. La retención indica cuántos meses se guardan los registros antes de moverlos al archivo legal.",
    example: "Con retención de 24 meses, los registros de hace 25 meses se archivan; no se borran.",
    note: "Archivar conserva la evidencia y queda auditado. Nunca elimines registros desde aquí.",
    tone: "amber",
  },
  checks: {
    icon: <LuShieldCheck size={18} />,
    title: "Checada web",
    what: "Controla si el personal puede checar desde navegador o app, si esa checada cuenta como jornada y si debe aceptar el acuerdo de método antes de usarla.",
    example: "Si bloqueas sin acuerdo, quien no lo haya aceptado no podrá checar desde la web; el reloj físico sigue disponible.",
    note: "Estas opciones no desactivan los relojes físicos ni sus checadas.",
    tone: "lavender",
  },
};

/** Ayuda contextual de Configuración: solo la sección activa y un ejemplo concreto. */
export default function SettingsHelpDialog({ isOpen, onClose, tab }: Props) {
  const content = CONTENT[tab];
  return (
    <ITDialog isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <ITFlex align="center" gap={2}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <LuCircleHelp size={20} />
        </span>
        <div>
          <ITText as="h2" className="m-0 !text-[18px] font-extrabold !text-slate-900">Ayuda · {content.title}</ITText>
          <ITText muted className="!text-[12px]">Solo lo que necesitas de esta sección.</ITText>
        </div>
      </ITFlex>

      <div className={`tm-hero-card tm-hero-card--${content.tone} mt-4 rounded-2xl p-4`}>
        <ITFlex align="center" gap={2}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-slate-700">{content.icon}</span>
          <ITText className="font-bold !text-[13px] !text-slate-800">{content.title}</ITText>
        </ITFlex>
        <ITText className="mt-2 block !text-[13px] leading-relaxed text-slate-700">{content.what}</ITText>
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 bg-white p-4">
        <ITText className="!text-[10.5px] font-bold uppercase tracking-[0.08em] !text-slate-400">Ejemplo</ITText>
        <ITText className="mt-1.5 block !text-[13px] leading-relaxed text-slate-700">{content.example}</ITText>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
        <ITText className="!text-[12px] leading-relaxed text-slate-500">{content.note}</ITText>
      </div>

      <ITFlex justify="end" className="mt-4">
        <ITButton variant="filled" color="primary" className="tm-save-button" onClick={onClose}>Entendido</ITButton>
      </ITFlex>
    </ITDialog>
  );
}
