import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import {
  timeClockApi,
  type TimeClockPunch,
  type TimeClockStatus,
  type PunchMethod,
} from "@entities/time-clock";
import { fileName } from "@shared/i18n";

/** Refresco del estado mientras corre una sincronización o una importación. */
const STATUS_POLL_MS = 5_000;

/** Máximo de filas por página que acepta el contrato de tablas de la API. */
const EXPORT_PAGE_SIZE = 100;

/** Llave de orden de la tabla de checadas. */
type PunchesSort = NonNullable<ITDataTableFetchParams["sort"]>;

/**
 * Orden por defecto: checada más reciente primero. Un solo lugar para la tabla
 * y el CSV, que así respeta el orden que ve el usuario.
 */
const DEFAULT_PUNCHES_SORT: PunchesSort = { key: "occurredAt", direction: "desc" };

export type TimeClockRangePreset = "today" | "yesterday" | "last7";

/** Modo del rango: uno de los presets o el rango elegido a mano. */
export type TimeClockRangeMode = TimeClockRangePreset | "custom";

const pad = (n: number): string => String(n).padStart(2, "0");

/** Fecha local `YYYY-MM-DD` (la API resuelve el día en `tz`). */
const toDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `DD/MM/AAAA` y `HH:mm:ss` locales, en columnas separadas para la hoja de cálculo. */
const dateTime = (iso: string): [string, string] => {
  const d = new Date(iso);
  return [
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  ];
};

/**
 * Checadas de los relojes Hikvision: filtros de la tabla server-side, estado de
 * la sincronización de cada reloj, importación manual por fechas (se refresca
 * sola mientras corre) y exportación CSV.
 */
export const useTimeClock = () => {
  const { t } = useTranslation(["time-clock", "common"]);

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(),
    new Date(),
  ]);
  /** Píldora activa del rango: `custom` cuando el usuario elige las fechas. */
  const [rangeMode, setRangeMode] = useState<TimeClockRangeMode>("today");
  /** Total de checadas que cumplen los filtros (el encabezado de la tabla). */
  const [tableTotal, setTableTotal] = useState<number | null>(null);
  /** Cuándo se leyó la tabla por última vez ("Actualizado hace 2 min"). */
  const [tableUpdatedAt, setTableUpdatedAt] = useState<number>(() => Date.now());
  const [q, setQ] = useState("");
  const [method, setMethod] = useState<PunchMethod | "">("");
  /** Serie del reloj ("" = todos). */
  const [clock, setClock] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Opciones del filtro Empleado: las personas del reloj (número + nombre del reloj),
  // porque las checadas son del número del reloj, no de un usuario.
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [employeeOptionsState, setEmployeeOptionsState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    (async () => {
      const rows: Array<{ id: string; name: string }> = [];
      for (let page = 1; ; page++) {
        const res = await timeClockApi.employees({ page, limit: 200, filters: {} });
        rows.push(...res.data.map((e) => ({ id: e.employeeNumber, name: `${e.name} #${e.employeeNumber}` })));
        if (rows.length >= res.total || res.data.length === 0) break;
      }
      if (active) {
        setEmployeeOptions(rows.sort((a, b) => a.name.localeCompare(b.name)));
        setEmployeeOptionsState("ready");
      }
    })().catch(() => active && setEmployeeOptionsState("error"));
    return () => {
      active = false;
    };
  }, [reloadKey]);
  const employeeFilterOptions = useMemo(
    () => ({ data: employeeOptions, loading: employeeOptionsState === "loading", error: employeeOptionsState === "error" }),
    [employeeOptions, employeeOptionsState]
  );

  const [status, setStatus] = useState<TimeClockStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await timeClockApi.status());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.status"));
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const inProgress = status?.inProgress != null;
  const importing = status?.importJob != null && status.importJob.finishedAt == null;

  // Mientras algo corre se refresca el estado. Cuando termina, se recarga la
  // tabla y se avisa el resultado (drenado de los relojes o importación por
  // rango). `desde` es cuándo empezó lo que se vio correr: sus corridas son
  // las que se reportan.
  const previous = useRef({ inProgress: false, importing: false, from: 0 });
  useEffect(() => {
    const before = previous.current;
    if ((before.inProgress && !inProgress) || (before.importing && !importing)) {
      setReloadKey((k) => k + 1);
    }
    const importJob = status?.importJob;
    if (before.importing && !importing && importJob) {
      if (importJob.error) setError(importJob.error);
      else setToast(t("import.toast", { count: importJob.newCount }));
    }
    if (before.inProgress && !inProgress) {
      const finished = (status?.devices ?? []).filter(
        (d) => d.lastRun && Date.parse(d.lastRun.startedAt) >= before.from
      );
      const failed = finished.filter((d) => !d.lastRun!.ok);
      if (failed.length > 0) {
        setError(
          failed.map((d) => `${d.name}: ${d.lastRun!.error ?? t("errors.sync")}`).join(" · ")
        );
      } else if (finished.length > 0) {
        const newCount = finished.reduce((acc, d) => acc + d.lastRun!.newCount, 0);
        setToast(t("sync.toast", { count: newCount }));
      }
    }
    const from = !inProgress ? 0 : before.inProgress ? before.from : Date.parse(status!.inProgress!.startedAt);
    previous.current = { inProgress, importing, from };
    if (!inProgress && !importing) return undefined;
    const timer = window.setTimeout(() => void loadStatus(), STATUS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [inProgress, importing, status, loadStatus, t]);

  /**
   * Avance del drenado con métricas derivadas (para la tarjeta). La velocidad
   * es la de toda la corrida: el avance llega por ventanas, a saltos, y una
   * muestra entre dos refrescos exageraría.
   */
  const progress = useMemo(() => {
    const p = status?.inProgress;
    if (!p) return null;
    const { total } = p;
    const seconds = (Date.now() - Date.parse(p.startedAt)) / 1000;
    const rate = p.readCount > 0 && seconds > 0 ? p.readCount / seconds : null;
    return {
      ...p,
      /** Eventos que faltan según el total de la corrida. */
      missing: total != null ? Math.max(0, total - p.readCount) : null,
      /** % de eventos del reloj revisados (no de checadas). */
      percent: total != null && total > 0 ? Math.min(100, Math.round((p.readCount / total) * 100)) : null,
      rate,
      eta: rate != null && total != null ? Math.max(0, Math.round((total - p.readCount) / rate)) : null,
    };
  }, [status?.inProgress]);

  const externalFilters = useMemo(() => {
    const filters: Record<string, string | number | boolean> = {};
    if (dateRange[0]) filters.from = toDateInput(dateRange[0]);
    if (dateRange[1]) filters.to = toDateInput(dateRange[1]);
    const query = q.trim();
    if (query) filters.q = query;
    if (method) filters.method = method;
    if (clock) filters.clockSerial = clock;
    return filters;
  }, [dateRange, q, method, clock]);

  // Sort vigente de la tabla, compartido con el export. Al cambiar los filtros
  // la tabla se remonta y pierde su orden: el ref vuelve al default.
  const sortRef = useRef<PunchesSort>(DEFAULT_PUNCHES_SORT);
  // Filtros vigentes de la tabla (barra + columnas): el CSV exporta lo mismo que se ve.
  const filtersRef = useRef<ITDataTableFetchParams["filters"]>(externalFilters);

  useEffect(() => {
    sortRef.current = DEFAULT_PUNCHES_SORT;
    filtersRef.current = externalFilters;
  }, [externalFilters]);

  const fetchTableData = useCallback(async (params: ITDataTableFetchParams) => {
    const sort = params.sort ?? DEFAULT_PUNCHES_SORT;
    sortRef.current = sort;
    filtersRef.current = params.filters;
    const res = await timeClockApi.table({
      page: params.page,
      limit: params.limit,
      filters: params.filters,
      sort,
    });
    setTableTotal(res.total);
    setTableUpdatedAt(Date.now());
    return {
      data: res.data as unknown as Record<string, unknown>[],
      total: res.total,
    };
  }, []);

  const applyRange = (preset: TimeClockRangePreset) => {
    setRangeMode(preset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (preset === "today") {
      setDateRange([today, today]);
      return;
    }
    if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      setDateRange([y, y]);
      return;
    }
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    setDateRange([start, today]);
  };

  /** "Personalizado": deja el rango como está y muestra el selector de fechas. */
  const chooseCustomRange = () => setRangeMode("custom");

  const clearFilters = () => {
    setRangeMode("today");
    setDateRange([new Date(), new Date()]);
    setQ("");
    setMethod("");
    setClock("");
  };

  /** Arranca la importación; su avance llega por el sondeo de `status`. */
  const startImport = useCallback(async (from: string, to: string) => {
    setStarting(true);
    setError(null);
    try {
      const importJob = await timeClockApi.startImport({ from, to });
      setStatus((s) => (s ? { ...s, importJob } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.import"));
    } finally {
      setStarting(false);
    }
  }, [t]);

  /**
   * "Sincronizar todo": drena de cada reloj lo que falte desde su cursor (el
   * rezago completo), sin esperar a la sincronización automática. Su avance
   * llega por el sondeo de `status`.
   */
  const handleSyncAll = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const initial = await timeClockApi.sync();
      setStatus((s) => (s ? { ...s, inProgress: initial } : s));
    } catch (e) {
      const httpStatus =
        typeof e === "object" && e !== null ? (e as { status?: number }).status : undefined;
      setError(httpStatus === 409 ? t("sync.alreadyRunning") : t("errors.sync"));
    } finally {
      setStarting(false);
    }
  }, [t]);

  /** Importa del reloj todo el rango de fechas seleccionado en los filtros. */
  const handleImportRange = () => {
    const [from, to] = dateRange;
    if (!from) return;
    void startImport(toDateInput(from), toDateInput(to ?? from));
  };

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const rows: TimeClockPunch[] = [];
      for (let page = 1; ; page += 1) {
        const res = await timeClockApi.table({
          page,
          limit: EXPORT_PAGE_SIZE,
          filters: filtersRef.current,
          sort: sortRef.current,
        });
        rows.push(...res.data);
        if (res.data.length < EXPORT_PAGE_SIZE || rows.length >= res.total) break;
      }
      const header = [
        t("csv.date"),
        t("csv.hour"),
        t("csv.employeeNumber"),
        t("csv.name"),
        t("csv.method"),
        t("csv.clock"),
        t("csv.serialNo"),
      ];
      const lines = rows.map((c) => [
        ...dateTime(c.occurredAt),
        c.employeeNumber,
        c.name,
        t(`methods.${c.method}`),
        c.clock ?? c.clockSerial,
        c.serialNo,
      ]);
      const escape = (cell: unknown) => `"${String(cell ?? "").replace(/"/g, '""')}"`;
      const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName("timeClockPunches")}-${String(externalFilters.from ?? "")}_${String(externalFilters.to ?? "")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.export"));
    } finally {
      setExporting(false);
    }
  }, [externalFilters, t]);

  return {
    t,
    dateRange,
    setDateRange,
    rangeMode,
    applyRange,
    chooseCustomRange,
    q,
    setQ,
    method,
    setMethod,
    clock,
    setClock,
    clearFilters,
    externalFilters,
    employeeOptions: employeeFilterOptions,
    fetchTableData,
    reloadKey,
    tableTotal,
    tableUpdatedAt,
    status,
    inProgress,
    progress,
    importing,
    starting,
    handleSyncAll,
    handleImportRange,
    exporting,
    handleExportCsv,
    error,
    setError,
    toast,
    setToast,
  };
};

export type UseTimeClock = ReturnType<typeof useTimeClock>;
