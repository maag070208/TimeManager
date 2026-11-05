import { useMemo, useState } from "react";
import {
  ITBentoGrid,
  ITBentoTile,
  ITButton,
  ITInput, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import {
  LuBuilding2,
  LuCircleCheck,
  LuCirclePause,
  LuEye,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Department } from "@entities/department";
import { Num } from "@shared/ui/bento-bits";
import { FilterPills, type FilterPillItem } from "@shared/ui/filter-pills";
import { LangostinState } from "@shared/ui/langostin";
import { ListSummaryStrip, type ListSummaryItem } from "@shared/ui/list-summary-strip";

type StatusFilter = "all" | "active" | "inactive" | "staffed";
type AreasFilter = "any" | "with" | "without";

interface Props {
  /** Catálogo completo (activos e inactivos); `null` mientras carga. */
  departments: Department[] | null;
  failed: boolean;
  canManage: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onView: (d: Department) => void;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
}

const peopleOf = (d: Department) => d._count?.users ?? 0;

/** Chip pastel del estado del departamento (verde activo, tenue inactivo). */
function StatusChip({ active, label }: { active: boolean; label: string }) {
  return (
    <ITText as="span"
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: active
          ? "color-mix(in srgb, var(--color-success) 14%, transparent)"
          : "color-mix(in srgb, var(--it-bento-muted) 12%, transparent)",
        color: active ? "var(--color-success)" : "var(--it-bento-muted)",
      }}
    >
      {label}
    </ITText>
  );
}

/**
 * Catálogo de departamentos como rejilla de mosaicos (plantilla P7): cada
 * tarjeta lleva el nombre, sus áreas, el número de personas y el estado; el
 * alta aparece como tarjeta punteada. La franja superior resume totales reales
 * y filtra al hacer clic; los filtros de área y el buscador afinan la rejilla.
 */
export default function DepartmentsCatalog({
  departments,
  failed,
  canManage,
  onRetry,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation(["departments", "common"]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [areas, setAreas] = useState<AreasFilter>("any");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => departments ?? [], [departments]);

  const totals = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((d) => d.active).length,
      inactive: rows.filter((d) => !d.active).length,
      staffed: rows.filter((d) => peopleOf(d) > 0).length,
      withAreas: rows.filter((d) => d.subareas.length > 0).length,
      people: rows.reduce((acc, d) => acc + peopleOf(d), 0),
    };
  }, [rows]);

  const summary = useMemo<ListSummaryItem[]>(
    () => [
      {
        id: "all",
        label: t("list.summaryTotal"),
        value: <Num value={totals.total} />,
        tone: "sea",
        icon: <LuBuilding2 size={15} />,
        caption: t("list.summaryTotalCaption", { count: totals.people }),
      },
      {
        id: "active",
        label: t("list.summaryActive"),
        value: <Num value={totals.active} />,
        tone: "mint",
        icon: <LuCircleCheck size={15} />,
        caption: t("list.summaryActiveCaption"),
      },
      {
        id: "inactive",
        label: t("list.summaryInactive"),
        value: <Num value={totals.inactive} />,
        icon: <LuCirclePause size={15} />,
        caption: t("list.summaryInactiveCaption"),
      },
      {
        id: "staffed",
        label: t("list.summaryStaffed"),
        value: <Num value={totals.staffed} />,
        tone: "lavender",
        icon: <LuUsers size={15} />,
        caption: t("list.summaryStaffedCaption"),
      },
    ],
    [t, totals]
  );

  const areaFilters: FilterPillItem<AreasFilter>[] = [
    { id: "any", label: t("list.areasFilterAny"), count: totals.total },
    { id: "with", label: t("list.areasFilterWith"), count: totals.withAreas },
    { id: "without", label: t("list.noAreas"), count: totals.total - totals.withAreas },
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((d) => {
      if (status === "active" && !d.active) return false;
      if (status === "inactive" && d.active) return false;
      if (status === "staffed" && peopleOf(d) === 0) return false;
      if (areas === "with" && d.subareas.length === 0) return false;
      if (areas === "without" && d.subareas.length > 0) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.subareas.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [rows, status, areas, query]);

  const resetFilters = () => {
    setStatus("all");
    setAreas("any");
    setQuery("");
  };

  const createButton = (
    <ITButton variant="filled" color="primary" onClick={onCreate}>
      <ITText as="span" className="flex items-center gap-1.5 text-[11px] font-bold">
        <LuPlus size={12} />
        {t("list.new")}
      </ITText>
    </ITButton>
  );

  if (failed) {
    return (
      <LangostinState
        kind="error"
        description={t("common:errors.load")}
        action={
          <ITButton variant="outlined" color="primary" onClick={onRetry}>
            <ITText as="span" className="text-[11px] font-bold">{t("list.retry")}</ITText>
          </ITButton>
        }
      />
    );
  }

  if (departments === null) return <LangostinState kind="loading" />;

  if (rows.length === 0) {
    return (
      <LangostinState
        kind="empty"
        title={t("list.emptyTitle")}
        description={t("list.emptyHint")}
        action={canManage ? createButton : undefined}
      />
    );
  }

  return (
    <ITStack spacing={4}>
      {/* Totales reales del catálogo; el mosaico elegido filtra la rejilla. */}
      <ListSummaryStrip
        items={summary}
        activeId={status}
        onSelect={(id) => setStatus(id as StatusFilter)}
      />

      {/* Búsqueda por nombre o área + filtro por áreas */}
      <ITFlex align="center" wrap="wrap" gap={2}>
        <div className="min-w-[220px] flex-1">
          <ITInput
            name="departments_search"
            size="sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("list.searchPlaceholder")}
            iconLeft={<LuSearch size={12} />}
          />
        </div>
        <FilterPills
          items={areaFilters}
          value={areas}
          onChange={setAreas}
          className="max-w-full overflow-x-auto"
        />
      </ITFlex>

      {visible.length === 0 ? (
        <LangostinState
          kind="noResults"
          title={t("list.noResultsTitle")}
          description={t("list.noResultsHint")}
          action={
            <ITButton variant="outlined" color="secondary" onClick={resetFilters}>
              <ITText as="span" className="text-[11px] font-bold">{t("list.clearFilters")}</ITText>
            </ITButton>
          }
        />
      ) : (
        <ITBentoGrid>
          {visible.map((d) => {
            const areasText =
              d.subareas.length === 0
                ? t("list.noAreas")
                : `${t("list.areasLabel")}: ${d.subareas.map((s) => s.name).join(" · ")}`;

            return (
              <ITBentoTile
                key={d.id}
                cols={4}
                rows={2}
                icon={<LuBuilding2 size={15} />}
                label={
                  <button
                    type="button"
                    onClick={() => onView(d)}
                    title={d.name}
                    className="min-w-0 cursor-pointer truncate text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {d.name}
                  </button>
                }
                value={<Num value={peopleOf(d)} />}
                caption={t("list.people", { count: peopleOf(d) })}
                aside={
                  <StatusChip
                    active={d.active}
                    label={d.active ? t("detail.active") : t("detail.inactive")}
                  />
                }
              >
                <div className="mt-2 flex min-w-0 flex-1 flex-col gap-2">
                  <ITText
                    className="m-0 truncate text-[12px]"
                    style={{ color: "var(--it-bento-muted)" }}
                    title={areasText}
                  >
                    {areasText}
                  </ITText>
                  <div className="mt-auto flex items-center justify-end gap-1.5">
                    <ITButton
                      variant="icon-only"
                      color="secondary"
                      size="sm"
                      icon={<LuEye size={13} />}
                      onClick={() => onView(d)}
                      ariaLabel={t("common:actions.view")}
                      title={t("common:actions.view")}
                    />
                    {canManage && (
                      <ITButton
                        variant="icon-only"
                        color="secondary"
                        size="sm"
                        icon={<LuPencil size={12} />}
                        onClick={() => onEdit(d)}
                        ariaLabel={t("list.editName")}
                        title={t("list.editName")}
                      />
                    )}
                    {canManage && (
                      <ITButton
                        variant="icon-only"
                        color="error"
                        size="sm"
                        icon={<LuTrash2 size={12} />}
                        onClick={() => onDelete(d)}
                        ariaLabel={t("list.delete")}
                        title={t("list.delete")}
                      />
                    )}
                  </div>
                </div>
              </ITBentoTile>
            );
          })}

          {/* Alta como tarjeta punteada, al final de la rejilla */}
          {canManage && (
            <button
              type="button"
              onClick={onCreate}
              className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-1.5 !p-5 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              style={{
                gridColumn: "1 / -1",
                gridRow: "span 2",
                backgroundColor: "transparent",
                border: "2px dashed color-mix(in srgb, var(--color-slate-400) 55%, transparent)",
                borderRadius: 20,
              }}
            >
              <ITText as="span"
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--color-primary-500) 12%, transparent)",
                  color: "var(--color-primary-500)",
                }}
              >
                <LuPlus size={18} />
              </ITText>
              <ITText as="span" className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {t("list.addCard")}
              </ITText>
              <ITText as="span" className="text-[11.5px] text-slate-500 dark:text-slate-400">
                {t("list.addCardHint")}
              </ITText>
            </button>
          )}
        </ITBentoGrid>
      )}
    </ITStack>
  );
}
