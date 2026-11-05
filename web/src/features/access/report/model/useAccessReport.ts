import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { onAppEvent } from "@shared/lib/appEvents";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import {
  accessApi,
  type AccessReportPdfMeta,
  type AccessReportPeriod,
  type AccessReportSessionRow,
  type AccessReportSummary,
  type AccessReportTableResponse,
  type PeopleAttendanceResponse,
  type PeopleAttendanceSummary,
  type PeopleAttendanceView,
} from "@entities/access";
import { useDepartmentOptions } from "@entities/department";
import { useWeekStartDay } from "@entities/sys-config";
import type { ITDataTableFetchParamsPost } from "@shared/api/table";
import { formatMinutesAsHhMm, formatTimeInTZ } from "@shared/utils/dates";
import { useDebouncedValue } from "@shared/lib/useDebouncedValue";
import { periodRangeOf, shiftPeriod, toDateInput } from "@shared/lib/reportPeriod";
import { fileName, type FileNameKey, dateLocale } from "@shared/i18n";

/** Firma del generador de PDF, inyectado por la página (widgets → features por DI). */
export type DownloadAccessReportPdf = (
  rows: AccessReportSessionRow[],
  summary: AccessReportSummary,
  meta: AccessReportPdfMeta
) => Promise<void>;

/**
 * De dónde salen las entradas/salidas. Por defecto, la bitácora de accesos; el
 * reloj checador inyecta la suya, con el mismo contrato.
 */
export interface AccessReportSource {
  /** Una fila por persona con cada día del periodo contra su horario (la pantalla). */
  people: (params: ITDataTableFetchParamsPost) => Promise<PeopleAttendanceResponse>;
  /** Todas las sesiones del periodo (PDF y CSV). */
  reportExport: (params: ITDataTableFetchParamsPost) => Promise<AccessReportTableResponse>;
  /** Prefijo del nombre del CSV. */
  csvFile: FileNameKey;
}

/** Orden de los exports: sesión más reciente primero. */
const EXPORT_SORT = { key: "entryAt", direction: "desc" } as const;

const ACCESS_SOURCE: AccessReportSource = {
  people: accessApi.people,
  reportExport: accessApi.reportExport,
  csvFile: "access",
};

interface Options {
  download: DownloadAccessReportPdf;
  /** Debe ser estable (constante de módulo) para no rehacer los callbacks. */
  source?: AccessReportSource;
}

/** Zona horaria del navegador; el reporte la usa para resolver los límites del día. */
const BROWSER_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City";

/**
 * Estado de la pantalla de Entradas y salidas: una fila por persona con cada
 * día del periodo, KPIs y vistas rápidas. Los exports conservan el detalle por
 * sesión con los mismos filtros de la barra.
 */
export const useAccessReport = ({ download, source = ACCESS_SOURCE }: Options) => {
  const { t } = useTranslation(["access-report", "common"]);

  const [period, setPeriod] = useState<AccessReportPeriod>("WEEK");
  const [date, setDate] = useState<Date>(() => new Date());
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 350);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [view, setView] = useState<PeopleAttendanceView>("ALL");

  // Langostín: «Muéstrame solo las incidencias», «¿Quién está en sitio?»…
  // El panel avisa y la tabla se filtra sin que la persona toque las píldoras.
  useEffect(() => onAppEvent("attendance:view", ({ view: next }) => setView(next)), []);

  const [summary, setSummary] = useState<PeopleAttendanceSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const departments = useDepartmentOptions();
  const weekStart = useWeekStartDay();

  const dateKey = toDateInput(date);
  const periodRange = useMemo(() => periodRangeOf(date, period, weekStart), [date, period, weekStart]);

  // `includeInactive` viaja como BOOLEANO (el contrato de tablas no acepta "false").
  const barFilters = useMemo<Record<string, string | boolean>>(
    () => ({
      period,
      date: dateKey,
      includeInactive,
      ...(departmentId && { departmentId }),
      ...(q && { q }),
    }),
    [period, dateKey, departmentId, q, includeInactive]
  );
  const externalFilters = useMemo(() => ({ ...barFilters, view }), [barFilters, view]);

  /**
   * Firma de los filtros: se pasa como `key` de la tabla para que vuelva a la
   * página 1 al cambiarlos (`reloadTrigger` conservaría la página).
   */
  const tableKey = useMemo(() => JSON.stringify(externalFilters), [externalFilters]);

  const fetchTableData = useCallback(
    async (params: ITDataTableFetchParams) => {
      try {
        const res = await source.people({
          page: params.page,
          limit: params.limit,
          filters: params.filters,
          sort: params.sort,
        });
        setSummary(res.summary);
        setTotal(res.total);
        setError(null);
        return { data: res.data as unknown as Record<string, unknown>[], total: res.total };
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.load"));
        return { data: [], total: 0 };
      }
    },
    [source, t]
  );

  const changePeriod = (value: AccessReportPeriod) => {
    setPeriod(value);
    // Cada periodo arranca en el que contiene hoy.
    setDate(new Date());
  };

  const exportSessions = useCallback(
    (limit: number) =>
      source.reportExport({ page: 1, limit, filters: barFilters, sort: EXPORT_SORT }),
    [source, barFilters]
  );

  const handleDownloadPdf = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await exportSessions(100);
      await download(res.data, res.summary, {
        period,
        date: dateKey,
        timezone: res.summary.range.timezone || BROWSER_TIMEZONE,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.load"));
    } finally {
      setExporting(false);
    }
  }, [download, exportSessions, period, dateKey, t]);

  const handleDownloadCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await exportSessions(1000);
      const tz = res.summary.range.timezone || BROWSER_TIMEZONE;
      const stamp = (iso: string | null): string => {
        if (!iso) return "";
        if (period === "DAY") return formatTimeInTZ(iso, tz);
        return `${new Date(iso).toLocaleDateString(dateLocale())} ${formatTimeInTZ(iso, tz)}`;
      };
      const header = [
        t("columns.date"),
        t("columns.employee"),
        t("columns.department"),
        t("columns.jobTitle"),
        t("columns.entry"),
        t("columns.exit"),
        t("columns.hours"),
        t("columns.incident"),
      ];
      const lines = res.data.map((r) => [
        r.date,
        r.employeeName,
        r.departmentName ?? t("noDepartment"),
        r.jobTitle ?? "",
        stamp(r.entryAt),
        stamp(r.exitAt),
        r.entryAt && r.exitAt ? formatMinutesAsHhMm(r.workedMinutes) : "",
        r.incident ? t(`incidents.${r.incident}`) : "",
      ]);
      const escape = (cell: unknown) => `"${String(cell ?? "").replace(/"/g, '""')}"`;
      const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName(source.csvFile)}-${period.toLowerCase()}-${dateKey}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.load"));
    } finally {
      setExporting(false);
    }
  }, [exportSessions, source, period, dateKey, t]);

  return {
    t,
    period,
    changePeriod,
    date,
    setDate,
    periodRange,
    previousPeriod: () => setDate((d) => shiftPeriod(d, period, -1)),
    nextPeriod: () => setDate((d) => shiftPeriod(d, period, 1)),
    departmentId,
    setDepartmentId,
    departments,
    search,
    setSearch,
    includeInactive,
    setIncludeInactive,
    view,
    setView,
    summary,
    total,
    exporting,
    error,
    setError,
    externalFilters,
    tableKey,
    fetchTableData,
    handleDownloadPdf,
    handleDownloadCsv,
  };
};

export type UseAccessReport = ReturnType<typeof useAccessReport>;
