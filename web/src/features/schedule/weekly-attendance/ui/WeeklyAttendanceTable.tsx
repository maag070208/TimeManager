import { useMemo } from "react";
import { ITBadget, ITDataTable, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import type { Column, ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import type { TFunction } from "i18next";
import {
  buildDetailRows,
  WEEKLY_APPROVAL_BADGE,
  WEEKLY_MERGED_STATUSES,
  WEEKLY_STATUS_BADGE,
  dayLabel,
  hoursDecimal,
  punchTime,
  type WeeklyAttendanceDayStatus,
  type WeeklyAttendanceDetailRow,
  type WeeklyAttendanceReport,
  type WeeklyAttendanceRow,
} from "@entities/schedule";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";
import { detailFields, summaryFields } from "../model/fields";
import type { WeeklyAttendanceMode } from "../model/useWeeklyAttendance";

interface Props {
  report: WeeklyAttendanceReport;
  mode: WeeklyAttendanceMode;
  /** Con un departamento elegido no se repite en el subtexto de la persona. */
  groupByDepartment: boolean;
  t: TFunction<any>;
  /**
   * Filtros/orden vigentes de la tabla (barra + columnas + orden). Los usa el
   * export para generar el PDF con lo mismo que se ve.
   */
  onParamsChange?: (params: ITDataTableFetchParams) => void;
  /** Cambia cuando llega un reporte nuevo: obliga a la tabla client-side a re-pedir datos. */
  reloadTrigger: number;
  /** Firma de los filtros de la barra: reinicia página y filtros de columna. */
  queryKey: string;
}

const STATUSES: WeeklyAttendanceDayStatus[] = [
  "WORKED",
  "OVERTIME",
  "ABSENCE",
  "INCOMPLETE",
  "REST",
  "REST_WORKED",
  "NO_INFO",
  "FUTURE",
];

const employeeCell = (name: string, sub: string) => (
  <ITFlex align="center" gap={2}>
    <ProfileAvatar name={name} size="sm" />
    <ITFlex direction="column" gap={0} className="min-w-0">
      <ITText className="truncate text-[12px] font-black text-slate-800">{name}</ITText>
      <ITText className="truncate text-[12px] font-bold text-slate-400">{sub}</ITText>
    </ITFlex>
  </ITFlex>
);

const num = (value: string, strong = false) => (
  <ITText className={strong ? "text-[12px] font-black text-emerald-700" : "text-[12px] font-bold text-slate-700"}>
    {value}
  </ITText>
);

/** "Miércoles 23": día de la semana completo + número, en el idioma de la interfaz. */
const dayTitle = (dayKey: string): string => {
  const label = new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(dateLocale(), {
    weekday: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * Tabla del reporte de Nómina. Dos vistas con la misma tabla del sistema
 * (`ITDataTable`, filtros y orden por columna, virtualizada):
 * - RESUMIDA: una fila por persona con los totales de la semana.
 * - DETALLADA: una fila por persona y día (entrada/salida, horas, tiempo extra).
 * Los estados se muestran con `ITBadget` (colores de la librería, no fondos).
 */
export default function WeeklyAttendanceTable({
  report,
  mode,
  groupByDepartment,
  t: translate,
  onParamsChange,
  reloadTrigger,
  queryKey,
}: Props) {
  const t = dyn(translate);
  const { timezone } = report.range;

  const detailRows = useMemo(() => buildDetailRows(report), [report]);

  const summaryFetch = useMemo(() => {
    const fetch = makeClientTableFetch<WeeklyAttendanceRow>(() => Promise.resolve(report.rows), summaryFields);
    return (params: ITDataTableFetchParams) => {
      onParamsChange?.(params);
      return fetch(params);
    };
  }, [report, onParamsChange]);

  const detailFetch = useMemo(() => {
    const fetch = makeClientTableFetch<WeeklyAttendanceDetailRow>(
      () => Promise.resolve(detailRows),
      detailFields
    );
    return (params: ITDataTableFetchParams) => {
      onParamsChange?.(params);
      return fetch(params);
    };
  }, [detailRows, onParamsChange]);

  const subOf = (clock: string, departmentName: string | null) =>
    groupByDepartment && departmentName ? `${clock} · ${departmentName}` : clock;

  const summaryColumns: Column<WeeklyAttendanceRow>[] = [
    {
      key: "name",
      label: t("columns.employee"),
      type: "string",
      width: 230,
      sortable: false,
      render: (r) =>
        employeeCell(
          r.name,
          `${subOf(r.clockNumbers.join(", ") || r.employeeNumber || "—", r.departmentName)}${
            !r.linked ? ` · ${t("unlinked")}` : ""
          }`
        ),
    },
    // Una columna por día de la semana: el rango horario (entrada–salida).
    ...report.range.days.map((dayKey, i) => ({
      key: `day:${dayKey}`,
      label: dayTitle(dayKey),
      type: "string" as const,
      width: 100,
      sortable: false,
      render: (r: WeeklyAttendanceRow) => {
        const day = r.days[i];
        if (!day || day.status === "FUTURE") {
          return <ITText className="text-[11px] text-slate-300">—</ITText>;
        }
        if (WEEKLY_MERGED_STATUSES.includes(day.status)) {
          return (
            <ITBadget color={WEEKLY_STATUS_BADGE[day.status]} size="sm">
              {t(`statusShort.${day.status}`)}
            </ITBadget>
          );
        }
        const entry = day.entryAt ? punchTime(day.entryAt, day.date, timezone) : null;
        const exit = day.exitAt ? punchTime(day.exitAt, day.date, timezone) : null;
        const missingExit = !!entry && !exit;
        const missingEntry = !entry && !!exit;
        return (
          <ITFlex direction="column" gap={0}>
            <ITText className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
              {entry ?? "?"} - {exit ?? "?"}
            </ITText>
            {(missingExit || missingEntry) && (
              <ITText className="text-[12px] font-semibold text-amber-600">
                {missingExit ? t("noExit") : t("noEntry")}
              </ITText>
            )}
          </ITFlex>
        );
      },
    })),
    {
      key: "total",
      label: t("columns.total"),
      type: "string",
      width: 180,
      sortable: false,
      render: (r) => (
        <ITFlex direction="column" gap={0}>
          <ITText className="text-[11px] font-bold text-slate-700">
            {t("columns.hours")}: {hoursDecimal(r.totals.workedMin)}
          </ITText>
          <ITText className="text-[10px] font-bold text-emerald-700">
            {t("columns.approved")}: {hoursDecimal(r.totals.approvedExtraMin)}
          </ITText>
          <ITText className="text-[10px] font-bold text-amber-700">
            {t("columns.absences")}: {r.totals.absences}
          </ITText>
        </ITFlex>
      ),
    },
  ];

  const detailColumns: Column<WeeklyAttendanceDetailRow>[] = [
    {
      key: "name",
      label: t("columns.employee"),
      type: "string",
      width: 240,
      sortable: false,
      render: (r) => employeeCell(r.name, subOf(r.clock, r.departmentName)),
    },
    {
      key: "day",
      label: t("columns.day"),
      type: "date",
      width: 110,
      sortable: false,
      render: (r) => (
        <ITText className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{dayLabel(r.day.date)}</ITText>
      ),
    },
    {
      key: "day.status",
      label: t("columns.status"),
      type: "catalog",
      width: 150,
      sortable: false,
      filter: "catalog",
      catalogOptions: { data: STATUSES.map((id) => ({ id, name: t(`status.${id}`) })) },
      render: (r) => (
        <ITBadget color={WEEKLY_STATUS_BADGE[r.day.status]} size="sm">
          {t(`status.${r.day.status}`)}
        </ITBadget>
      ),
    },
    {
      key: "day.entryAt",
      label: t("columns.entry"),
      type: "string",
      width: 100,
      sortable: false,
      render: (r) => (
        <ITText className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
          {punchTime(r.day.entryAt, r.day.date, timezone)}
        </ITText>
      ),
    },
    {
      key: "day.exitAt",
      label: t("columns.exit"),
      type: "string",
      width: 100,
      sortable: false,
      render: (r) => (
        <ITText className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
          {punchTime(r.day.exitAt, r.day.date, timezone)}
        </ITText>
      ),
    },
    {
      key: "day.workedMin",
      label: t("columns.hours"),
      type: "number",
      width: 100,
      sortable: false,
      render: (r) => num(hoursDecimal(r.day.workedMin)),
    },
    {
      key: "day.extraMin",
      label: t("columns.overtime"),
      type: "number",
      width: 140,
      sortable: false,
      render: (r) =>
        r.day.extraMin > 0 ? (
          <ITFlex align="center" gap={1}>
            <ITText className="text-[12px] font-black text-emerald-700">{hoursDecimal(r.day.extraMin)}</ITText>
            {r.day.approval && (
              <ITBadget color={WEEKLY_APPROVAL_BADGE[r.day.approval]} size="sm">
                {t(`approval.${r.day.approval}`)}
              </ITBadget>
            )}
          </ITFlex>
        ) : (
          <ITText className="text-[12px] font-bold text-slate-400">0.00</ITText>
        ),
    },
    {
      key: "day.missingMin",
      label: t("columns.missing"),
      type: "number",
      width: 110,
      sortable: false,
      render: (r) => num(hoursDecimal(r.day.missingMin)),
    },
    {
      key: "day.shift",
      label: t("columns.shift"),
      type: "string",
      width: 160,
      filter: true,
      sortable: false,
      render: (r) => (
        <ITText className="text-[11px] text-slate-500 whitespace-nowrap">{r.day.shift ?? "—"}</ITText>
      ),
    },
  ];

  const common = {
    reloadTrigger,
    size: "lg" as const,
  };

  return mode === "DETAIL" ? (
    <ITDataTable showViewToggle={false}
      key={`detail:${queryKey}`}
      columns={detailColumns as unknown as Column<Record<string, unknown>>[]}
      fetchData={detailFetch as never}
      {...common}
      defaultItemsPerPage={25}
      itemsPerPageOptions={[25, 50, 100]}
      layout="fixed"
      density="compact"
      rowHeight={50}
      virtualized
      virtualizedMaxHeight={460}
    />
  ) : (
    <ITDataTable showViewToggle={false}
      key={`summary:${queryKey}`}
      columns={summaryColumns as unknown as Column<Record<string, unknown>>[]}
      fetchData={summaryFetch as never}
      {...common}
      defaultItemsPerPage={25}
      itemsPerPageOptions={[25, 50, 100]}
      layout="fixed"
      density="compact"
      rowHeight={50}
      virtualized
      virtualizedMaxHeight={460}
    />
  );
}
