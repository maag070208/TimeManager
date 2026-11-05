import { useMemo } from "react";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITDataTable,
  ITDatePicker,
  ITFlex,
  ITInput,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import type {
  Column,
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { LuActivity, LuFingerprint, LuLock, LuRotateCcw, LuTriangleAlert } from "react-icons/lu";
import { clockStatus, type TimeClockPunch, type PunchMethod } from "@entities/time-clock";
import { formatAgo, formatDate } from "@shared/i18n";
import { formatDateTime, formatTimeInTZ } from "@shared/utils/dates";
import { PanelCard } from "@shared/ui/panel-card";
import { FilterPills } from "@shared/ui/filter-pills";
import { ListSummaryStrip, type ListSummaryItem } from "@shared/ui/list-summary-strip";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import type { TimeClockRangeMode, UseTimeClock } from "../model/useTimeClock";
import TimeClockStatusCard from "./TimeClockStatusCard";

type BadgeColor = "success" | "warning" | "danger" | "gray" | "info";

const METHODS: PunchMethod[] = ["FACE", "FINGERPRINT", "CARD", "OTHER"];

const METHOD_COLOR: Record<PunchMethod, BadgeColor> = {
  FACE: "info",
  FINGERPRINT: "success",
  CARD: "gray",
  OTHER: "warning",
};

const pad = (n: number): string => String(n).padStart(2, "0");

/** Clave `YYYY-MM-DD` de un día local, para comparar días sin horas. */
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function TimeClockTab({ fx }: { fx: UseTimeClock }) {
  const {
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
    fetchTableData,
    reloadKey,
    tableTotal,
    tableUpdatedAt,
    status,
    error,
    setError,
    toast,
    setToast,
  } = fx;

  const [from, to] = dateRange;
  /** Un solo día: la columna lleva solo la hora (como el resto de la pantalla). */
  const singleDay = !!from && !!to && dayKey(from) === dayKey(to);

  const handleDateRange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: Date | [Date | null, Date | null] } }
  ) => {
    const value = e.target.value;
    if (Array.isArray(value)) setDateRange(value);
  };

  const columns = useMemo<Column<TimeClockPunch>[]>(
    () => [
      {
        key: "occurredAt",
        label: singleDay ? t("columns.occurredAt") : t("columns.dateTime"),
        type: "date",
        width: 190,
        filter: "date-range",
        dateFilterOptions: { maxDate: new Date() },
        sortable: false,
        render: (c) => (
          <ITText className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
            {singleDay ? formatTimeInTZ(c.occurredAt) : formatDateTime(c.occurredAt)}
          </ITText>
        ),
      },
      {
        key: "employeeNumber",
        label: t("columns.employee"),
        type: "catalog",
        width: 300,
        filter: "search",
        catalogOptions: fx.employeeOptions,
        sortable: false,
        render: (c) => (
          <ITFlex align="center" gap={2} className="min-w-0">
            <ProfileAvatar name={c.name || c.employeeNumber} size="sm" />
            <ITFlex direction="column" gap={0.5} className="min-w-0">
              <ITText className="text-[12px] font-black text-slate-800">{c.name || "—"}</ITText>
              <ITText className="text-[12px] font-bold text-slate-400">
                #{c.employeeNumber}
              </ITText>
            </ITFlex>
          </ITFlex>
        ),
      },
      {
        key: "method",
        label: t("columns.method"),
        type: "catalog",
        width: 140,
        sortable: false,
        filter: "catalog",
        catalogOptions: { data: METHODS.map((m) => ({ id: m, name: t(`methods.${m}`) })) },
        render: (c) => (
          <ITText as="span" title={c.method === "OTHER" ? t("otherHint", { minor: c.minor }) : undefined}>
            <ITBadget color={METHOD_COLOR[c.method]} size="lg">
              {t(`methods.${c.method}`)}
            </ITBadget>
          </ITText>
        ),
      },
      {
        key: "clock",
        label: t("columns.clock"),
        type: "catalog",
        width: 200,
        sortable: false,
        filter: "catalog",
        catalogOptions: { data: (status?.devices ?? []).map((d) => ({ id: d.clockSerial, name: d.name })) },
        render: (c) => (
          <ITText as="span" title={c.clockSerial}>
            <ITText className="text-[11px] font-bold text-slate-600">{c.clock ?? c.clockSerial}</ITText>
          </ITText>
        ),
      },
      {
        key: "serialNo",
        label: t("columns.serialNo"),
        type: "number",
        width: 100,
        filter: true,
        sortable: false,
        render: (c) => (
          <ITText className="text-[10px] font-bold text-slate-400">{c.serialNo}</ITText>
        ),
      },
    ],
    [t, singleDay, status?.devices, fx.employeeOptions]
  );

  /** "Hoy, miércoles 07 oct" para un día; "01 oct – 07 oct" para un rango. */
  const rangeLabel = useMemo(() => {
    if (!from) return "";
    const largo = (d: Date): string =>
      formatDate(d, { weekday: "long", day: "2-digit", month: "short" }).replace(",", "");
    const corto = (d: Date): string => formatDate(d, { day: "2-digit", month: "short" });
    if (!to || dayKey(from) === dayKey(to)) {
      const hoy = new Date();
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      const key = dayKey(from);
      if (key === dayKey(hoy)) return `${t("table.today")}, ${largo(from)}`;
      if (key === dayKey(ayer)) return `${t("table.yesterday")}, ${largo(from)}`;
      return largo(from);
    }
    return t("table.range", { from: corto(from), to: corto(to) });
  }, [from, to, t]);

  const tableTitle =
    tableTotal == null ? rangeLabel : `${rangeLabel} · ${t("table.punches", { count: tableTotal })}`;

  // Franja de resumen: totales que la pantalla ya tiene (checadas del rango y estado de los relojes).
  const devices = status?.devices ?? [];
  const failing = devices.filter((d) => ["error", "paused"].includes(clockStatus(d))).length;
  const summaryItems: ListSummaryItem[] = [
    {
      id: "punches",
      label: t("summary.punches"),
      value: tableTotal ?? "—",
      tone: "sea",
      icon: <LuFingerprint size={15} />,
      caption: rangeLabel,
    },
    {
      id: "clocks",
      label: t("summary.clocks"),
      value: devices.length,
      icon: <LuActivity size={15} />,
      caption: t("summary.connected", { count: devices.length - failing }),
    },
    {
      id: "problems",
      label: t("summary.problems"),
      value: failing,
      tone: failing > 0 ? "sun" : "mint",
      icon: <LuTriangleAlert size={15} />,
      caption: failing > 0 ? t("summary.problemsHint") : t("summary.allOk"),
    },
  ];

  const updatedAgo = formatAgo("time-clock:status", new Date(tableUpdatedAt).toISOString());

  return (
    <ITFlex direction="column" gap={4}>
      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </ITAlert>
      )}

      {status && devices.length > 0 && <ListSummaryStrip items={summaryItems} />}

      <TimeClockStatusCard fx={fx} />

      {/* Filtros: píldoras del rango, del reloj y del método. */}
      <PanelCard title={t("filters.title")}>
        <ITFlex direction="column" gap={3}>
          <ITFlex align="center" wrap="wrap" gap={2}>
            <FilterPills
              items={[
                { id: "today" as TimeClockRangeMode, label: t("presets.today") },
                { id: "yesterday" as TimeClockRangeMode, label: t("presets.yesterday") },
                { id: "last7" as TimeClockRangeMode, label: t("presets.last7") },
                { id: "custom" as TimeClockRangeMode, label: t("presets.custom") },
              ]}
              value={rangeMode}
              onChange={(id) => (id === "custom" ? chooseCustomRange() : applyRange(id))}
            />
            <div className="ml-auto w-full sm:w-72">
              <ITInput
                name="checadorEmployee"
                placeholder={t("filters.employeePlaceholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full min-w-0"
              />
            </div>
          </ITFlex>

          {rangeMode === "custom" && (
            <div className="w-full sm:w-72">
              <ITDatePicker
                name="checadorDateRange"
                label={t("filters.dateRange")}
                range
                value={dateRange}
                onChange={handleDateRange}
                className="w-full min-w-0"
              />
            </div>
          )}

          <ITFlex align="center" wrap="wrap" gap={2}>
            <FilterPills
              items={[
                { id: "", label: t("filters.allClocks") },
                ...(status?.devices ?? []).map((d) => ({ id: d.clockSerial, label: d.name })),
              ]}
              value={clock}
              onChange={setClock}
            />
          </ITFlex>

          <ITFlex align="center" wrap="wrap" gap={2}>
            <FilterPills
              items={[
                { id: "" as PunchMethod | "", label: t("filters.allMethods") },
                ...METHODS.map((m) => ({ id: m as PunchMethod | "", label: t(`methods.${m}`) })),
              ]}
              value={method as PunchMethod | ""}
              onChange={(id) => setMethod(id)}
            />
            <ITButton variant="text" color="gray" size="sm" className="ml-auto" onClick={clearFilters}>
              <ITFlex align="center" gap={1}>
                <LuRotateCcw size={12} />
                <ITText className="font-bold text-[11px]">{t("filters.clear")}</ITText>
              </ITFlex>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </PanelCard>

      {/* Las checadas. */}
      <PanelCard
        title={tableTitle}
        actions={
          updatedAgo && (
            <ITFlex align="center" gap={1}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
              <ITText className="text-[11px] text-slate-500">
                {t("table.updated", { ago: updatedAgo })}
              </ITText>
            </ITFlex>
          )
        }
      >
        <ITDataTable showViewToggle={false}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          fetchData={
            fetchTableData as unknown as (
              p: ITDataTableFetchParams
            ) => Promise<ITDataTableResponse<Record<string, unknown>>>
          }
          externalFilters={externalFilters}
          reloadTrigger={reloadKey}
          debounceMs={350}
          size="lg"
          defaultItemsPerPage={25}
          itemsPerPageOptions={[25, 50, 100]}
          layout="fixed"
          density="compact"
          rowHeight={50}
          virtualized
          virtualizedMaxHeight={460}
        />

        <ITFlex align="center" gap={1} className="mt-3">
          <LuLock size={11} className="text-slate-400" />
          <ITText className="text-[10px] font-bold text-slate-400">{t("status.readOnly")}</ITText>
        </ITFlex>
      </PanelCard>

      {toast && (
        <ITToast
          message={toast}
          type="success"
          position="top-right"
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </ITFlex>
  );
}
