import { ITButton, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuCalendarDays, LuCircleHelp, LuClock, LuShieldCheck } from "react-icons/lu";
import { Link } from "react-router-dom";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    icon: <LuCalendarDays size={17} />,
    title: "Operación",
    text: "Define el primer día de la semana con el que se agrupan horarios, asistencia, tiempo extra, pre-nómina y reportes. La zona horaria la asigna el cliente y no se edita aquí.",
  },
  {
    icon: <LuClock size={17} />,
    title: "Asistencia",
    text: "Son los valores propuestos al crear un horario nuevo: tolerancia de entrada, tolerancia de salida, duración de la comida y mínimo de tiempo extra. Cambiarlos no modifica horarios que ya existen.",
  },
  {
    icon: <LuShieldCheck size={17} />,
    title: "Límites y retención",
    text: "Los topes diario y semanal solo pueden ser iguales o más estrictos que la ley. La retención indica cuántos meses se guardan los registros antes de moverlos al archivo legal; archivar no borra evidencia.",
  },
  {
    icon: <LuShieldCheck size={17} />,
    title: "Checada web",
    text: "Decide si el personal puede checar desde navegador o app, si esa checada cuenta como jornada y si se exige aceptar el acuerdo de método. Un convenio colectivo puede requerir firma del sindicato.",
  },
];

/** Ayuda contextual de Configuración del sistema, en lenguaje para el administrador del cliente. */
export default function SettingsHelpDialog({ isOpen, onClose }: Props) {
  return (
    <ITDialog isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <ITFlex align="center" gap={2}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <LuCircleHelp size={20} />
        </span>
        <div>
          <ITText as="h2" className="m-0 !text-[18px] font-extrabold !text-slate-900">Ayuda de configuración</ITText>
          <ITText muted className="!text-[12px]">Qué hace cada sección y cuándo usarla.</ITText>
        </div>
      </ITFlex>

      <div className="mt-4 flex max-h-[65vh] flex-col gap-2.5 overflow-y-auto pr-1">
        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-xl border border-slate-100 bg-white p-3.5">
            <ITFlex align="center" gap={2}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600">{section.icon}</span>
              <ITText className="font-bold !text-[13px] !text-slate-800">{section.title}</ITText>
            </ITFlex>
            <ITText className="mt-1.5 block !text-[12.5px] leading-relaxed text-slate-600">{section.text}</ITText>
          </div>
        ))}

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
          <ITText className="font-bold !text-[13px] !text-emerald-900">Catálogos</ITText>
          <ITText className="mt-1 block !text-[12.5px] text-emerald-900/80">
            Los tipos de permiso, documentos y demás datos maestros no se editan aquí: viven en Catálogos para que todos se administren en un solo lugar.
          </ITText>
          <Link to="/settings/catalogs" onClick={onClose} className="mt-2 inline-block text-[12px] font-bold underline underline-offset-4">
            Abrir Catálogos →
          </Link>
        </div>

        <ITText muted className="!text-[11.5px]">
          Los cambios se aplican al pulsar “Guardar configuración”. Si algo no lo tienes claro, pregunta a tu administrador de plataforma antes de cambiar límites legales.
        </ITText>
      </div>

      <ITFlex justify="end" className="mt-4">
        <ITButton variant="filled" color="primary" className="tm-save-button" onClick={onClose}>Entendido</ITButton>
      </ITFlex>
    </ITDialog>
  );
}
