import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ITBentoPill,
  ITButton,
  ITConfirmDialog,
  ITDataTable,
  ITFlex,
  ITInput,
  ITStack,
  ITText,
} from "@axzydev/axzy_ui_system";
import type { Column, ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuCalendarCheck, LuCalendarDays, LuPencil, LuSearch, LuTrash2, LuUserMinus } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { scheduleApi, type Schedule, type ScheduleDay } from "@entities/schedule";
import { TicState } from "@shared/ui/tic";
import { BentoFilterCards } from "@shared/ui/bento-filter-cards";
import { HelpTip } from "@shared/ui/help-tip";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { emitAppEvent, onAppEvent } from "@shared/lib/appEvents";
import { dateLocale } from "@shared/i18n";
import { ContentSkeleton } from "@shared/ui/content-skeleton";

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

  // El bot (u otra pantalla) pide editar un horario: se abre el formulario. Se
  // navega con el router (que ya lleva el prefijo del cliente en local-first).
  useEffect(
    () => onAppEvent("schedule:edit", ({ id }) => navigate(`/schedules/${id}/edit`)),
    [navigate],
  );

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
      inactive: list.filter((h) => !h.active).length,
      assigned: list.reduce((acc, h) => acc + (h.assigned ?? 0), 0),
    };
  }, [rows]);

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    setSaving(true);
    try {
      await scheduleApi.update(toDeactivate.id, { active: !toDeactivate.active });
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
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const d = h.days.find((day) => day.weekday === weekday);
            const worked = d ? dayMinutes(d, h.mealBreakMin) > 0 : false;
            const overnight = !!d && !d.restDay && !!d.startTime && !!d.endTime && d.endTime < d.startTime;
            return (
              <ITText
                key={weekday}
                as="span"
                title={overnight ? "Turno que termina al día siguiente" : !worked ? t("inactive") : undefined}
                aria-label={overnight ? "Termina al día siguiente" : !worked ? t("inactive") : undefined}
                className={`relative flex h-6 items-center justify-center rounded-md !text-[10.5px] font-black ${overnight ? "w-8" : "w-6"}`}
                style={{
                  background: worked ? "#e6f7ee" : "#eef2f7",
                  color: worked ? "#0e9f6e" : "#94a3b8",
                }}
              >
                {dayAbbr(weekday)}
                {overnight && <span className="ml-0.5 text-[7px] font-black">+1</span>}
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
        <ITFlex align="center" gap={1}>
          <ITButton
            variant="outlined" className="tm-icon-button"
            color="secondary"
            size="sm"
            icon={<LuPencil size={12} />}
            ariaLabel={t("edit")}
            title={t("edit")}
            onClick={() => emitAppEvent("schedule:edit", { id: h.id })}
          />
          <ITButton
            variant="text"
            color={h.active ? "error" : "success"}
            size="sm"
            icon={h.active ? <LuTrash2 size={13} /> : <LuCalendarCheck size={13} />}
            ariaLabel={h.active ? t("delete") : t("reactivate")}
            title={h.active ? t("delete") : t("reactivate")}
            onClick={() => setToDeactivate(h)}
          />
        </ITFlex>
      ),
    },
  ];

  if (failed) return <TicState kind="error" />;
  if (!rows) return <ContentSkeleton />;

  return (
    <ITStack spacing={4}>
      <BentoFilterCards
        items={[
          {
            id: "all",
            label: t("summary.total"),
            value: totals.total,
            caption: `${t("summary.totalCaption")} · ${t("assigned", { count: totals.assigned })}`,
            icon: <LuCalendarDays size={14} />,
          },
          { id: "active", label: t("summary.active"), value: totals.active, caption: t("summary.activeCaption"), icon: <LuCalendarCheck size={14} /> },
          { id: "inactive", label: t("inactive"), value: totals.inactive, icon: <LuUserMinus size={14} /> },
        ]}
        activeId={filter}
        onSelect={(id: string) => setFilter(id as Filter)}
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
        <ITFlex align="center" gap={1}>
          <ITText muted className="!text-[11.5px] font-semibold">
            {t("sections.rules")}
          </ITText>
          <HelpTip text="Tolerancias y reglas: la entrada/salida tiene minutos de gracia antes de contar como retardo o salida anticipada; la comida se descuenta de la jornada y el mínimo de tiempo extra es lo que debe superarse para que cuente." />
        </ITFlex>
      </ITFlex>

      <div className={flashNew ? "ticket-row-flash" : undefined}>
        <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          fetchData={
            fetchData as unknown as (
              p: ITDataTableFetchParams
            ) => Promise<ITDataTableResponse<Record<string, unknown>>>
          }
          onRowClick={(row) => emitAppEvent("schedule:edit", { id: (row as unknown as Schedule).id })}
        />
      </div>

      <ITConfirmDialog
        isOpen={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        onConfirm={() => void confirmDeactivate()}
        title={toDeactivate?.active ? t("deactivateDialog.title") : t("activateDialog.title")}
        message={toDeactivate?.active ? t("deactivateDialog.message", { name: toDeactivate?.name ?? "" }) : t("activateDialog.message", { name: toDeactivate?.name ?? "" })}
        confirmLabel={toDeactivate?.active ? t("deactivateDialog.confirm") : t("activateDialog.confirm")}
        variant={toDeactivate?.active ? "warning" : "success"}
        cancelLabel={t("cancel")}
        loading={saving}
      />
    </ITStack>
  );
}
