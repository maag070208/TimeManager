import { useMemo } from "react";
import {
  ITAlert,
  ITBadget,
  ITCheckbox,
  ITDataTable,
  ITFlex,
  ITInput,
  ITSearchSelect,
  ITText,
} from "@axzydev/axzy_ui_system";
import type { Column } from "@axzydev/axzy_ui_system";
import {
  type AttendanceDayStatus,
  type PeopleAttendanceDay,
  type PeopleAttendanceRow,
} from "@entities/access";
import { punchTime, workedTime } from "@entities/schedule";
import { LuClock, LuFileCheck, LuFileX, LuMapPin, LuTriangleAlert } from "react-icons/lu";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { PeriodPicker } from "@shared/ui/period-picker";
import { PanelCard } from "@shared/ui/panel-card";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";
import type { UseAccessReport } from "../model/useAccessReport";

type BadgeColor = "success" | "warning" | "danger" | "gray" | "info";

/** Zona del navegador mientras llega la del servidor en `summary.range`. */
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Ancho de la columna de días según el periodo. */
const DAYS_COLUMN_WIDTH: Record<"WEEK" | "FORTNIGHT" | "MONTH", number> = {
  WEEK: 260,
  FORTNIGHT: 250,
  MONTH: 380,
};

/** Marcador de cada día: colores de estado con buen contraste en claro y oscuro. */
const DAY_STYLE: Record<AttendanceDayStatus, string> = {
  ATTENDED: "bg-emerald-500 text-white",
  LATE: "bg-amber-400 text-amber-950",
  ABSENCE: "bg-rose-500 text-white",
  REST: "bg-slate-200 text-slate-600",
  PENDING: "border border-slate-300 bg-white text-slate-500",
  NO_INFO: "bg-slate-100 text-slate-400",
};

/** Anillo del día de hoy. */
const TODAY_RING = "ring-2 ring-slate-800 ring-offset-1";

/** Fecha de una clave de día (`YYYY-MM-DD`) con las opciones dadas, sin corrimiento de zona. */
const formatDay = (dayKey: string, options: Intl.DateTimeFormatOptions): string =>
  new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(dateLocale(), { ...options, timeZone: "UTC" });

export default function AccessReportTab({ fx }: { fx: UseAccessReport }) {
  const { t, period, summary, view, setView } = fx;
  const tt = dyn(t);

  const days = summary?.range.days ?? [];
  const today = summary?.range.today;
  const tz = summary?.range.timezone || BROWSER_TIMEZONE;
  const multiDay = period !== "DAY";
  // Día "foco": el de hoy dentro del periodo (o el único día en la vista diaria).
  const focusIndex = !summary ? -1 : period === "DAY" ? 0 : days.indexOf(today ?? "");
  const focusIsToday = focusIndex >= 0 && days[focusIndex] === today;

  const periodLabels = useMemo(
    () => ({
      periods: {
        DAY: t("periodTabs.DAY"),
        WEEK: t("periodTabs.WEEK"),
        FORTNIGHT: t("periodTabs.FORTNIGHT"),
        MONTH: t("periodTabs.MONTH"),
      },
      date: t("filters.date"),
      previous: t("filters.previous"),
      next: t("filters.next"),
    }),
    [t]
  );

  const departmentOptions = useMemo(
    () => [
      { value: "", label: t("filters.allDepartments") },
      ...fx.departments.data.map((d) => ({ value: d.id, label: d.name })),
    ],
    [fx.departments, t]
  );

  /** Texto flotante de un día: "mié 07 oct · Asistió · 07:58–16:10 · 8:12". */
  const dayTooltip = (day: PeopleAttendanceDay): string => {
    const parts = [
      formatDay(day.date, { weekday: "short", day: "2-digit", month: "short" }).replace(/[.,]/g, ""),
      tt(`dayStatus.${day.status}`),
    ];
    if (day.entryAt) {
      parts.push(`${punchTime(day.entryAt, day.date, tz)}–${punchTime(day.exitAt, day.date, tz)}`);
    }
    if (day.workedMinutes > 0) parts.push(workedTime(day.workedMinutes));
    return parts.join(" · ");
  };

  /** Una marca por día del periodo: letra en semana, barra delgada en quincena y mes. */
  const renderDays = (r: PeopleAttendanceRow) => (
    <div className={`flex items-center ${period === "WEEK" ? "gap-1" : "gap-0.5"}`}>
      {r.days.map((day) => (
        <span
          key={day.date}
          title={dayTooltip(day)}
          className={`inline-flex shrink-0 items-center justify-center ${
            period === "WEEK" ? "h-7 w-7 rounded-md text-[11px] font-bold" : "h-5 w-2 rounded-sm"
          } ${DAY_STYLE[day.status]} ${day.date === today ? TODAY_RING : ""}`}
        >
          {period === "WEEK" ? formatDay(day.date, { weekday: "narrow" }).toUpperCase() : null}
        </span>
      ))}
    </div>
  );

  const renderPunch = (iso: string | null | undefined, day: PeopleAttendanceDay | undefined) =>
    iso && day ? (
      <ITText className="text-[12px] font-semibold tabular-nums text-slate-700">
        {punchTime(iso, day.date, tz)}
      </ITText>
    ) : (
      <ITText className="text-[12px] text-slate-300">—</ITText>
    );

  /** Estado del día foco, la primera condición que aplique. */
  const focusState = (r: PeopleAttendanceRow, d: PeopleAttendanceDay): { color: BadgeColor; text: string } => {
    if (d.incident === "ENTRY_WITHOUT_EXIT") return { color: "warning", text: t("state.withoutExit") };
    if (d.incident === "EXIT_WITHOUT_ENTRY") return { color: "danger", text: t("state.withoutEntry") };
    if (d.status === "LATE") return { color: "warning", text: t("state.late", { time: workedTime(d.lateMinutes) }) };
    if (r.onSite) return { color: "success", text: t("state.onSite") };
    switch (d.status) {
      case "ATTENDED":
        return { color: "gray", text: t("state.closed") };
      case "ABSENCE":
        return { color: "danger", text: t("state.absence") };
      case "REST":
        return { color: "gray", text: t("state.rest") };
      case "PENDING":
        return { color: "gray", text: t("state.pending") };
      default:
        return { color: "gray", text: t("state.noInfo") };
    }
  };

  /** Sin día foco (periodos pasados): un badge por cada contador con incidencias. */
  const counterStates = (r: PeopleAttendanceRow): Array<{ color: BadgeColor; text: string }> => {
    const list: Array<{ color: BadgeColor; text: string }> = [];
    if (r.absences > 0) list.push({ color: "danger", text: t("counts.absences", { count: r.absences }) });
    if (r.lateDays > 0) list.push({ color: "warning", text: t("counts.late", { count: r.lateDays }) });
    if (r.withoutExit > 0) list.push({ color: "warning", text: t("counts.withoutExit", { count: r.withoutExit }) });
    if (r.withoutEntry > 0) list.push({ color: "danger", text: t("counts.withoutEntry", { count: r.withoutEntry }) });
    if (list.length > 0) return list;
    return r.hasRecords
      ? [{ color: "success", text: t("state.noIncidents") }]
      : [{ color: "gray", text: t("state.noRecords") }];
  };

  const renderState = (r: PeopleAttendanceRow) => {
    const focusDay = focusIndex >= 0 ? r.days[focusIndex] : undefined;
    const badges = focusDay ? [focusState(r, focusDay)] : counterStates(r);
    return (
      <ITFlex wrap="wrap" gap={1}>
        {badges.map((b) => (
          <ITBadget key={b.text} color={b.color} size="sm">
            {b.text}
          </ITBadget>
        ))}
      </ITFlex>
    );
  };

  const columns: Column<PeopleAttendanceRow>[] = [
    {
      key: "employeeName",
      label: t("columns.employee"),
      type: "string",
      width: 300,
      sortable: false,
      render: (r) => {
        const subtitle = [
          r.employeeNumber ? `#${r.employeeNumber}` : null,
          r.departmentName ?? t("noDepartment"),
          r.jobTitle,
          !r.active ? t("status.inactive") : null,
          !r.linked ? t("unlinked") : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <ITFlex align="center" gap={3}>
            <ProfileAvatar
              name={r.employeeName}
              size="md"
            />
            <ITFlex className="min-w-0">
              <ITText className="truncate text-[13px] font-bold text-slate-800">{r.employeeName}</ITText>
              <ITText className="truncate text-[11px] text-slate-500">{subtitle}</ITText>
            </ITFlex>
          </ITFlex>
        );
      },
    },
    ...(multiDay
      ? [
          {
            key: "days",
            label: dyn(t)(`dayColumn.${period}`),
            type: "string" as const,
            width: DAYS_COLUMN_WIDTH[period as "WEEK" | "FORTNIGHT" | "MONTH"],
            sortable: false,
            render: renderDays,
          },
        ]
      : []),
    ...(focusIndex >= 0
      ? [
          {
            key: "focusEntry",
            label: focusIsToday ? t("focus.entryToday") : t("focus.entry"),
            type: "string" as const,
            width: 100,
            sortable: false,
            render: (r: PeopleAttendanceRow) => renderPunch(r.days[focusIndex]?.entryAt, r.days[focusIndex]),
          },
          {
            key: "focusExit",
            label: focusIsToday ? t("focus.exitToday") : t("focus.exit"),
            type: "string" as const,
            width: 100,
            sortable: false,
            render: (r: PeopleAttendanceRow) => renderPunch(r.days[focusIndex]?.exitAt, r.days[focusIndex]),
          },
        ]
      : []),
    {
      key: "workedMinutes",
      label: t("columns.hours"),
      type: "number",
      width: 90,
      sortable: false,
      render: (r) => (
        <ITText className="text-[12px] font-bold tabular-nums text-slate-700">
          {r.workedMinutes > 0 ? workedTime(r.workedMinutes) : "—"}
        </ITText>
      ),
    },
    {
      key: "state",
      label: t("columns.status"),
      type: "string",
      width: 80,
      sortable: false,
      render: renderState,
    },
  ];

  // Indicadores del periodo (sobre todas las personas del filtro, no solo la página).
  const people = summary?.people ?? 0;
  const withRecords = summary?.withRecords ?? 0;
  const withoutRecords = summary?.withoutRecords ?? 0;
  const workedMinutes = summary?.workedMinutes ?? 0;
  const hoursValue = `${Math.floor(workedMinutes / 60).toLocaleString(dateLocale())}:${String(
    workedMinutes % 60
  ).padStart(2, "0")}`;

  const incidentParts: string[] = [];
  const lateDays = summary?.lateDays ?? 0;
  const absences = summary?.absences ?? 0;
  const withoutExit = summary?.withoutExit ?? 0;
  const withoutEntry = summary?.withoutEntry ?? 0;
  if (lateDays > 0) incidentParts.push(t("counts.late", { count: lateDays }));
  if (absences > 0) incidentParts.push(t("counts.absences", { count: absences }));
  if (withoutExit > 0) incidentParts.push(t("counts.withoutExit", { count: withoutExit }));
  if (withoutEntry > 0) incidentParts.push(t("counts.withoutEntry", { count: withoutEntry }));
  const incidentsTotal = lateDays + absences + withoutExit + withoutEntry;

  return (
    <ITFlex direction="column" gap={4}>
      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}

      {/* Cifras del periodo como filtros bento: cada tarjeta aplica su vista. */}
      <BentoFilterCards
        items={[
          {
            id: "onSite",
            label: t("tiles.onSite"),
            value: summary?.onSite ?? 0,
            caption: t("tiles.onSiteHint"),
            icon: <LuMapPin size={14} />,
          },
          {
            id: "withRecords",
            label: t("tiles.withRecords"),
            value: withRecords,
            caption: t("tiles.ofTotal", { total: people }),
            icon: <LuFileCheck size={14} />,
          },
          {
            id: "withoutRecords",
            label: t("tiles.withoutRecords"),
            value: withoutRecords,
            caption: withoutRecords > 0 ? t("tiles.viewWho") : t("tiles.allRecorded"),
            icon: <LuFileX size={14} />,
          },
          {
            id: "hours",
            label: t("tiles.hours"),
            value: hoursValue,
            caption: t("tiles.hoursHint"),
            icon: <LuClock size={14} />,
          },
          {
            id: "incidents",
            label: t("tiles.incidents"),
            value: incidentsTotal,
            caption: incidentsTotal > 0 ? incidentParts.join(" · ") : t("tiles.allClear"),
            icon: <LuTriangleAlert size={14} />,
          },
        ]}
        activeId={view === "ON_SITE" ? "onSite" : view === "WITHOUT_RECORDS" ? "withoutRecords" : view === "INCIDENTS" ? "incidents" : "withRecords"}
        onSelect={(id: string) =>
          setView(
            id === "onSite" ? "ON_SITE" : id === "withoutRecords" ? "WITHOUT_RECORDS" : id === "incidents" ? "INCIDENTS" : "ALL"
          )
        }
      />

      {/* Una sola tarjeta: filtros del periodo arriba y la tabla debajo. */}
      <PanelCard title={t("table.title", { count: fx.total })}>
        <ITFlex direction="column" gap={4} className="pb-4">
          <ITFlex align="end" wrap="wrap" gap={3}>
            <PeriodPicker
              name="accessReport"
              period={period}
              onPeriodChange={fx.changePeriod}
              date={fx.date}
              range={fx.periodRange}
              onDateChange={fx.setDate}
              onPrevious={fx.previousPeriod}
              onNext={fx.nextPeriod}
              labels={periodLabels}
            />
            <ITFlex className="min-w-[200px] flex-1">
              <ITSearchSelect
                name="accessReportDepartment"
                label={t("filters.department")}
                options={departmentOptions}
                value={fx.departmentId}
                onChange={(value) => fx.setDepartmentId(String(value))}
                className="w-full min-w-0"
              />
            </ITFlex>
            <ITFlex className="min-w-[220px] flex-1">
              <ITInput
                name="accessReportEmployee"
                label={t("filters.employee")}
                placeholder={t("filters.employeePlaceholder")}
                value={fx.search}
                onChange={(e) => fx.setSearch(e.target.value)}
                className="w-full min-w-0"
              />
            </ITFlex>
            <ITCheckbox
              name="accessReportIncludeInactive"
              label={t("filters.includeInactive")}
              checked={fx.includeInactive}
              onChange={fx.setIncludeInactive}
            />
          </ITFlex>
        </ITFlex>

        <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
          key={fx.tableKey}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          fetchData={
            fx.fetchTableData as unknown as (
              p: Parameters<typeof fx.fetchTableData>[0]
            ) => Promise<{ data: Record<string, unknown>[]; total: number }>
          }
          externalFilters={fx.externalFilters}
        />

        {multiDay && (
          <ITFlex wrap="wrap" align="center" gap={4} className="mt-4">
            <LegendSwatch style={DAY_STYLE.ATTENDED} label={tt("dayStatus.ATTENDED")} />
            <LegendSwatch style={DAY_STYLE.LATE} label={tt("dayStatus.LATE")} />
            <LegendSwatch style={DAY_STYLE.ABSENCE} label={tt("dayStatus.ABSENCE")} />
            <LegendSwatch style={DAY_STYLE.PENDING} label={t("legend.neutral")} />
          </ITFlex>
        )}
      </PanelCard>
    </ITFlex>
  );
}

/** Muestra de la simbología, con el mismo estilo que la marca de un día. */
function LegendSwatch({ style, label }: { style: string; label: string }) {
  return (
    <ITFlex align="center" gap={1.5}>
      <span className={`h-3.5 w-3.5 shrink-0 rounded-md ${style}`} />
      <ITText className="text-[11px] text-slate-500">{label}</ITText>
    </ITFlex>
  );
}
