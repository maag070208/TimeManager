import { ITButton, ITCard, ITDatePicker, ITFlex, ITInput, ITSearchSelect, ITText } from "@axzydev/axzy_ui_system";
import { LuChevronLeft, LuChevronRight, LuFileSpreadsheet, LuFileText } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { UseWeeklyAttendance } from "../model/useWeeklyAttendance";

/**
 * Filtros rápidos de la pre-nómina (semana, departamento y búsqueda de la
 * persona), en la esquina superior derecha del encabezado para no tener que
 * bajar hasta la tarjeta del reporte.
 */
export default function WeeklyAttendanceFilters({ fx }: { fx: UseWeeklyAttendance }) {
  const { t } = useTranslation("weekly-attendance");

  const handleRange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: Date | [Date | null, Date | null] } },
  ) => {
    const value = e.target.value;
    if (Array.isArray(value) && value[0]) fx.setWeekDate(value[0]);
  };

  return (
    <ITCard contentClassName="!p-3" className="bento-rise">
      <ITFlex align="end" wrap="wrap" gap={2.5} className="justify-end">
      <ITFlex align="end" gap={1} className="min-w-[280px] flex-[1.3]">
        <ITButton
          variant="outlined"
          color="secondary"
          size="sm"
          onClick={fx.previousWeek}
          title={t("filters.previousWeek")}
          aria-label={t("filters.previousWeek")}
        >
          <LuChevronLeft size={13} />
        </ITButton>
        <ITFlex className="min-w-0 flex-1">
          <ITDatePicker
            name="weeklyAttendanceWeek"
            label={t("filters.week")}
            range
            value={fx.rangeValue}
            onChange={handleRange}
            className="w-full min-w-0"
          />
        </ITFlex>
        <ITButton
          variant="outlined"
          color="secondary"
          size="sm"
          onClick={fx.nextWeek}
          title={t("filters.nextWeek")}
          aria-label={t("filters.nextWeek")}
        >
          <LuChevronRight size={13} />
        </ITButton>
      </ITFlex>

      <ITFlex className="min-w-[190px] flex-1">
        <ITSearchSelect
          name="weeklyAttendanceDepartment"
          label={t("filters.department")}
          options={[
            { value: "", label: t("filters.allDepartments") },
            ...fx.departments.data.map((department) => ({ value: department.id, label: department.name })),
          ]}
          value={fx.departmentId}
          onChange={(value) => fx.setDepartmentId(String(value))}
          className="w-full min-w-0"
        />
      </ITFlex>

      <ITFlex className="min-w-[170px] flex-1">
        <ITInput
          name="weeklyAttendanceSearch"
          label={t("filters.search")}
          placeholder={t("filters.searchPlaceholder")}
          value={fx.search}
          onChange={(e) => fx.setSearch(e.target.value)}
          className="w-full min-w-0"
        />
      </ITFlex>

      <ITFlex align="center" gap={2} className="shrink-0">
        <ITButton
          variant="filled"
          color="primary"
          size="sm"
          onClick={fx.exportPdf}
          disabled={fx.exporting || !fx.report || fx.report.rows.length === 0}
        >
          <ITFlex align="center" gap={1}>
            <LuFileText size={13} className="text-white" />
            <ITText as="span" className="text-[11px] font-bold !text-white">
              {fx.exporting ? t("exporting") : t("actionsBar.exportPdf")}
            </ITText>
          </ITFlex>
        </ITButton>
        <ITButton
          variant="filled"
          color="success"
          size="sm"
          onClick={fx.exportExcel}
          disabled={!fx.report || fx.report.rows.length === 0}
        >
          <ITFlex align="center" gap={1}>
            <LuFileSpreadsheet size={13} className="text-slate-900" />
            <ITText as="span" className="text-[11px] font-bold !text-slate-900">
              {t("actionsBar.exportExcel")}
            </ITText>
          </ITFlex>
        </ITButton>
      </ITFlex>
      </ITFlex>
    </ITCard>
  );
}
