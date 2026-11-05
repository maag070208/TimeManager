import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import {
  overtimeApi,
  type OvertimeDayRow,
  type OvertimeSummary,
} from "@entities/overtime";
import { useDepartmentOptions } from "@entities/department";
import { useWeekStartDay } from "@entities/sys-config";
import { useDebouncedValue } from "@shared/lib/useDebouncedValue";
import { periodRangeOf, shiftPeriod, toDateInput, type ReportPeriod } from "@shared/lib/reportPeriod";
import { formatDateTime, formatMinutesAsHhMm } from "@shared/utils/dates";
import { fileName } from "@shared/i18n";
import type { DownloadOvertimePdf } from "./types";

export type Period = ReportPeriod;
/** Pestaña de la tabla = filtro de estatus (`ALL` = todas). */
export type StatusTab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

/** Día seleccionado para aprobar/rechazar. */
export interface SelectedDay {
  userId: string;
  date: string;
}

/** Llave estable de un día (persona + fecha). */
export const dayKeyOf = (r: { userId: string; date: string }): string => `${r.userId}|${r.date}`;

const BROWSER_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City";

interface Toast {
  message: string;
  type: "success" | "error";
}

/** Rechazo en curso: los días y el motivo opcional que se captura en el diálogo. */
export interface RejectDraft {
  items: SelectedDay[];
  note: string;
}

interface UseOvertimeApprovalOptions {
  /** ADMIN/GERENTE deciden; el resto (RH) entra en modo solo lectura. */
  canApprove: boolean;
  /** Generador del PDF de aprobados, inyectado desde la página. */
  downloadPdf: DownloadOvertimePdf;
}

/**
 * Estado de la pantalla de tiempo extra: periodo, filtros, pestañas por
 * estatus, selección múltiple, aprobar/rechazar y exportación. El cálculo de
 * los pendientes lo hace la API al vuelo; aquí solo se guardan las decisiones.
 * Quien no puede aprobar (RH) queda en modo solo lectura: el servidor además le
 * devuelve únicamente lo aprobado.
 */
export const useOvertimeApproval = ({
  canApprove,
  downloadPdf,
}: UseOvertimeApprovalOptions) => {
  const { t } = useTranslation("overtime");
  const [period, setPeriod] = useState<Period>("WEEK");
  const [date, setDate] = useState<Date>(() => new Date());
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 350);
  const [tab, setTab] = useState<StatusTab>("PENDING");

  const [summary, setSummary] = useState<OvertimeSummary | null>(null);
  const [rows, setRows] = useState<OvertimeDayRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Map<string, SelectedDay>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejectDraft, setRejectDraft] = useState<RejectDraft | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const departments = useDepartmentOptions();
  const weekStart = useWeekStartDay();
  /** Filtros/orden vigentes de la tabla (barra + columnas), para el export. */
  const tableParamsRef = useRef<ITDataTableFetchParams | null>(null);

  const periodRange = useMemo(() => periodRangeOf(date, period, weekStart), [date, period, weekStart]);

  /** Filtros base (sin `status`): los que se usan para recalcular los días al decidir. */
  const baseFilters = useMemo<Record<string, string | number | boolean>>(() => {
    const f: Record<string, string | number | boolean> = {
      period,
      date: toDateInput(date),
    };
    if (departmentId) f.departmentId = departmentId;
    if (q) f.q = q;
    return f;
  }, [period, date, departmentId, q]);

  /** Filtros externos de la tabla. Quien no aprueba queda fijo en APROBADO. */
  const effectiveTab: StatusTab = canApprove ? tab : "APPROVED";
  const externalFilters = useMemo<Record<string, string | number | boolean>>(
    () => ({ ...baseFilters, status: effectiveTab }),
    [baseFilters, effectiveTab]
  );

  const tableKey = useMemo(() => JSON.stringify(externalFilters), [externalFilters]);

  // Otro filtro u otra pestaña = otra lista: la selección no se arrastra.
  useEffect(() => {
    setSelected(new Map());
  }, [tableKey]);

  const fetchTableData = useCallback(
    async (params: ITDataTableFetchParams) => {
      tableParamsRef.current = params;
      try {
        const res = await overtimeApi.query({
          page: params.page,
          limit: params.limit,
          filters: params.filters,
          ...(params.sort ? { sort: params.sort } : {}),
        });
        setSummary(res.summary);
        setRows(res.data);
        setTotal(res.total);
        setError(null);
        return { data: res.data as unknown as Record<string, unknown>[], total: res.total };
      } catch (e) {
        setError(e instanceof Error ? e.message : t("toast.error"));
        return { data: [], total: 0 };
      }
    },
    [t]
  );

  const changePeriod = useCallback((value: Period) => {
    setPeriod(value);
    // Cada periodo arranca en el que contiene hoy.
    setDate(new Date());
  }, []);

  const previousPeriod = useCallback(() => setDate((d) => shiftPeriod(d, period, -1)), [period]);
  const nextPeriod = useCallback(() => setDate((d) => shiftPeriod(d, period, 1)), [period]);

  const toggleRow = useCallback((row: OvertimeDayRow) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = dayKeyOf(row);
      if (next.has(key)) next.delete(key);
      else next.set(key, { userId: row.userId, date: row.date });
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Map()), []);

  /** Pendientes de la página visible (los únicos que se pueden seleccionar). */
  const visiblePending = useMemo(() => rows.filter((r) => r.status === "PENDING"), [rows]);
  const allVisibleSelected =
    visiblePending.length > 0 && visiblePending.every((r) => selected.has(dayKeyOf(r)));

  /** Casilla de la cabecera: selecciona (o quita) los pendientes visibles. */
  const toggleVisiblePending = useCallback(() => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (visiblePending.every((r) => next.has(dayKeyOf(r)))) {
        for (const r of visiblePending) next.delete(dayKeyOf(r));
      } else {
        for (const r of visiblePending) next.set(dayKeyOf(r), { userId: r.userId, date: r.date });
      }
      return next;
    });
  }, [visiblePending]);

  /** Guarda la decisión sobre los días indicados y refresca la lista. */
  const decide = useCallback(
    async (items: SelectedDay[], status: "APPROVED" | "REJECTED", note?: string): Promise<boolean> => {
      if (!canApprove || items.length === 0) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await overtimeApi.decide({
          filters: baseFilters,
          items: items.map((i) => ({ userId: i.userId, date: i.date })),
          status,
          ...(note ? { note } : {}),
        });
        setToast({
          message:
            status === "APPROVED"
              ? t("toast.approved", { count: res.updated })
              : t("toast.rejected", { count: res.updated }),
          type: "success",
        });
        setSelected(new Map());
        setReloadKey((k) => k + 1);
        return true;
      } catch (e) {
        setToast({ message: (e as Error).message || t("toast.error"), type: "error" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [canApprove, baseFilters, t]
  );

  const approveItems = useCallback((items: SelectedDay[]) => decide(items, "APPROVED"), [decide]);
  const approveSelected = useCallback(() => decide([...selected.values()], "APPROVED"), [decide, selected]);

  /** Abre el diálogo de rechazo (motivo opcional) para los días dados. */
  const startReject = useCallback(
    (items: SelectedDay[]) => {
      if (!canApprove || items.length === 0) return;
      setRejectDraft({ items, note: "" });
    },
    [canApprove]
  );
  const startRejectSelected = useCallback(() => startReject([...selected.values()]), [startReject, selected]);
  const setRejectNote = useCallback(
    (note: string) => setRejectDraft((d) => (d ? { ...d, note } : d)),
    []
  );
  const cancelReject = useCallback(() => {
    if (!saving) setRejectDraft(null);
  }, [saving]);
  const confirmReject = useCallback(async () => {
    if (!rejectDraft) return;
    const ok = await decide(rejectDraft.items, "REJECTED", rejectDraft.note.trim());
    if (ok) setRejectDraft(null);
  }, [decide, rejectDraft]);

  /**
   * Todas las filas del filtro vigente de la tabla (barra + columnas), sin
   * paginar: recorre las páginas de a 200 (tope del API). Lo comparten PDF y CSV
   * para que exporten exactamente lo que se ve.
   */
  const fetchAllForExport = useCallback(async (): Promise<{
    rows: OvertimeDayRow[];
    summary: OvertimeSummary;
  } | null> => {
    const base = tableParamsRef.current;
    const filters = base?.filters ?? externalFilters;
    const sort = base?.sort;
    const rows: OvertimeDayRow[] = [];
    let summary: OvertimeSummary | null = null;
    let page = 1;
    for (;;) {
      const res = await overtimeApi.query({
        page,
        limit: 200,
        filters,
        ...(sort ? { sort } : {}),
      });
      summary = res.summary;
      rows.push(...res.data);
      if (rows.length >= res.total || res.data.length === 0) break;
      page += 1;
    }
    return summary ? { rows, summary } : null;
  }, [externalFilters]);

  /** Exporta a PDF la tabla tal cual: los días del filtro vigente con su estado. */
  const exportPdf = useCallback(async () => {
    setExportingPdf(true);
    setError(null);
    try {
      const data = await fetchAllForExport();
      if (!data || data.rows.length === 0) {
        setToast({ message: t("exportEmpty"), type: "error" });
        return;
      }
      await downloadPdf({
        rows: data.rows,
        summary: data.summary,
        meta: {
          period,
          date: toDateInput(date),
          timezone: data.summary.range.timezone || BROWSER_TIMEZONE,
        },
        canApprove,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportingPdf(false);
    }
  }, [fetchAllForExport, period, date, downloadPdf, t, canApprove]);

  /** Exporta a CSV las mismas filas que el PDF (la tabla tal cual). */
  const exportCsv = useCallback(async () => {
    setExportingCsv(true);
    setError(null);
    try {
      const data = await fetchAllForExport();
      if (!data || data.rows.length === 0) {
        setToast({ message: t("exportEmpty"), type: "error" });
        return;
      }
      const statusKey = {
        PENDING: "statusPending",
        APPROVED: "statusApproved",
        REJECTED: "statusRejected",
      } as const;
      const header = [
        t("columns.employee"),
        t("columns.department"),
        t("columns.date"),
        t("columns.schedule"),
        canApprove ? t("columns.extra") : t("statusApproved"),
        t("status"),
        t("columns.decidedBy"),
        t("columns.decidedAt"),
        t("columns.note"),
      ];
      const lines = data.rows.map((r) => [
        r.employeeNumber ? `${r.employeeName} (#${r.employeeNumber})` : r.employeeName,
        r.departmentName ?? "",
        r.date,
        r.scheduleName ?? t("columns.noSchedule"),
        formatMinutesAsHhMm(canApprove ? r.extraMin : r.approvedExtraMin),
        t(statusKey[r.status]),
        r.decidedByName ?? "",
        r.decidedAt ? formatDateTime(r.decidedAt) : "",
        r.note ?? "",
      ]);
      const escape = (c: unknown) => `"${String(c ?? "").replace(/"/g, '""')}"`;
      const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName("overtimeReport")}-${period.toLowerCase()}-${toDateInput(date)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportingCsv(false);
    }
  }, [fetchAllForExport, period, date, t, canApprove]);

  return {
    t,
    canApprove,
    period,
    changePeriod,
    date,
    setDate,
    periodRange,
    previousPeriod,
    nextPeriod,
    departmentId,
    setDepartmentId,
    departments,
    search,
    setSearch,
    tab: effectiveTab,
    setTab,
    summary,
    total,
    externalFilters,
    tableKey,
    fetchTableData,
    selected,
    selectedCount: selected.size,
    toggleRow,
    clearSelection,
    allVisibleSelected,
    hasVisiblePending: visiblePending.length > 0,
    toggleVisiblePending,
    saving,
    approveItems,
    approveSelected,
    startReject,
    startRejectSelected,
    rejectDraft,
    setRejectNote,
    cancelReject,
    confirmReject,
    exportPdf,
    exportCsv,
    exportingPdf,
    exportingCsv,
    reloadKey,
    error,
    setError,
    toast,
    setToast,
  };
};

export type UseOvertimeApproval = ReturnType<typeof useOvertimeApproval>;
