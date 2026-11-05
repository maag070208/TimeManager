import { Fragment, useMemo, useState } from "react";
import { ITCheckbox, ITInput, ITSelect, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import { FaChevronDown, FaChevronRight, FaLock, FaSearch } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { PermissionCatalog } from "@entities/permission";
import { roleLabel, type PermissionScope } from "@entities/user";
import {
  grantableScopes,
  groupByModule,
  isScopedPermission,
  matchesPermission,
  moduleCoverage,
  moduleLevel,
} from "../../model/access-levels";
import { isLockedCell, type RolesAdminState } from "../../model/useRolesAdmin";
import { levelBarClass, ROLE_TONES, roleTone, scopeCellClass, scopeGlyph } from "../shared/tokens";

interface Props {
  admin: RolesAdminState;
  onOpenRole: (role: string) => void;
}

/** Siguiente alcance al hacer clic: Ninguno → Propio → Área → Todo → Ninguno (según lo que admita). */
const nextScope = (permission: PermissionCatalog, current: PermissionScope): PermissionScope => {
  const cycle: PermissionScope[] = ["NONE", ...grantableScopes(permission)];
  return cycle[(cycle.indexOf(current) + 1) % cycle.length];
};

/**
 * Matriz comparativa rol × permiso. Comparte el borrador con la pestaña Roles:
 * un clic en una celda concede, sube el alcance o quita el permiso.
 */
export default function PermissionMatrixPanel({ admin, onOpenRole }: Props) {
  const { t } = useTranslation("roles");
  const { data, scopeOf, savedScopeOf, setScope, saving, rolesMeta } = admin;
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByModule(data?.catalog ?? []), [data]);
  const allRoles = data?.roles ?? [];
  const roles = allRoles.filter((role) => !hidden.has(role));

  const rows = useMemo(
    () =>
      groups
        .filter(([module]) => !moduleFilter || module === moduleFilter)
        .map(([module, permissions]) => ({
          module,
          permissions,
          rows: permissions.filter((permission) => {
            if (!matchesPermission(permission, query)) return false;
            if (!onlyDiff) return true;
            const scopes = new Set(roles.map((role) => scopeOf(role, permission.key)));
            return scopes.size > 1;
          }),
        }))
        .filter((group) => group.rows.length > 0),
    [groups, moduleFilter, query, onlyDiff, roles, scopeOf]
  );

  const toggleHidden = (role: string) =>
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(role)) next.delete(role);
      else if (roles.length > 1) next.add(role);
      return next;
    });

  const toggleCollapsed = (module: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });

  return (
    <ITStack spacing={2}>
      <ITFlex align="center" wrap="wrap" gap={2}>
        <div className="w-full max-w-[240px]">
          <ITInput
            name="matrix_search"
            size="sm"
            placeholder={t("matrix.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            iconLeft={<FaSearch size={11} />}
          />
        </div>
        <div className="w-48">
          <ITSelect
            name="matrix_module"
            size="sm"
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            options={[
              { value: "", label: t("matrixView.allModules") },
              ...groups.map(([module]) => ({ value: module, label: module })),
            ]}
          />
        </div>
        <ITCheckbox
          name="matrix_only_diff"
          checked={onlyDiff}
          onChange={(checked) => setOnlyDiff(checked)}
          label={t("matrixView.onlyDiff")}
        />
        <ITText as="span" className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          {(
            [
              ["✓", "ALL", t("matrixView.legend.yes")],
              ["P", "OWN", t("scope.OWN")],
              ["A", "AREA", t("scope.AREA")],
              ["T", "ALL", t("scope.ALL")],
            ] as const
          ).map(([glyph, scope, label]) => (
            <ITText as="span" key={label} className="inline-flex items-center gap-1">
              <ITText as="span" className={`flex h-4 w-5 items-center justify-center rounded text-[9px] font-black ${scopeCellClass(scope)}`}>
                {glyph}
              </ITText>
              {label}
            </ITText>
          ))}
        </ITText>
      </ITFlex>
      <ITFlex align="center" wrap="wrap" gap={1}>
        {allRoles.map((role) => {
          const off = hidden.has(role);
          const tone = ROLE_TONES[roleTone(role)];
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleHidden(role)}
              title={t("matrixView.toggleRole")}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-bold transition ${
                off ? "border-slate-200 !bg-slate-50 text-slate-400 line-through" : "border-slate-300 !bg-[var(--it-card-bg)] text-slate-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${off ? "bg-slate-300" : tone.dot}`} />
              {roleLabel(role)}
            </button>
          );
        })}
        <ITText as="span" className="ml-auto text-[10px] italic text-slate-400">{t("matrixView.hint")}</ITText>
      </ITFlex>

      <div className="max-h-[72vh] overflow-auto rounded-lg border border-slate-200 bg-[var(--it-card-bg)]">
        <table className="min-w-full border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[240px] border-b border-r border-slate-200 bg-[var(--it-card-bg)] px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                {t("matrix.permission")}
              </th>
              {roles.map((role) => {
                const meta = rolesMeta.find((item) => item.key === role);
                return (
                  <th
                    key={role}
                    className="sticky top-0 z-20 min-w-[72px] border-b border-slate-200 bg-[var(--it-card-bg)] px-1 py-1.5 align-bottom"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenRole(role)}
                      className="flex w-full flex-col items-center gap-0.5 rounded-md !bg-transparent px-1 py-0.5 hover:!bg-slate-50"
                      title={t("matrixView.openRole")}
                    >
                      <span className={`h-2 w-2 rounded-full ${ROLE_TONES[roleTone(role)].dot}`} />
                      <ITText as="span" className={`text-center text-[10px] font-black leading-tight ${meta?.active === false ? "text-slate-400" : "text-slate-700"}`}>
                        {roleLabel(role)}
                      </ITText>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={roles.length + 1} className="py-10 text-center text-[12px] italic text-slate-400">
                  {t("matrix.noResults")}
                </td>
              </tr>
            )}
            {rows.map(({ module, permissions, rows: visibleRows }) => {
              const isCollapsed = collapsed.has(module);
              return (
                <Fragment key={module}>
                  <tr>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(module)}
                        className="flex w-full items-center gap-2 !bg-transparent text-left"
                      >
                        {isCollapsed ? <FaChevronRight size={9} className="text-slate-400" /> : <FaChevronDown size={9} className="text-slate-400" />}
                        <ITText as="span" className="text-[12px] font-semibold text-slate-600">{module}</ITText>
                        <ITText as="span" className="text-[10px] text-slate-400">{permissions.length}</ITText>
                      </button>
                    </td>
                    {roles.map((role) => {
                      const scope = (key: string) => scopeOf(role, key);
                      const level = moduleLevel(permissions, scope);
                      const coverage = moduleCoverage(permissions, scope);
                      const percent = coverage.total ? (coverage.granted / coverage.total) * 100 : 0;
                      return (
                        <td key={role} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5" title={t(`level.${level}`)}>
                          <ITText as="span" className="block h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <span className={`block h-full rounded-full ${levelBarClass(level)}`} style={{ width: `${percent}%` }} />
                          </ITText>
                        </td>
                      );
                    })}
                  </tr>
                  {!isCollapsed &&
                    visibleRows.map((permission) => (
                      <tr key={permission.key} className="group">
                        <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-[var(--it-card-bg)] px-3 py-1 group-hover:bg-slate-50">
                          <ITFlex align="center" gap={1.5}>
                            <ITText as="span" title={permission.key} className={`text-[12px] font-semibold ${permission.active ? "text-slate-700" : "text-slate-400 line-through"}`}>
                              {permission.name}
                            </ITText>
                            {permission.sensitive && <FaLock size={8} className="text-amber-500" title={t("matrix.sensitive")} />}
                          </ITFlex>
                        </td>
                        {roles.map((role) => {
                          const value = scopeOf(role, permission.key);
                          const changed = value !== savedScopeOf(role, permission.key);
                          const locked = isLockedCell(role, permission.key);
                          const disabled = locked || saving || !permission.active;
                          return (
                            <td key={role} className="border-b border-slate-100 px-1 py-1 text-center group-hover:bg-slate-50/60">
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => setScope(role, permission.key, nextScope(permission, value))}
                                title={`${roleLabel(role)} · ${permission.name}: ${
                                  value === "NONE" ? t("scopePlain.NONE") : isScopedPermission(permission) ? t(`scopePlain.${value}`) : t("matrix.granted")
                                }${locked ? ` — ${t("matrix.adminLocked")}` : ""}`}
                                className={`mx-auto flex h-6 w-8 items-center justify-center rounded text-[10px] font-black transition ${scopeCellClass(value)} ${
                                  changed ? "ring-2 ring-amber-400" : ""
                                } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                              >
                                {locked ? <FaLock size={9} /> : scopeGlyph(value, isScopedPermission(permission))}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </ITStack>
  );
}
