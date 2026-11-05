import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelCard } from "@shared/ui/panel-card";
import { useNavigate } from "react-router-dom";
import {
  ITAlert,
  ITBadget,
  ITButton,
  ITCard,
  ITCheckbox,
  ITDataTable,
  ITDatePicker,
  ITDialog,
  ITFlex,
  ITGrid,
  ITInput,
  ITBentoPill,
  ITBentoStatStrip,
  ITPage,
  ITSearchSelect,
  ITText,
  ITTextarea,
  ITToast,
} from "@axzydev/axzy_ui_system";
import type {
  Column,
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { FaDoorOpen, FaFileCsv } from "react-icons/fa";
import { LuBan, LuEye, LuFilter, LuListChecks, LuLogIn, LuLogOut, LuRadio, LuRotateCcw } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { useCan, usePeopleOptions, type UserRole } from "@entities/user";
import { formatDateTime } from "@shared/utils/dates";
import { LocationMap } from "@shared/ui/location-map";
import {
  accessApi,
  type AccessEvent,
  type AccessEventType,
  type AccessStats,
  type Site,
} from "@entities/access";
import { fileName } from "@shared/i18n";
import { useGoBack } from "@shared/lib/useGoBack";
import { FilterPills } from "@shared/ui/filter-pills";
import type { ListSummaryItem } from "@shared/ui/list-summary-strip";
import { DialogHeader } from "@shared/ui/dialog-header";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { Num } from "@shared/ui/bento-bits";

type BadgeColor = "success" | "warning" | "danger" | "gray" | "info";

const TYPE_COLOR: Record<AccessEventType, BadgeColor> = {
  ENTRY: "success",
  EXIT: "warning",
};

/** Fecha local `YYYY-MM-DD` (el backend completa el fin del día si no trae hora). */
const toDateInput = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatCoords = (lat: number | null, lng: number | null): string =>
  lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "";

const GUARD_ROLES: UserRole[] = ["GUARD"];

type RangePreset = "today" | "yesterday" | "last7";

export default function AccessPage() {
  const { t: tt } = useTranslation(["access", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const canVoid = useCan("access.void");

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesError, setSitesError] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(),
    new Date(),
  ]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [stats, setStats] = useState<AccessStats | null>(null);
  // Última checada registrada (sin filtros): el "escaneo en vivo" del héroe.
  const [lastEvent, setLastEvent] = useState<AccessEvent | null>(null);
  const [preset, setPreset] = useState<RangePreset | "custom">("today");
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [detail, setDetail] = useState<AccessEvent | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<AccessEvent | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSaving, setVoidSaving] = useState(false);

  useEffect(() => {
    let active = true;
    accessApi
      .sites()
      .then((list) => {
        if (active) setSites(list);
      })
      .catch(() => {
        if (active) setSitesError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const reload = () => setReloadKey((k) => k + 1);
  // Opciones de los filtros Empleado y Guardia (incluye a quien ya se dio de baja).
  const peopleOptions = usePeopleOptions();
  const guardOptions = usePeopleOptions(GUARD_ROLES);

  const externalFilters = useMemo(() => {
    const filters: Record<string, string | number | boolean> = {};
    if (dateRange[0]) filters.start = toDateInput(dateRange[0]);
    if (dateRange[1]) filters.end = toDateInput(dateRange[1]);
    const q = employeeQuery.trim();
    if (q) filters.q = q;
    if (typeFilter) filters.type = typeFilter;
    if (includeVoided) filters.includeVoided = true;
    return filters;
  }, [dateRange, employeeQuery, typeFilter, includeVoided]);

  // KPIs: se recalculan con los mismos filtros (independientes de la página).
  useEffect(() => {
    let active = true;
    accessApi
      .stats({ page: 1, limit: 1, filters: externalFilters })
      .then((res) => {
        if (active) setStats(res);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, [externalFilters, reloadKey]);

  useEffect(() => {
    let active = true;
    accessApi
      .table({ page: 1, limit: 1, filters: {}, sort: { key: "occurredAt", direction: "desc" } })
      .then((res) => {
        if (active) setLastEvent(res.data[0] ?? null);
      })
      .catch(() => {
        if (active) setLastEvent(null);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const fetchTableData = useCallback(async (params: ITDataTableFetchParams) => {
    const res = await accessApi.table({
      page: params.page,
      limit: params.limit,
      filters: params.filters,
      sort: params.sort,
    });
    return {
      data: res.data as unknown as Record<string, unknown>[],
      total: res.total,
    };
  }, []);

  const applyRange = (value: RangePreset) => {
    setPreset(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (value === "today") {
      setDateRange([today, today]);
      return;
    }
    if (value === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      setDateRange([y, y]);
      return;
    }
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    setDateRange([start, today]);
  };

  const clearFilters = () => {
    setPreset("today");
    setDateRange([new Date(), new Date()]);
    setEmployeeQuery("");
    setTypeFilter("");
    setIncludeVoided(false);
  };

  const handleDateRange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: Date | [Date | null, Date | null] } }
  ) => {
    const value = e.target.value;
    if (Array.isArray(value)) {
      setPreset("custom");
      setDateRange(value);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await accessApi.table({
        page: 1,
        limit: 5000,
        filters: externalFilters,
        sort: { key: "occurredAt", direction: "desc" },
      });
      const header = [
        tt("columns.occurredAt"),
        tt("columns.employee"),
        tt("columns.type"),
        tt("columns.site"),
        tt("columns.locationSource"),
        tt("columns.guard"),
        tt("columns.status"),
      ];
      const lines = res.data.map((e) => [
        formatDateTime(e.occurredAt),
        [e.employeeNameSnapshot, e.employeeNumberSnapshot ? `#${e.employeeNumberSnapshot}` : ""]
          .filter(Boolean)
          .join(" "),
        tt(`types.${e.type}`),
        e.site?.name ?? "",
        tt(`locationSources.${e.locationSource}`),
        e.guard?.name ?? "",
        e.voidedAt ? tt("status.voided") : tt("status.active"),
      ]);
      const escape = (cell: unknown) => `"${String(cell ?? "").replace(/"/g, '""')}"`;
      const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName("access")}-${toDateInput(dateRange[0] ?? new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err instanceof Error ? err.message : tt("errors.load"));
    } finally {
      setExporting(false);
    }
  };

  const openDetail = async (event: AccessEvent) => {
    setDetail(event);
    setDetailError(null);
    try {
      setDetail(await accessApi.get(event.id));
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : tt("errors.detail"));
    }
  };

  const openVoid = (event: AccessEvent) => {
    setVoidTarget(event);
    setVoidReason("");
    setVoidError(null);
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      setVoidError(tt("void.reasonRequired"));
      return;
    }
    setVoidSaving(true);
    setVoidError(null);
    try {
      await accessApi.void(voidTarget.id, reason);
      setVoidTarget(null);
      reload();
      setToast(tt("void.success"));
    } catch (err: unknown) {
      setVoidError(err instanceof Error ? err.message : tt("void.error"));
    } finally {
      setVoidSaving(false);
    }
  };

  const typeOptions = useMemo(
    () => [
      { id: "ENTRY", name: tt("types.ENTRY") },
      { id: "EXIT", name: tt("types.EXIT") },
    ],
    [tt]
  );

  // Franja de resumen: totales del rango; el clic filtra la bitácora.
  const summaryItems: ListSummaryItem[] = [
    { id: "all", label: tt("kpis.total"), value: stats?.total ?? 0, icon: <LuListChecks size={15} /> },
    { id: "ENTRY", label: tt("kpis.entries"), value: stats?.entries ?? 0, tone: "mint", icon: <LuLogIn size={15} /> },
    { id: "EXIT", label: tt("kpis.exits"), value: stats?.exits ?? 0, tone: "sun", icon: <LuLogOut size={15} /> },
    {
      id: "voided",
      label: tt("kpis.voided"),
      value: stats?.voided ?? 0,
      tone: (stats?.voided ?? 0) > 0 ? "lavender" : "plain",
      icon: <LuBan size={15} />,
    },
  ];
  const activeSummary = includeVoided && !typeFilter ? "voided" : typeFilter || "all";
  const selectSummary = (id: string) => {
    if (id === "voided") {
      setTypeFilter("");
      setIncludeVoided((v) => !v);
      return;
    }
    setTypeFilter(id === "all" ? "" : id);
    setIncludeVoided(false);
  };

  const presetItems = [
    { id: "today" as const, label: tt("presets.today") },
    { id: "yesterday" as const, label: tt("presets.yesterday") },
    { id: "last7" as const, label: tt("presets.last7") },
  ];

  const columns: Column<AccessEvent>[] = [
    {
      key: "occurredAt",
      label: tt("columns.occurredAt"),
      type: "date",
      width: 190,
      filter: "date-range",
      dateFilterOptions: { maxDate: new Date() },
      sortable: false,
      render: (e) => (
        <ITText className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
          {formatDateTime(e.occurredAt)}
        </ITText>
      ),
    },
    {
      key: "employeeId",
      label: tt("columns.employee"),
      type: "catalog",
      width: 240,
      filter: "search",
      catalogOptions: peopleOptions,
      sortable: false,
      render: (e) => (
        <ITFlex direction="column" gap={0.5}>
          <ITText className="text-[12px] font-black text-slate-800">
            {e.employeeNameSnapshot ?? "—"}
          </ITText>
          <ITText className="text-[12px] font-bold text-slate-400">
            {e.employeeNumberSnapshot ? `#${e.employeeNumberSnapshot}` : "—"}
          </ITText>
        </ITFlex>
      ),
    },
    {
      key: "type",
      label: tt("columns.type"),
      type: "catalog",
      width: 130,
      sortable: false,
      filter: "catalog",
      catalogOptions: { data: typeOptions, loading: false, error: false },
      render: (e) => (
        <ITBadget color={TYPE_COLOR[e.type]} size="lg">
          {tt(`types.${e.type}`)}
        </ITBadget>
      ),
    },
    {
      key: "siteId",
      label: tt("columns.site"),
      type: "catalog",
      width: 200,
      filter: "catalog",
      sortable: false,
      catalogOptions: {
        data: sites.map((s) => ({ id: s.id, name: s.name })),
        loading: false,
        error: sitesError,
      },
      render: (e) => (
        <ITText className="text-[11px] font-bold text-slate-600">
          {e.site?.name ?? "—"}
        </ITText>
      ),
    },
    {
      key: "guardId",
      label: tt("columns.guard"),
      type: "catalog",
      width: 200,
      filter: "search",
      catalogOptions: guardOptions,
      sortable: false,
      render: (e) => (
        <ITText className="text-[11px] font-bold text-slate-600">
          {e.guard?.name ?? "—"}
        </ITText>
      ),
    },
    {
      key: "actions",
      label: tt("columns.actions"),
      type: "actions",
      width: 100,
      actions: (e) => (
        <ITFlex align="center" gap={1}>
          <ITButton
            variant="outlined"
            size="lg"
            color="secondary"
            title={tt("actions.view")}
            onClick={() => void openDetail(e)}
          >
            <LuEye size={14} />
          </ITButton>
        </ITFlex>
      ),
    },
  ];

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("title")}
      description={tt("description")}
      icon={<FaDoorOpen size={20} />}
      breadcrumbs={[
        { label: tt("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: tt("title") },
      ]}
      backAction={() => goBack("/")}
      actions={
        <ITButton variant="outlined" size="lg" color="secondary" onClick={handleExportCsv} disabled={exporting}>
          <ITFlex align="center" gap={1}>
            <FaFileCsv className="text-emerald-600" size={13} />
            <ITText className="font-bold text-[11px]">
              {exporting ? tt("actions.exporting") : tt("actions.exportCsv")}
            </ITText>
          </ITFlex>
        </ITButton>
      }
    >
      {sitesError && (
        <ITAlert variant="warning" dismissible onDismiss={() => setSitesError(false)}>
          {tt("errors.sites")}
        </ITAlert>
      )}

      {/* Última checada: una fila normal (no el hueco de valor grande del mosaico,
          que aplastaba el texto cuando no hay checadas). */}
      <ITCard contentClassName="!p-0">
        <ITFlex align="center" gap={3} wrap="wrap" className="px-5 py-3">
          <ITFlex align="center" gap={1.5} className="shrink-0">
            <ITText as="span" style={{ color: "var(--color-primary)" }}>
              <LuRadio size={15} />
            </ITText>
            <ITText className="!text-[12px] font-bold uppercase tracking-[0.04em] text-slate-500">
              {tt("live.title")}
            </ITText>
          </ITFlex>
          {lastEvent ? (
            <ITFlex align="center" gap={2.5} className="min-w-0 flex-1">
              <ProfileAvatar name={lastEvent.employeeNameSnapshot ?? "—"} size="sm" />
              <ITText className="min-w-0 truncate !text-[15px] font-bold">
                {lastEvent.employeeNameSnapshot ?? "—"}
              </ITText>
              <ITBentoPill>
                {lastEvent.type === "ENTRY" ? <LuLogIn size={12} /> : <LuLogOut size={12} />}
                {tt(`types.${lastEvent.type}`)}
              </ITBentoPill>
              <ITBentoPill>{formatDateTime(lastEvent.occurredAt)}</ITBentoPill>
              {lastEvent.site?.name && <ITBentoPill>{lastEvent.site.name}</ITBentoPill>}
            </ITFlex>
          ) : (
            <ITText muted className="min-w-0 flex-1 !text-[13px]">
              {tt("live.none")}
            </ITText>
          )}
        </ITFlex>
      </ITCard>

      <ITBentoStatStrip
        items={summaryItems.map((item) => ({
          id: item.id,
          label: item.label,
          value: <Num value={Number(item.value)} />,
          tone: (item.tone ?? "plain") as "plain" | "sea" | "lavender" | "mint" | "sun",
        }))}
        activeId={activeSummary}
        onSelect={selectSummary}
      />

      {/* Filtros y tabla en una sola tarjeta */}
      <PanelCard title={tt("toolbar.title")} icon={<LuFilter size={16} />}>
        <ITFlex direction="column" gap={3}>
          <ITFlex align="center" wrap="wrap" gap={2}>
            <ITText className="text-[12px] font-semibold text-slate-400">
              {tt("presets.title")}
            </ITText>
            <FilterPills items={presetItems} value={preset as RangePreset} onChange={applyRange} />
            <ITButton variant="text" color="gray" size="sm" onClick={clearFilters} className="ml-auto">
              <ITFlex align="center" gap={1}>
                <LuRotateCcw size={12} />
                <ITText className="font-bold text-[11px]">{tt("filters.clear")}</ITText>
              </ITFlex>
            </ITButton>
          </ITFlex>

          <ITGrid container columns={12} spacing={4}>
            <ITGrid item xs={12} md={4}>
              <ITDatePicker
                name="accessDateRange"
                label={tt("filters.dateRange")}
                range
                value={dateRange}
                onChange={handleDateRange}
                className="w-full min-w-0"
              />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput
                name="accessEmployee"
                label={tt("filters.employee")}
                placeholder={tt("filters.employeePlaceholder")}
                value={employeeQuery}
                onChange={(e) => setEmployeeQuery(e.target.value)}
                className="w-full min-w-0"
              />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITSearchSelect
                name="accessType"
                label={tt("filters.type")}
                options={[
                  { value: "", label: tt("filters.allTypes") },
                  { value: "ENTRY", label: tt("types.ENTRY") },
                  { value: "EXIT", label: tt("types.EXIT") },
                ]}
                value={typeFilter}
                onChange={(value) => setTypeFilter(String(value))}
                className="w-full min-w-0"
              />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITFlex align="end" className="h-full pb-2">
                <ITCheckbox
                  name="accessIncludeVoided"
                  label={tt("filters.includeVoided")}
                  checked={includeVoided}
                  onChange={setIncludeVoided}
                />
              </ITFlex>
            </ITGrid>
          </ITGrid>
        </ITFlex>
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
        onRowClick={(row) => void openDetail(row as unknown as AccessEvent)}
        defaultItemsPerPage={25}
        itemsPerPageOptions={[25, 50, 100]}
        layout="fixed"
        density="compact"
        rowHeight={50}
        virtualized
        virtualizedMaxHeight={460}
      />
      </PanelCard>

      <ITDialog
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        className="w-full !max-w-3xl"
      >
        {detailError && (
          <ITAlert variant="error" dismissible onDismiss={() => setDetailError(null)}>
            {detailError}
          </ITAlert>
        )}
        {detail && (
          <div style={{ minWidth: "100%" }}>
            {/* Encabezado héroe */}
            <div className="mb-5 flex items-center gap-3 pr-8">
              <ProfileAvatar name={detail.employeeNameSnapshot ?? "—"} size="lg" />
              <ITFlex className="min-w-0">
                <ITText as="h2" className="m-0 truncate !text-[18px] font-bold leading-tight !text-slate-800">
                  {detail.employeeNameSnapshot ?? "—"}
                </ITText>
                <ITFlex align="center" wrap="wrap" gap={2} className="mt-1">
                  <ITBadget color={TYPE_COLOR[detail.type]} size="lg">
                    {tt(`types.${detail.type}`)}
                  </ITBadget>
                  <ITBadget color={detail.voidedAt ? "danger" : "success"} size="lg">
                    {detail.voidedAt ? tt("status.voided") : tt("status.active")}
                  </ITBadget>
                  <ITText as="span" className="text-xs text-slate-500">
                    {formatDateTime(detail.occurredAt)}
                    {detail.employeeNumberSnapshot ? ` · #${detail.employeeNumberSnapshot}` : ""}
                  </ITText>
                </ITFlex>
              </ITFlex>
            </div>

            {/* Cuerpo */}
            <div className="overflow-y-auto pr-1" style={{ maxHeight: "min(60vh, 560px)" }}>
              <ITGrid container columns={12} spacing={4}>
                {detail.latitude != null && detail.longitude != null && (
                  <ITGrid item xs={12}>
                    <LocationMap
                      latitude={detail.latitude}
                      longitude={detail.longitude}
                      caption={tt("detail.map")}
                      linkLabel={tt("detail.viewOnMap")}
                    />
                  </ITGrid>
                )}
                <ITGrid item xs={12} md={6}>
                  <DetailRow label={tt("detail.site")} value={detail.site?.name ?? "—"} />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow label={tt("detail.guard")} value={detail.guard?.name ?? "—"} />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.deviceTimestamp")}
                    value={detail.deviceTimestamp ? formatDateTime(detail.deviceTimestamp) : "—"}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.locationSource")}
                    value={tt(`locationSources.${detail.locationSource}`)}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow label={tt("detail.method")} value={tt(`methods.${detail.method}`)} />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.accuracy")}
                    value={detail.gpsAccuracyMeters != null ? `${detail.gpsAccuracyMeters} m` : "—"}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.coordinates")}
                    value={formatCoords(detail.latitude, detail.longitude) || tt("coordinates.none")}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.credentialVersion")}
                    value={detail.credentialVersion != null ? String(detail.credentialVersion) : "—"}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.device")}
                    value={[detail.deviceId, detail.deviceCode].filter(Boolean).join(" · ") || "—"}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow label={tt("detail.clientEventId")} value={detail.clientEventId ?? "—"} />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow
                    label={tt("detail.createdAt")}
                    value={formatDateTime(detail.createdAt)}
                  />
                </ITGrid>
                <ITGrid item xs={12} md={6}>
                  <DetailRow label={tt("detail.notes")} value={detail.notes ?? "—"} />
                </ITGrid>
                {detail.voidedAt && (
                  <>
                    <ITGrid item xs={12} md={6}>
                      <DetailRow label={tt("detail.voidReason")} value={detail.voidReason ?? "—"} />
                    </ITGrid>
                    <ITGrid item xs={12} md={6}>
                      <DetailRow
                        label={tt("detail.voidedAt")}
                        value={formatDateTime(detail.voidedAt)}
                      />
                    </ITGrid>
                  </>
                )}
              </ITGrid>
            </div>

            {/* Footer */}
            <ITFlex justify="end" gap={2} className="mt-5">
              {canVoid && !detail.voidedAt && (
                <ITButton
                  variant="outlined"
                  color="danger"
                  onClick={() => {
                    openVoid(detail);
                    setDetail(null);
                  }}
                >
                  <ITFlex align="center" gap={1}>
                    <LuBan size={13} />
                    <ITText className="font-bold text-[11px]">{tt("actions.void")}</ITText>
                  </ITFlex>
                </ITButton>
              )}
              <ITButton variant="filled" color="primary" onClick={() => setDetail(null)}>
                <ITText className="font-bold text-[11px]">{tt("actions.close")}</ITText>
              </ITButton>
            </ITFlex>
          </div>
        )}
      </ITDialog>

      <ITDialog
        isOpen={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        className="max-w-md"
      >
        <DialogHeader icon={<LuBan />} tone="danger" title={tt("void.title")} subtitle={tt("void.subtitle")} />
        <ITFlex direction="column" gap={3}>
          <ITText className="text-[12px] text-slate-600">{tt("void.message")}</ITText>
          <ITTextarea
            name="voidReason"
            label={tt("void.reasonLabel")}
            placeholder={tt("void.reasonPlaceholder")}
            value={voidReason}
            onChange={setVoidReason}
            rows={3}
            maxLength={500}
            error={voidError ?? undefined}
          />
          <ITFlex justify="end" gap={2}>
            <ITButton variant="outlined" color="secondary" onClick={() => setVoidTarget(null)}>
              {tt("void.cancel")}
            </ITButton>
            <ITButton
              variant="filled"
              color="danger"
              disabled={voidSaving}
              onClick={() => void confirmVoid()}
            >
              {tt("void.confirm")}
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      {toast && (
        <ITToast
          message={toast}
          type="success"
          position="top-right"
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </ITPage>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <ITFlex direction="column" gap={1} className="rounded-2xl bg-[color-mix(in_srgb,currentColor_5%,transparent)] px-3.5 py-2.5">
      <ITText className="text-xs text-slate-500">{label}</ITText>
      <ITText className="text-sm font-semibold text-slate-800 break-words">{value}</ITText>
    </ITFlex>
  );
}
