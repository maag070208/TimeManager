import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ITBentoPill,
  ITBentoStatStrip,
  ITConfirmDialog,
  ITDataTable,
  ITFlex,
  ITInput,
  ITStack,
  ITText,
} from "@axzydev/axzy_ui_system";
import type { Column, ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuCalendarDays, LuPencil, LuSearch, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { scheduleApi, type Schedule, type ScheduleDay } from "@entities/schedule";
import { LangostinState } from "@shared/ui/langostin";
import { FilterPills } from "@shared/ui/filter-pills";
import { RowAction } from "@shared/ui/row-action";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { emitAppEvent, onAppEvent } from "@shared/lib/appEvents";
import { dateLocale } from "@shared/i18n";

type Filter = "all" | "active" | "inactive";

// Inicial de cada día (lunes = 1), en el idioma de la interfaz. 2024-01-01 fue lunes.
const dayAbbr = (weekday: number): string =>
  new Date(Date.UTC(2024, 0, weekday)).toLocaleDateString(dateLocale(), { weekday: "narrow", timeZone: "UTC" });

/** Minutos de una jornada, descontando comida y sumando el segundo tramo. */
function dayMinutes(d: ScheduleDay, mealBreakMin: number): number {
  if (d.restDay || !d.startTime || !d.endTime) return 0;
  const toMin = (v: string) => Number(v.split(":")[0]) * 60 + Number(v.split(":")[1]);
  const span = toMin(d.endTime) - toMin(d.startTime);
  const second = d.splitStartTime && d.splitEndTime ? toMin(d.splitEndTime) - toMin(d.splitStartTime) : 0;
  return Math.max(0, (span > 0 ? span : span + 1440) + second - mealBreakMin);
}

/** "08:00–16:00 · descanso 14:00–15:00" del primer día laborable. */
function daySummary(days: ScheduleDay[]): string {
  const first = [...days].sort((a, b) => a.weekday - b.weekday).find((d) => !d.restDay);
  if (!first?.startTime || !first.endTime) return "—";
  const split = first.splitStartTime && first.splitEndTime ? ` · ${first.splitStartTime}–${first.splitEndTime}` : "";
  return `${first.startTime}–${first.endTime}${split}`;
}

/**
 * Horarios como tablero de tarjetas (plantilla P7): cada horario es un mosaico
 * con su semana en barras (horas reales por día), sus reglas, cuántas personas
 * lo tienen asignado y las acciones de editar / dar de baja.
 */
export default function SchedulesBoard() {
  const { t } = useTranslation("schedules");
  const navigate = useNavigate();
  const [rows, setRows] = useState<Schedule[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toDeactivate, setToDeactivate] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [flashNew, setFlashNew] = useState(false);

  const load = () => {
    scheduleApi
      .list(true)
      .then((data) => {
        setRows(data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  };

  useEffect(load, []);

  // El bot da de alta un horario: la tabla recarga y la fila nueva destella.
  useEffect(
    () =>
      onAppEvent("schedule:created", () => {
        load();
        setFlashNew(true);
        window.setTimeout(() => setFlashNew(false), 2600);
      }),
    [],
  );

  // El bot cambió un horario: el renglón se refresca sin salir de la tabla.
  useEffect(() => onAppEvent("schedule:updated", () => load()), []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((h) => {
      if (filter === "active" && !h.active) return false;
      if (filter === "inactive" && h.active) return false;
      if (!q) return true;
      return h.name.toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      active: list.filter((h) => h.active).length,
      assigned: list.reduce((acc, h) => acc + (h.assigned ?? 0), 0),
    };
  }, [rows]);

  const toggleActive = async (h: Schedule) => {
    await scheduleApi.update(h.id, { active: !h.active });
    load();
  };

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    setSaving(true);
    try {
      await scheduleApi.update(toDeactivate.id, { active: false });
      load();
    } finally {
      setSaving(false);
      setToDeactivate(null);
    }
  };

  const fetchData = useMemo(() => {
    const fetch = makeClientTableFetch<Schedule>(() => Promise.resolve(visible), {
      name: { value: (h) => h.name, match: "text" },
      days: { value: (h) => h.days.filter((d) => !d.restDay).length },
      weekly: { value: (h) => Math.round(h.days.reduce((acc, d) => acc + dayMinutes(d, h.mealBreakMin), 0) / 60) },
      assigned: { value: (h) => h.assigned ?? 0 },
      rules: { value: (h) => daySummary(h.days), match: "text" },
      status: { value: (h) => (h.active ? t("active") : t("inactive")), match: "text" },
    });
    return (params: ITDataTableFetchParams) => fetch(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const weeklyOf = (h: Schedule) => Math.round(h.days.reduce((acc, d) => acc + dayMinutes(d, h.mealBreakMin), 0) / 60);

  const columns: Column<Schedule>[] = [
    {
      key: "name",
      label: t("columns.name"),
      type: "string",
      width: 240,
      render: (h) => (
        <ITFlex align="center" gap={2} className="min-w-0">
          <LuCalendarDays size={13} className="shrink-0 opacity-60" />
          <ITText className="truncate !text-[13px] font-semibold">{h.name}</ITText>
        </ITFlex>
      ),
    },
    {
      key: "days",
      label: t("columns.days"),
      type: "number",
      width: 100,
      render: (h) => (
        <ITText className="!text-[12.5px] tabular-nums">{h.days.filter((d) => !d.restDay).length}</ITText>
      ),
    },
    {
      key: "week",
      label: t("columns.week"),
      type: "string",
      width: 210,
      sortable: false,
      render: (h) => (
        <ITFlex align="center" gap={1}>
          {[...h.days]
            .sort((a, b) => a.weekday - b.weekday)
            .map((d) => {
              const worked = dayMinutes(d, h.mealBreakMin) > 0;
              return (
                <ITText
                  key={d.weekday}
                  as="span"
                  aria-label={d.restDay ? t("inactive") : undefined}
                  className="flex h-6 w-6 items-center justify-center rounded-md !text-[10.5px] font-bold"
                  style={{
                    background: worked
                      ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
                      : "color-mix(in srgb, currentColor 7%, transparent)",
                    color: worked ? "var(--color-primary)" : "var(--color-text-muted)",
                  }}
                >
                  {dayAbbr(d.weekday)}
                </ITText>
              );
            })}
        </ITFlex>
      ),
    },
    {
      key: "weekly",
      label: t("columns.weekly"),
      type: "number",
      width: 120,
      render: (h) => (
        <ITText className="!text-[12.5px] font-bold tabular-nums">{weeklyOf(h)} h</ITText>
      ),
    },
    {
      key: "rules",
      label: t("columns.rules"),
      type: "string",
      width: 300,
      render: (h) => (
        <ITText muted className="!text-[11.5px]">
          {daySummary(h.days)} · E{h.entryToleranceMin}/S{h.exitToleranceMin} · {t("meal")} {h.mealBreakMin} ·{" "}
          {t("minExtra")} {h.minOvertimeMin}
        </ITText>
      ),
    },
    {
      key: "assigned",
      label: t("columns.assigned"),
      type: "number",
      width: 110,
      render: (h) => (
        <ITBentoPill>
          <strong className="tabular-nums">{h.assigned ?? 0}</strong>
        </ITBentoPill>
      ),
    },
    {
      key: "status",
      label: t("columns.status"),
      type: "string",
      width: 110,
      render: (h) => (
        <ITText
          as="span"
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: h.active
              ? "color-mix(in srgb, var(--color-success) 14%, transparent)"
              : "color-mix(in srgb, var(--color-text-muted) 14%, transparent)",
            color: h.active ? "var(--color-success)" : "var(--color-text-muted)",
          }}
        >
          {h.active ? t("active") : t("inactive")}
        </ITText>
      ),
    },
    {
      key: "actions",
      label: "",
      type: "actions",
      width: 110,
      render: (h) => (
        <ITFlex align="center" gap={1.5}>
          <RowAction
            icon={<LuPencil size={12} />}
            label={t("edit")}
            tone="primary"
            onClick={() => emitAppEvent("schedule:edit", { id: h.id })}
          />
          <RowAction
            icon={<LuTrash2 size={12} />}
            label={h.active ? t("delete") : t("reactivate")}
            tone={h.active ? "error" : "success"}
            onClick={() => (h.active ? setToDeactivate(h) : void toggleActive(h))}
          />
        </ITFlex>
      ),
    },
  ];

  if (failed) return <LangostinState kind="error" />;
  if (!rows) return <LangostinState kind="loading" />;

  return (
    <ITStack spacing={4}>
      {/* Cifras del catálogo: una fila, clic = filtra */}
      <ITBentoStatStrip
        items={[
          { id: "total", label: t("summary.total"), value: totals.total, caption: t("summary.totalCaption"), tone: "sea" },
          { id: "active", label: t("summary.active"), value: totals.active, caption: t("summary.activeCaption"), tone: "mint" },
          { id: "assigned", label: t("summary.assigned"), value: totals.assigned, caption: t("summary.assignedCaption"), tone: "sun" },
        ]}
        activeId={filter === "all" ? "total" : filter === "active" ? "active" : undefined}
        onSelect={(id: string) => {
          if (id === "assigned") {
            navigate("/schedules/assign");
            return;
          }
          setFilter(id === "active" ? "active" : "all");
        }}
      />

      {/* Búsqueda y estado */}
      <ITFlex align="center" wrap="wrap" gap={2}>
        <ITFlex className="min-w-[240px] flex-1">
          <ITInput
            name="schedules_search"
            size="sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            iconLeft={<LuSearch size={12} />}
          />
        </ITFlex>
        <ITText muted className="!text-[12px] font-semibold tabular-nums">
          {t("count", { count: visible.length })}
        </ITText>
        <FilterPills
          items={[
            { id: "all" as const, label: t("filter.all") },
            { id: "active" as const, label: t("active") },
            { id: "inactive" as const, label: t("inactive") },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </ITFlex>

      <div className={flashNew ? "ticket-row-flash" : undefined}>
        <ITDataTable showViewToggle={false}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          fetchData={
            fetchData as unknown as (
              p: ITDataTableFetchParams
            ) => Promise<ITDataTableResponse<Record<string, unknown>>>
          }
          defaultItemsPerPage={25}
          itemsPerPageOptions={[25, 50, 100]}
          layout="fixed"
          density="compact"
          rowHeight={50}
          virtualized
          virtualizedMaxHeight={520}
        />
      </div>

      <ITConfirmDialog
        isOpen={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        onConfirm={() => void confirmDeactivate()}
        title={t("deactivateDialog.title")}
        message={t("deactivateDialog.message", { name: toDeactivate?.name ?? "" })}
        confirmLabel={t("deactivateDialog.confirm")}
        cancelLabel={t("cancel")}
        loading={saving}
      />
    </ITStack>
  );
}
