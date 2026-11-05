import { useState } from "react";
import { ITPage, ITText } from "@axzydev/axzy_ui_system";
import { FaMoneyCheckAlt } from "react-icons/fa";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PayrollHistoryPanel, useWeeklyAttendance, WeeklyAttendancePanel } from "@features/schedule";
import { downloadPayrollClosurePdf, downloadWeeklyAttendancePdf } from "@widgets/reports";
import { useGoBack } from "@shared/lib/useGoBack";
import { dateLocale } from "@shared/i18n";

/** Mes corto sin el punto que agrega el locale ("nov." → "nov"). */
const shortMonth = (d: Date) => d.toLocaleDateString(dateLocale(), { month: "short" }).replace(/\./g, "");
/** Día de la semana corto sin punto ("mié." → "mié"). */
const shortWeekday = (d: Date) =>
  d.toLocaleDateString(dateLocale(), { weekday: "short" }).replace(/\./g, "");

/** "mié 4 – mar 10 nov" (mismo mes) o "jue 29 oct – mié 4 nov" (mes distinto). */
const weekRangeLabel = ([start, end]: [Date, Date]): string =>
  start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${shortWeekday(start)} ${start.getDate()} – ${shortWeekday(end)} ${end.getDate()} ${shortMonth(end)}`
    : `${shortWeekday(start)} ${start.getDate()} ${shortMonth(start)} – ${shortWeekday(end)} ${end.getDate()} ${shortMonth(end)}`;

/**
 * Nómina: el reporte semanal de asistencia (entradas, salidas, horas y tiempo
 * extra) por departamento, para el control de RH. La pantalla vive en Recursos
 * Humanos y se protege con `payroll.view`. La semana se cambia con las
 * flechas de la píldora del encabezado.
 */
export default function PayrollPage() {
  const { t } = useTranslation(["weekly-attendance", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useWeeklyAttendance({ downloadPdf: downloadWeeklyAttendancePdf });
  /** Pestaña activa: la semana (cierre) o el historial de semanas cerradas. */
  const [tab, setTab] = useState<"week" | "history">("week");

  const weekLabel = t("weekPill", { range: weekRangeLabel(fx.rangeValue) });

  const weekNav = (
    <div
      className="flex items-center gap-1 rounded-full border px-1.5 py-1"
      style={{ background: "var(--it-card-bg, #ffffff)", borderColor: "var(--it-card-border, #e2e8f0)" }}
    >
      <button
        type="button"
        onClick={fx.previousWeek}
        title={t("filters.previousWeek")}
        aria-label={t("filters.previousWeek")}
        className="flex cursor-pointer items-center rounded-full !border-0 !bg-transparent p-1.5 text-slate-500 hover:bg-slate-100"
      >
        <LuChevronLeft size={18} />
      </button>
      <ITText className="px-1.5 !text-[15px] font-extrabold tracking-tight whitespace-nowrap sm:!text-[16px]">{weekLabel}</ITText>
      <button
        type="button"
        onClick={fx.nextWeek}
        title={t("filters.nextWeek")}
        aria-label={t("filters.nextWeek")}
        className="flex cursor-pointer items-center rounded-full !border-0 !bg-transparent p-1.5 text-slate-500 hover:bg-slate-100"
      >
        <LuChevronRight size={18} />
      </button>
    </div>
  );

  const tabSwitcher = (
    <div
      className="flex w-fit items-center gap-0.5 rounded-full border p-0.5"
      style={{ background: "var(--it-card-bg, #ffffff)", borderColor: "var(--it-card-border, #e2e8f0)" }}
      role="tablist"
    >
      {(["week", "history"] as const).map((id) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(id)}
            className={`cursor-pointer rounded-full !border-0 px-3.5 py-1.5 !text-[12px] font-bold transition ${
              active ? "text-white" : "!bg-transparent text-slate-500 hover:text-slate-700"
            }`}
            style={active ? { background: "var(--color-primary-900)" } : undefined}
          >
            {t(`tabs.${id}`)}
          </button>
        );
      })}
    </div>
  );

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={t("title")}
      description={`${weekLabel} · ${t("description")}`}
      icon={<FaMoneyCheckAlt size={20} />}
      noPadding
      horizontalPadding={"px-0"}
      maxWidth="7xl"
      actions={tab === "week" ? weekNav : undefined}
      breadcrumbs={[
        { label: t("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: t("common:nav.hr"), onClick: () => navigate("/employees") },
        { label: t("title") },
      ]}
      backAction={() => goBack("/employees")}
    >
      <div className="mb-4">{tabSwitcher}</div>
      {tab === "week" ? <WeeklyAttendancePanel fx={fx} /> : <PayrollHistoryPanel t={t} downloadPdf={downloadPayrollClosurePdf} />}
    </ITPage>
  );
}
