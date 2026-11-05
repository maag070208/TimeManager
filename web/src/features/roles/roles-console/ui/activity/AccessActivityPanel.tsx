import { useMemo, type ReactNode } from "react";
import { ITButton, ITDataTable, ITSegmentedControl, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import type { Column, ColumnFilters, ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { FaShieldAlt } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import {
  ACCESS_ACTIVITY_ACTIONS,
  type AccessActivityRow,
  type AccessMember,
  type PermissionCatalog,
  type PolicyAdmin,
} from "@entities/permission";
import { roleLabel, type PermissionScope } from "@entities/user";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n/format";
import { fetchAccessActivity } from "../../model/useAccessActivity";
import type { ActivityQuickFilter } from "../../model/useRolesWorkspace";

interface Props {
  catalog: readonly PermissionCatalog[];
  members: readonly AccessMember[];
  policies: readonly PolicyAdmin[];
  quickFilter: ActivityQuickFilter;
  onQuickFilterChange: (value: ActivityQuickFilter) => void;
  onViewAccess: (userId: string, permission?: string) => void;
}

const ACTION_TONE: Record<string, string> = {
  ACCESS_DENIED: "bg-rose-50 text-rose-700",
  ROLE_PERMISSIONS_UPDATED: "bg-primary-500/10 text-primary-500",
  PERMISSION_EXCEPTION_SET: "bg-violet-50 text-violet-700",
  PERMISSION_EXCEPTION_REMOVED: "bg-violet-50 text-violet-700",
  USER_ROLE_ADDED: "bg-emerald-50 text-emerald-700",
  USER_ROLE_REMOVED: "bg-amber-50 text-amber-700",
};

const scopeOfState = (state: Record<string, unknown> | null): PermissionScope | null => {
  const scope = state?.scope;
  return scope === "NONE" || scope === "OWN" || scope === "AREA" || scope === "ALL" ? scope : null;
};

/** Persona y permiso afectados por un renglón (para "Ver acceso"). */
const subjectOf = (row: AccessActivityRow): { userId: string; permission?: string } | null => {
  if (row.action === "ACCESS_DENIED" && row.actor.id) {
    const permission = row.entityId.split("|")[0];
    return { userId: row.actor.id, permission };
  }
  if (row.entityType === "UserPermission" || row.entityType === "UserRole") {
    const [userId, other] = row.entityId.split("|");
    return { userId, permission: row.entityType === "UserPermission" ? other : undefined };
  }
  return null;
};

/**
 * Bitácora del control de acceso: cambios de roles, matriz, catálogo,
 * políticas, excepciones, asignación de roles y accesos denegados.
 */
export default function AccessActivityPanel({
  catalog,
  members,
  policies,
  quickFilter,
  onQuickFilterChange,
  onViewAccess,
}: Props) {
  const { t } = useTranslation("roles");
  const tt = dyn(t);

  const permissionName = (key: string) => catalog.find((item) => item.key === key)?.name ?? key;
  const memberName = (id: string) => members.find((member) => member.id === id)?.name ?? id.slice(0, 8);
  const scopeText = (scope: PermissionScope | null) => (scope ? t(`scope.${scope}`) : "—");

  const describe = (row: AccessActivityRow): ReactNode => {
    const [first, second] = row.entityId.split("|");
    switch (row.entityType) {
      case "RolePermission":
        return (
          <>
            <ITText as="b">{roleLabel(first)}</ITText> · {permissionName(second)}:{" "}
            <ITText as="span" className="text-slate-400">{scopeText(scopeOfState(row.previousState) ?? "NONE")}</ITText> →{" "}
            <ITText as="b">{scopeText(scopeOfState(row.newState))}</ITText>
          </>
        );
      case "Role":
        return (
          <>
            <ITText as="b">{roleLabel(first)}</ITText>
            {typeof row.metadata?.copiedFrom === "string" && (
              <ITText as="span" className="text-slate-400"> · {t("activity.copiedFrom", { role: roleLabel(row.metadata.copiedFrom) })}</ITText>
            )}
          </>
        );
      case "Permission":
        if (row.action === "ACCESS_DENIED") {
          const method = typeof row.metadata?.method === "string" ? row.metadata.method : "";
          const path = typeof row.metadata?.path === "string" ? row.metadata.path : "";
          return (
            <>
              <ITText as="b">{row.entityId.split("|").map(permissionName).join(" / ")}</ITText>
              {path && <ITText as="span" className="font-mono text-[10px] text-slate-400"> · {method} {path}</ITText>}
            </>
          );
        }
        return <ITText as="b">{permissionName(first)}</ITText>;
      case "Policy": {
        const policy = policies.find((item) => item.id === first);
        return <ITText as="b">{policy?.name ?? t("activity.deletedPolicy")}</ITText>;
      }
      case "UserPermission":
        return (
          <>
            <ITText as="b">{memberName(first)}</ITText> · {permissionName(second)}:{" "}
            <ITText as="span" className="text-slate-400">{scopeText(scopeOfState(row.previousState))}</ITText> →{" "}
            <ITText as="b">{row.action === "PERMISSION_EXCEPTION_REMOVED" ? t("activity.followsRole") : scopeText(scopeOfState(row.newState))}</ITText>
          </>
        );
      case "UserRole":
        return (
          <>
            <ITText as="b">{typeof row.metadata?.user === "string" ? row.metadata.user : memberName(first)}</ITText> · {roleLabel(second)}
          </>
        );
      default:
        return row.entityId;
    }
  };

  const columns: Column<AccessActivityRow>[] = [
    {
      key: "createdAt",
      label: t("activity.columns.date"),
      type: "date",
      width: 150,
      filter: "date-range",
      sortable: false,
      render: (row) => (
        <ITText as="span" className="text-[11px] tabular-nums text-slate-600">
          {new Date(row.createdAt).toLocaleString(dateLocale(), { dateStyle: "short", timeStyle: "short" })}
        </ITText>
      ),
    },
    {
      key: "action",
      label: t("activity.columns.action"),
      type: "catalog",
      width: 190,
      filter: "catalog",
      sortable: false,
      catalogOptions: {
        data: ACCESS_ACTIVITY_ACTIONS.map((action) => ({ id: action, name: tt(`activity.action.${action}`) })),
      },
      render: (row) => (
        <ITText as="span" className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ACTION_TONE[row.action] ?? "bg-slate-100 text-slate-600"}`}>
          {tt(`activity.action.${row.action}`)}
        </ITText>
      ),
    },
    {
      key: "actor",
      label: t("activity.columns.actor"),
      type: "string",
      width: 180,
      filter: true,
      sortable: false,
      render: (row) => (
        <ITText as="span" className="flex flex-col">
          <ITText as="span" className="text-[12px] font-bold text-slate-700">{row.actor.name ?? row.actor.username ?? "—"}</ITText>
          {row.actor.username && <ITText as="span" className="text-[10px] text-slate-400">@{row.actor.username}</ITText>}
        </ITText>
      ),
    },
    {
      key: "entityId",
      label: t("activity.columns.detail"),
      type: "string",
      filter: true,
      sortable: false,
      render: (row) => <ITText as="span" className="text-[12px] text-slate-600">{describe(row)}</ITText>,
    },
    {
      key: "actions",
      label: "",
      type: "actions",
      width: 120,
      render: (row) => {
        const subject = subjectOf(row);
        if (!subject) return null;
        return (
          <ITButton variant="outlined" color="primary" size="sm" onClick={() => onViewAccess(subject.userId, subject.permission)}>
            <ITText as="span" className="flex items-center gap-1 text-[10px] font-bold">
              <FaShieldAlt size={9} /> {t("members.viewAccess")}
            </ITText>
          </ITButton>
        );
      },
    },
  ];

  const externalFilters = useMemo<ColumnFilters | undefined>(
    () => (quickFilter === "denied" ? { action: "ACCESS_DENIED" } : undefined),
    [quickFilter]
  );

  return (
    <ITStack spacing={3}>
      <ITFlex align="center" justify="between" wrap="wrap" gap={2}>
        <ITText className="text-[12px] text-slate-500">{t("activity.subtitle")}</ITText>
        <ITSegmentedControl
          size="sm"
          value={quickFilter}
          onChange={(value) => onQuickFilterChange(value as ActivityQuickFilter)}
          options={[
            { value: "all", label: t("activity.quick.all") },
            { value: "denied", label: t("activity.quick.denied") },
          ]}
        />
      </ITFlex>
      <ITDataTable showViewToggle={false}
        key={quickFilter}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        fetchData={
          fetchAccessActivity as unknown as (
            params: ITDataTableFetchParams
          ) => Promise<ITDataTableResponse<Record<string, unknown>>>
        }
        externalFilters={externalFilters}
        defaultItemsPerPage={25}
        itemsPerPageOptions={[25, 50, 100]}
        layout="fixed"
        density="compact"
        rowHeight={50}
        virtualized
        virtualizedMaxHeight={460}
      />
    </ITStack>
  );
}
