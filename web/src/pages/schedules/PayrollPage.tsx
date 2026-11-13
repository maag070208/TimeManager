import { ITPage } from "@shared/ui/page";
import { FaMoneyCheckAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWeeklyAttendance, WeeklyAttendanceFilters, WeeklyAttendancePanel } from "@features/schedule";
import { downloadWeeklyAttendancePdf } from "@widgets/reports";
import { useGoBack } from "@shared/lib/useGoBack";

/**
 * Nómina: el reporte semanal de asistencia (entradas, salidas, horas y tiempo
 * extra) por departamento, para el control de RH. La pantalla vive en Recursos
 * Humanos y se protege con `payroll.view`. Los filtros rápidos (semana,
 * departamento y búsqueda) van en el encabezado; las cifras y la tabla, debajo.
 */
export default function PayrollPage() {
  const { t } = useTranslation(["weekly-attendance", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useWeeklyAttendance({ downloadPdf: downloadWeeklyAttendancePdf });

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={t("title")}
      description={t("description")}
      icon={<FaMoneyCheckAlt size={20} />}
      noPadding
      horizontalPadding={"px-0"}
      maxWidth="7xl"
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.hr"), onClick: () => navigate("/employees") },
        { label: t("title") },
      ]}
      backAction={() => goBack("/employees")}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <WeeklyAttendanceFilters fx={fx} />
      </div>
      <WeeklyAttendancePanel fx={fx} />
    </ITPage>
  );
}
