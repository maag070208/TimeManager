import { useMemo, useState } from "react";
import { ITButton, ITCard, ITFlex, ITInput, ITSegmentedControl, ITSlideToggle, ITStack, ITText } from "@axzydev/axzy_ui_system";
import { FaChevronDown, FaChevronRight, FaLock, FaSearch } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { PermissionCatalog } from "@entities/permission";
import {
  groupByModule,
  isScopedPermission,
  matchesPermission,
  moduleCoverage,
  moduleLevel,
} from "../../model/access-levels";
import { isLockedCell, type BulkMode, type RolesAdminState } from "../../model/useRolesAdmin";
import { AccessLevelBadge, CoverageBar } from "../shared/AccessLevel";
import { ScopePicker } from "../shared/Scope";
import VerbIcon from "../shared/VerbIcon";

type Filter = "all" | "granted" | "missing" | "sensitive";

interface Props {
  admin: RolesAdminState;
  role: string;
}

/**
 * Lo que puede hacer un rol, como acordeón por módulo: cerrado muestra el nivel
 * (Completo / Parcial / Solo lectura / Sin acceso); abierto, cada permiso con
 * su interruptor, su alcance y las acciones masivas del módulo.
 */
export default function RolePermissionsEditor({ admin, role }: Props) {
  const { t } = useTranslation("roles");
  const { data, scopeOf, savedScopeOf, toggle, setScope, setMany, saving } = admin;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByModule(data?.catalog ?? []), [data]);
  // Buscando o filtrando, se abren los módulos que tienen coincidencias.
  const searching = query.trim() !== "" || filter !== "all";

  const visibleGroups = useMemo(
    () =>
      groups
        .map(([module, permissions]) => ({
          module,
          permissions,
          rows: permissions.filter((permission) => {
            if (!matchesPermission(permission, query)) return false;
            const granted = scopeOf(role, permission.key) !== "NONE";
            if (filter === "granted") return granted;
            if (filter === "missing") return !granted;
            if (filter === "sensitive") return permission.sensitive;
            return true;
          }),
        }))
        .filter((group) => group.rows.length > 0),
    [groups, query, filter, scopeOf, role]
  );

  const allOpen = visibleGroups.every((group) => expanded.has(group.module));
  const toggleModule = (module: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });

  const bulkButton = (permissions: PermissionCatalog[], mode: BulkMode) => (
    <ITButton variant="text" color="secondary" size="sm" disabled={saving} onClick={() => setMany(role, permissions, mode)}>
      <ITText className="text-[10px] font-bold">{t(`bulk.${mode}`)}</ITText>
    </ITButton>
  );

  return (
    <ITStack spacing={2}>
      <ITFlex align="center" wrap="wrap" gap={2}>
        <div className="w-full max-w-[260px]">
          <ITInput
            name="role_permission_search"
            size="sm"
            placeholder={t("matrix.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            iconLeft={<FaSearch size={11} />}
          />
        </div>
        {/* Filtros y “Abrir todos” a la derecha, separados de la búsqueda */}
        <ITFlex align="center" gap={2} className="ml-auto">
          <ITSegmentedControl
            size="sm"
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
            options={(["all", "granted", "missing", "sensitive"] as const).map((value) => ({
              value,
              label: t(`editor.filter.${value}`),
            }))}
          />
          {!searching && (
            <ITButton
              variant="text"
              color="primary"
              size="sm"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(visibleGroups.map((group) => group.module)))}
            >
              <ITText className="text-[11px] font-bold">
                {allOpen ? t("editor.collapseAll") : t("editor.expandAll")}
              </ITText>
            </ITButton>
          )}
        </ITFlex>
      </ITFlex>

      {visibleGroups.length === 0 ? (
        <ITText className="py-8 text-center text-[12px] italic text-slate-400">{t("matrix.noResults")}</ITText>
      ) : (
        <ITCard contentClassName="!p-0">
          {visibleGroups.map(({ module, permissions, rows }, groupIndex) => {
            const scope = (key: string) => scopeOf(role, key);
            const level = moduleLevel(permissions, scope);
            const coverage = moduleCoverage(permissions, scope);
            const open = searching || expanded.has(module);
            const pending = permissions.some((permission) => scope(permission.key) !== savedScopeOf(role, permission.key));
            return (
              <div key={module} className={groupIndex > 0 ? "border-t border-slate-200" : ""}>
                <div
                  className={`flex flex-wrap items-center gap-2 px-3 py-2 ${open ? "bg-slate-50" : "bg-[var(--it-card-bg)] hover:bg-slate-50/70"}`}
                >
                  <ITFlex
                    as="button"
                    align="center"
                    gap={2}
                    className="min-w-[160px] flex-1 text-left"
                    onClick={() => toggleModule(module)}
                  >
                    {open ? (
                      <FaChevronDown size={9} className="shrink-0 text-slate-400" />
                    ) : (
                      <FaChevronRight size={9} className="shrink-0 text-slate-400" />
                    )}
                    <ITText as="span" className="text-[12px] font-bold text-slate-800">{module}</ITText>
                    {pending && (
                      <ITText
                        as="span"
                        aria-label={t("editor.unsaved")}
                        title={t("editor.unsaved")}
                        className="h-1.5 w-1.5 rounded-full bg-amber-500"
                      />
                    )}
                  </ITFlex>
                  {open && (
                    <ITText as="span" className="flex items-center gap-1">
                      {bulkButton(permissions, "all")}
                      {bulkButton(permissions, "read")}
                      {bulkButton(permissions, "none")}
                    </ITText>
                  )}
                  <ITText as="span" className="w-28">
                    <AccessLevelBadge level={level} />
                  </ITText>
                  <CoverageBar granted={coverage.granted} total={coverage.total} level={level} className="w-24" />
                </div>

                {open &&
                  rows.map((permission) => {
                    const value = scope(permission.key);
                    const granted = value !== "NONE";
                    const locked = isLockedCell(role, permission.key);
                    const changed = value !== savedScopeOf(role, permission.key);
                    const disabled = !permission.active || saving || locked;
                    return (
                      <div
                        key={permission.key}
                        title={permission.description ?? undefined}
                        className={`flex flex-wrap items-center gap-2 border-t border-slate-100 py-1.5 pl-8 pr-3 ${
                          permission.active ? "" : "opacity-60"
                        }`}
                      >
                        <VerbIcon permissionKey={permission.key} />
                        <div className="flex min-w-[180px] flex-1 flex-wrap items-baseline gap-x-2">
                          <ITText as="span" className={`text-[12px] font-semibold ${granted ? "text-slate-800" : "text-slate-500"}`}>
                            {permission.name}
                          </ITText>
                          <ITText as="span" className="font-mono text-[10px] text-slate-400">{permission.key}</ITText>
                          {permission.sensitive && <FaLock size={8} className="text-amber-500" title={t("matrix.sensitive")} />}
                          {!permission.active && (
                          <ITText as="span" className="text-[12px] font-semibold text-rose-500">{t("matrix.inactive")}</ITText>
                          )}
                          {changed && (
                            <ITText
                              as="span"
                              aria-label={t("editor.unsaved")}
                              title={t("editor.unsaved")}
                              className="h-1.5 w-1.5 self-center rounded-full bg-amber-500"
                            />
                          )}
                        </div>
                        {granted && isScopedPermission(permission) && (
                          <ScopePicker
                            permission={permission}
                            value={value}
                            disabled={disabled}
                            onChange={(next) => setScope(role, permission.key, next)}
                          />
                        )}
                        <ITText as="span" title={locked ? t("matrix.adminLocked") : undefined}>
                          <ITSlideToggle
                            size="sm"
                            activeColor="var(--color-primary)"
                            isOn={granted}
                            disabled={disabled}
                            onToggle={() => toggle(role, permission.key)}
                          />
                        </ITText>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </ITCard>
      )}
    </ITStack>
  );
}
