import { useMemo, useState } from "react";
import { ITAlert, ITButton, ITCheckbox, ITConfirmDialog, ITDropdownMenu, ITInput, ITSelect, ITText, ITFlex } from "@axzydev/axzy_ui_system";
import type { ITDropdownMenuItem } from "@axzydev/axzy_ui_system";
import {
  FaBan,
  FaCheckCircle,
  FaChevronDown,
  FaExternalLinkAlt,
  FaGavel,
  FaPlus,
  FaSearch,
  FaTimes,
  FaUserSecret,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AccessPermissionView, PermissionCatalog, PermissionMap, PolicyAdmin } from "@entities/permission";
import { roleLabel, useCan, usersApi } from "@entities/user";
import { LottieLoader } from "@shared/ui/lottie-loader";
import { formatDate } from "@shared/i18n/format";
import { groupByModule, isScopedPermission, matchesPermission } from "../../model/access-levels";
import { matchesMember, memberRoles, type AccessMembersState } from "../../model/useAccessMembers";
import { isLockedCell, type RolesAdminState } from "../../model/useRolesAdmin";
import { useUserAccess } from "../../model/useUserAccess";
import { RoleChip } from "../shared/RoleAvatar";
import { ScopeChip } from "../shared/Scope";
import ScreensAccessList from "../shared/ScreensAccessList";
import SidebarPreview from "../shared/SidebarPreview";
import { TabBar } from "@shared/ui/tab-bar";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import ExceptionDialog from "./ExceptionDialog";

interface Props {
  admin: RolesAdminState;
  members: AccessMembersState;
  catalog: readonly PermissionCatalog[];
  roles: readonly string[];
  policies: readonly PolicyAdmin[];
  userId: string | null;
  onSelectUser: (userId: string) => void;
  /** Abre el probador con esta persona (y la acción, si se da). */
  onTest: (userId: string, permission?: string) => void;
  /** Cambia cuando se guarda la matriz o los roles de alguien: vuelve a pedir el acceso. */
  refreshKey: number;
  onOpenRole: (role: string) => void;
  notify: (message: string, type: "success" | "error") => void;
}

type View = "can" | "cannot" | "all";
type Section = "permissions" | "screens";

/**
 * Visor de acceso por persona, pensado como respuesta a "¿qué puede hacer?" y
 * "¿por qué no puede?": lista de lo que puede y lo que no, de dónde le viene
 * (rol o excepción) y cómo arreglarlo ahí mismo (dárselo a su rol, quitárselo
 * o una excepción solo para esa persona). Lo calcula la API con el mismo
 * resolvedor que aplican las rutas.
 */
export default function UserAccessExplorer({
  admin,
  members,
  catalog,
  roles,
  policies,
  userId,
  onSelectUser,
  onTest,
  refreshKey,
  onOpenRole,
  notify,
}: Props) {
  const { t } = useTranslation("roles");
  const navigate = useNavigate();
  const canExceptions = useCan("users.permissions");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [section, setSection] = useState<Section>("permissions");
  const [view, setView] = useState<View>("can");
  const [search, setSearch] = useState("");
  const [exception, setException] = useState<{ permission: PermissionCatalog; mode: "grant" | "revoke" } | null>(null);
  const [clearing, setClearing] = useState<PermissionCatalog | null>(null);
  const [removingRole, setRemovingRole] = useState<string | null>(null);
  const { access, loading, error, reload } = useUserAccess(userId, refreshKey);

  const list = members.members.filter(
    (member) =>
      (showInactive || member.active) &&
      (!roleFilter || memberRoles(member).includes(roleFilter)) &&
      matchesMember(member, query)
  );

  const byKey = useMemo(() => new Map((access?.permissions ?? []).map((row) => [row.key, row])), [access]);
  const effective = useMemo<PermissionMap>(() => {
    const map: PermissionMap = {};
    for (const row of access?.permissions ?? []) if (row.effective !== "NONE") map[row.key] = row.effective;
    return map;
  }, [access]);
  const active = useMemo(() => catalog.filter((permission) => permission.active), [catalog]);
  const ruledActions = useMemo(
    () => new Set(policies.filter((policy) => policy.active).map((policy) => policy.action)),
    [policies]
  );

  const personRoles = access ? access.roles.filter((role) => role.active).map((role) => role.key) : [];
  const firstName = access?.user.name.split(/\s+/)[0] ?? "";
  const peopleIn = (role: string) => admin.rolesMeta.find((item) => item.key === role)?.userCount ?? 0;
  const canCount = active.filter((permission) => byKey.get(permission.key)?.effective !== "NONE" && byKey.has(permission.key)).length;
  const searching = search.trim() !== "";

  const groups = useMemo(() => {
    return groupByModule(active)
      .map(([module, permissions]) => ({
        module,
        rows: permissions.filter((permission) => {
          const granted = (byKey.get(permission.key)?.effective ?? "NONE") !== "NONE";
          if (searching) return matchesPermission(permission, search);
          if (view === "can") return granted;
          if (view === "cannot") return !granted;
          return true;
        }),
      }))
      .filter((group) => group.rows.length > 0);
  }, [active, byKey, view, search, searching]);

  const pendingFor = (key: string) =>
    personRoles.some((role) => admin.scopeOf(role, key) !== admin.savedScopeOf(role, key));

  /** Opciones para dar o quitar el permiso, en palabras simples. */
  const fixItems = (row: AccessPermissionView, permission: PermissionCatalog): ITDropdownMenuItem[] => {
    const granted = row.effective !== "NONE";
    const items: ITDropdownMenuItem[] = [];
    if (row.exception) {
      items.push({
        id: "clear",
        label: t("explorer.fix.clearException"),
        onClick: () => setClearing(permission),
      });
    }
    if (!granted) {
      for (const role of personRoles) {
        if (admin.scopeOf(role, permission.key) !== "NONE") continue;
        items.push({
          id: `grant-${role}`,
          label: t("explorer.fix.grantRole", { role: roleLabel(role), count: peopleIn(role) }),
          divider: items.length > 0 && items.length === (row.exception ? 1 : 0),
          onClick: () => {
            admin.toggle(role, permission.key);
            notify(t("explorer.fix.pendingToast", { role: roleLabel(role) }), "success");
          },
        });
      }
      if (canExceptions) {
        items.push({
          id: "grant-person",
          label: t("explorer.fix.grantPerson", { name: firstName }),
          divider: items.length > 0,
          onClick: () => setException({ permission, mode: "grant" }),
        });
      }
    } else {
      for (const role of Object.keys(row.byRole)) {
        if (isLockedCell(role, permission.key) || admin.scopeOf(role, permission.key) === "NONE") continue;
        items.push({
          id: `revoke-${role}`,
          label: t("explorer.fix.revokeRole", { role: roleLabel(role), count: peopleIn(role) }),
          onClick: () => {
            admin.toggle(role, permission.key);
            notify(t("explorer.fix.pendingToast", { role: roleLabel(role) }), "success");
          },
        });
      }
      if (canExceptions) {
        if (isScopedPermission(permission)) {
          items.push({
            id: "scope-person",
            label: t("explorer.fix.scopePerson", { name: firstName }),
            divider: items.length > 0,
            onClick: () => setException({ permission, mode: "grant" }),
          });
        }
        items.push({
          id: "revoke-person",
          label: t("explorer.fix.revokePerson", { name: firstName }),
          danger: true,
          divider: !isScopedPermission(permission) && items.length > 0,
          onClick: () => setException({ permission, mode: "revoke" }),
        });
      }
    }
    return items;
  };

  const sourceText = (row: AccessPermissionView, permission: PermissionCatalog) => {
    const scoped = isScopedPermission(permission);
    if (row.exception) {
      return (
        <ITText as="span" className="text-violet-700" title={row.exception.reason ?? undefined}>
          {row.exception.scope === "NONE" ? t("explorer.source.exceptionRemoved") : t("explorer.source.exception")}
          {row.exception.expiresAt && ` · ${t("explorer.until", { date: formatDate(row.exception.expiresAt) })}`}
        </ITText>
      );
    }
    const entries = Object.entries(row.byRole);
    if (entries.length === 0) return <ITText as="span" className="text-slate-400">{t("explorer.source.none")}</ITText>;
    return (
      <ITText as="span" className="text-slate-500">
        {t("explorer.source.byRole")}{" "}
        {entries
          .map(([role, scope]) => (scoped ? `${roleLabel(role)} (${t(`scope.${scope}`)})` : roleLabel(role)))
          .join(", ")}
      </ITText>
    );
  };

  const confirmClear = async () => {
    if (!clearing || !userId) return;
    try {
      await usersApi.removePermission(userId, clearing.key);
      notify(t("explorer.fix.cleared"), "success");
      void reload();
      void members.reload();
    } catch (err) {
      notify((err as { message?: string })?.message ?? t("exception.errors.save"), "error");
    }
    setClearing(null);
  };

  const confirmRemoveRole = async () => {
    if (!removingRole || !userId) return;
    const result = await members.removeFromRole(removingRole, userId);
    notify(result.ok ? t("members.removed", { name: firstName }) : result.error ?? t("errors.removeMember"), result.ok ? "success" : "error");
    setRemovingRole(null);
  };

  const addRoleItems: ITDropdownMenuItem[] = roles
    .filter((role) => admin.rolesMeta.find((item) => item.key === role)?.active && !access?.roles.some((item) => item.key === role))
    .map((role) => ({
      id: role,
      label: roleLabel(role),
      onClick: async () => {
        if (!userId) return;
        const result = await members.addToRole(role, userId);
        notify(result.ok ? t("members.added", { role: roleLabel(role) }) : result.error ?? t("errors.addMember"), result.ok ? "success" : "error");
      },
    }));

  return (
    <div className="grid items-start gap-3 lg:!grid-cols-[240px_minmax(0,1fr)]">
      {/* Personas */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-[var(--it-card-bg)] p-2 lg:sticky lg:top-4">
        <ITInput
          name="explorer_search"
          size="sm"
          placeholder={t("explorer.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          iconLeft={<FaSearch size={11} />}
        />
        <ITSelect
          name="explorer_role"
          size="sm"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          options={[{ value: "", label: t("explorer.allRoles") }, ...roles.map((role) => ({ value: role, label: roleLabel(role) }))]}
        />
        <ITCheckbox
          name="explorer_inactive"
          checked={showInactive}
          onChange={(checked) => setShowInactive(checked)}
          label={t("explorer.showInactive")}
        />
        <div className="flex max-h-[62vh] flex-col gap-0.5 overflow-y-auto">
          {list.map((member) => {
            const selected = member.id === userId;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  onSelectUser(member.id);
                  setSearch("");
                }}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                  selected ? "border-primary-500/40 !bg-primary-500/5" : "border-transparent !bg-transparent hover:!bg-slate-50"
                } ${member.active ? "" : "opacity-60"}`}
              >
                <ProfileAvatar name={member.name} size="sm" className="h-7! w-7!" />
                <ITText as="span" className="min-w-0 flex-1">
                  <ITText as="span" className={`block truncate text-[12px] font-bold ${selected ? "text-primary-500" : "text-slate-800"}`}>
                    {member.name}
                  </ITText>
                  <ITText as="span" className="block truncate text-[10px] text-slate-400">{memberRoles(member).map(roleLabel).join(" · ")}</ITText>
                </ITText>
                {member.exceptions > 0 && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" title={t("members.exceptions", { count: member.exceptions })} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Acceso de la persona */}
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-[var(--it-card-bg)] p-4">
        {!userId && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FaUserSecret size={28} className="text-slate-300" />
            <ITText className="text-[13px] font-bold text-slate-700">{t("explorer.emptyTitle")}</ITText>
            <ITText className="max-w-md text-[11px] text-slate-500">{t("explorer.emptyBody")}</ITText>
          </div>
        )}

        {userId && loading && !access && (
          <div className="flex justify-center py-14">
            <LottieLoader />
          </div>
        )}

        {userId && error && (
          <ITAlert variant="error" dismissible={false}>
            {error}
          </ITAlert>
        )}

        {userId && access && (
          <>
            {/* Quién es y qué roles tiene */}
            <ITFlex align="center" wrap="wrap" gap={3}>
              <ProfileAvatar name={access.user.name} size="md" className="h-9! w-9!" />
              <div className="min-w-[200px] flex-1">
                <ITFlex align="center" wrap="wrap" gap={1.5}>
                  <ITText as="h2" className="text-[15px] font-black text-slate-900">{access.user.name}</ITText>
                  {!access.user.active && (
                  <ITText as="span" className="rounded bg-rose-50 px-1.5 py-0.5 text-[12px] font-bold text-rose-600">{t("members.inactive")}</ITText>
                  )}
                </ITFlex>
                <ITText className="truncate text-[11px] text-slate-500">
                  @{access.user.username}
                  {access.user.employeeNumber && <> · #{access.user.employeeNumber}</>}
                  {access.user.department && <> · {access.user.department}</>}
                </ITText>
              </div>
              <ITButton variant="outlined" color="primary" size="sm" onClick={() => navigate(`/users/${access.user.id}/edit`)}>
                <ITText as="span" className="flex items-center gap-1 text-[11px] font-bold">
                  <FaExternalLinkAlt size={8} /> {t("explorer.openProfile")}
                </ITText>
              </ITButton>
            </ITFlex>

            <ITFlex align="center" wrap="wrap" gap={1.5}>
              <ITText as="span" className="mr-1 text-[11px] font-bold text-slate-500">{t("explorer.rolesLabel")}</ITText>
              {access.roles.map((role) => (
                <ITText as="span" key={role.key} className="inline-flex items-center">
                  <RoleChip
                    role={role.key}
                    muted={!role.active}
                    suffix={role.primary ? t("members.primary") : !role.active ? t("access.inactiveRole") : undefined}
                    onClick={() => onOpenRole(role.key)}
                  />
                  {!role.primary && (
                    <button
                      type="button"
                      onClick={() => setRemovingRole(role.key)}
                      title={t("explorer.removeRole")}
                      className="-ml-1 flex h-5 w-5 items-center justify-center rounded-full !bg-transparent text-slate-400 hover:!bg-rose-50 hover:text-rose-600"
                    >
                      <FaTimes size={8} />
                    </button>
                  )}
                </ITText>
              ))}
              {addRoleItems.length > 0 && (
                <ITDropdownMenu
                  placement="bottom-start"
                  triggerLabel={t("explorer.addRole")}
                  trigger={
                    <ITText as="span" className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:border-primary-500 hover:text-primary-500">
                      <FaPlus size={8} /> {t("explorer.addRole")}
                    </ITText>
                  }
                  items={addRoleItems}
                />
              )}
            </ITFlex>

            <TabBar
              size="sm"
              value={section}
              onChange={setSection}
              items={[
                { id: "permissions", label: t("explorer.section.permissions") },
                { id: "screens", label: t("explorer.section.screens") },
              ]}
            />

            {section === "permissions" && (
              <>
                <ITFlex align="center" wrap="wrap" gap={2}>
                  <div className="min-w-[240px] flex-1">
                    <ITInput
                      name="explorer_question"
                      size="sm"
                      placeholder={t("explorer.questionPlaceholder", { name: firstName })}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      iconLeft={<FaSearch size={11} />}
                    />
                  </div>
                  {!searching && (
                    <ITFlex align="center" gap={1}>
                      {(
                        [
                          ["can", t("explorer.view.can", { count: canCount })],
                          ["cannot", t("explorer.view.cannot", { count: active.length - canCount })],
                          ["all", t("explorer.view.all")],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setView(id)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                            view === id
                              ? "border-primary-500 !bg-primary-500 text-white"
                              : "border-slate-200 !bg-[var(--it-card-bg)] text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </ITFlex>
                  )}
                </ITFlex>

                {groups.length === 0 ? (
                  <ITText className="py-8 text-center text-[12px] italic text-slate-400">
                    {searching ? t("matrix.noResults") : view === "can" ? t("explorer.nothingCan") : t("explorer.nothingCannot")}
                  </ITText>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    {groups.map(({ module, rows }, groupIndex) => (
                      <div key={module} className={groupIndex > 0 ? "border-t border-slate-200" : ""}>
                        <ITText className="bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-500">{module}</ITText>
                        {rows.map((permission) => {
                          const row = byKey.get(permission.key);
                          if (!row) return null;
                          const granted = row.effective !== "NONE";
                          const items = fixItems(row, permission);
                          const pending = pendingFor(permission.key);
                          return (
                            <div key={permission.key} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-1.5">
                              {granted ? (
                                <FaCheckCircle size={12} className="shrink-0 text-emerald-500" title={t("explorer.can")} />
                              ) : (
                                <FaBan size={12} className="shrink-0 text-slate-300" title={t("explorer.cannot")} />
                              )}
                              <div className="min-w-[200px] flex-1">
                                <ITText className={`text-[12px] font-semibold ${granted ? "text-slate-800" : "text-slate-500"}`}>
                                  {permission.name}
                                  {granted && isScopedPermission(permission) && (
                                    <ITText as="span" className="ml-1.5 align-middle">
                                      <ScopeChip scope={row.effective} />
                                    </ITText>
                                  )}
                                </ITText>
                                <ITText className="text-[10px]">{sourceText(row, permission)}</ITText>
                              </div>
                              {pending && (
                                <ITText as="span" className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  {t("explorer.pending")}
                                </ITText>
                              )}
                              {ruledActions.has(permission.key) && (
                                <button
                                  type="button"
                                  onClick={() => onTest(access.user.id, permission.key)}
                                  title={t("explorer.hasRulesHint")}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 !bg-[var(--it-card-bg)] px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:border-primary-500 hover:text-primary-500"
                                >
                                  <FaGavel size={8} /> {t("explorer.hasRules")}
                                </button>
                              )}
                              {items.length > 0 && (
                                <ITDropdownMenu
                                  placement="bottom-end"
                                  triggerLabel={granted ? t("explorer.fix.remove") : t("explorer.fix.give")}
                                  trigger={
                                    <ITText as="span"
                                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${
                                        granted
                                          ? "border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600"
                                          : "border-primary-500/30 text-primary-500 hover:border-primary-500"
                                      }`}
                                    >
                                      {granted ? t("explorer.fix.remove") : t("explorer.fix.give")}
                                      <FaChevronDown size={7} />
                                    </ITText>
                                  }
                                  items={items}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
                <ITText className="text-[10px] text-slate-400">{t("explorer.howResolved")}</ITText>
              </>
            )}

            {section === "screens" && (
              <div className="grid items-start gap-3 lg:!grid-cols-[230px_minmax(0,1fr)]">
                <SidebarPreview permissions={effective} role={access.user.role} title={access.user.name} />
                <ScreensAccessList permissions={effective} role={access.user.role} catalog={catalog} />
              </div>
            )}

            <ExceptionDialog
              isOpen={exception !== null}
              userId={access.user.id}
              personName={access.user.name}
              permission={exception?.permission ?? null}
              mode={exception?.mode ?? "grant"}
              onClose={() => setException(null)}
              onSaved={(message) => {
                notify(message, "success");
                void reload();
                void members.reload();
              }}
            />

            <ITConfirmDialog
              isOpen={clearing !== null}
              onClose={() => setClearing(null)}
              onConfirm={confirmClear}
              title={t("explorer.fix.clearTitle")}
              message={t("explorer.fix.clearConfirm", { permission: clearing?.name ?? "", name: firstName })}
              confirmLabel={t("explorer.fix.clearException")}
            />

            <ITConfirmDialog
              isOpen={removingRole !== null}
              onClose={() => setRemovingRole(null)}
              onConfirm={confirmRemoveRole}
              loading={members.busy}
              variant="danger"
              title={t("members.removeTitle")}
              message={t("members.removeConfirm", { name: access.user.name, role: removingRole ? roleLabel(removingRole) : "" })}
              confirmLabel={t("members.remove")}
            />
          </>
        )}
      </div>
    </div>
  );
}
