import { ITPage, ITText } from "@axzydev/axzy_ui_system";
import { FaRegClock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScheduleForm } from "@features/schedule";
import { useGoBack } from "@shared/lib/useGoBack";
import { HelpTip } from "@shared/ui/help-tip";

export default function ScheduleFormPage() {
  const { t } = useTranslation(["schedules", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={isEdit ? t("edit") : t("new")}
      icon={<FaRegClock size={20} />}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("title"), onClick: () => navigate("/schedules") },
        { label: isEdit ? t("edit") : t("new") },
      ]}
      backAction={() => goBack("/schedules")}
    >
      <div className="flex flex-col gap-4">
        <div className="tm-hero-card rounded-2xl px-5 py-4 text-slate-900">
          <span className="flex items-center gap-1.5">
            <ITText className="!text-[11px] font-semibold uppercase tracking-[0.08em] !text-slate-500">
              Reglas de jornada
            </ITText>
            <HelpTip text="Tolerancias: minutos de gracia en la entrada y la salida antes de marcar retardo o salida anticipada. Mínimo de horas extra: solo el tiempo trabajado de más que supera ese mínimo cuenta como extra (0 = sin mínimo). La comida se descuenta de la jornada." />
          </span>
          <ITText className="!text-2xl font-extrabold !text-slate-900">
            Entrada, salida, tolerancias y horas extra
          </ITText>
          <ITText className="!text-[12px] !text-slate-600">
            Este horario es la regla con la que se calculan retardos, faltas, prenómina y tiempo extra del personal que lo tenga asignado.
          </ITText>
        </div>

        <ScheduleForm id={id} />
      </div>
    </ITPage>
  );
}
