import {
  ITBadget,
  ITButton,
  ITDataTable,
  ITFlex,
  ITText,
} from "@axzydev/axzy_ui_system";
import type {
  Column,
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { LuEye, LuKeyRound, LuPencil, LuTrash2, LuUndo2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { roleLabel, useRolesCatalog, type User } from "@entities/user";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import type { UseUsersList } from "../model/useUsersList";
import { i18n } from "@shared/i18n";

interface Props {
  fx: UseUsersList;
  onView: (u: User) => void;
  onEdit: (u: User) => void;
}

const roleBadge = (role: string) => (
  <ITBadget
    color={
      role === "ADMIN"
        ? "danger"
        : role === "MANAGER"
          ? "info"
          : role === "AREA_HEAD"
            ? "warning"
            : role === "GUARD"
              ? "gray"
              : role === "EMPLOYEE"
                ? "success"
                : "gray"
    }
    size="lg"
  >
    {roleLabel(role)}
  </ITBadget>
);

export default function UsersTable({ fx, onView, onEdit }: Props) {
  const { t: tt } = useTranslation(["users", "common"]);
  const rolesCatalog = useRolesCatalog();
  const roleFilterOptions = rolesCatalog
    .filter((role) => role.active)
    .map((role) => ({ id: role.key, name: role.name }));

  const departmentOptions = fx.departments
    .filter((d) => d.active)
    .map((d) => ({ id: d.id, name: d.name }));

  const subareaOptions = fx.departments
    .filter((d) => d.active)
    .flatMap((d) => d.subareas.map((s) => ({ id: s.id, name: `${d.name} · ${s.name}` })));

  const columns: Column<User>[] = [
    {
      key: "username",
      label: tt("table.username"),
      type: "string",
      width: 110,
      filter: true,
      sortable: false,
      render: (u) => (
        <ITText className="text-[12px] font-semibold text-slate-600">@{u.username}</ITText>
      ),
    },
    {
      key: "name",
      label: tt("table.name"),
      type: "string",
      width: 250,
      filter: true,
      sortable: false,
      render: (u) => (
        <ITFlex align="center" gap={2}>
          <ProfileAvatar name={u.name} size="sm" />
          <ITFlex align="center" gap={1} className="min-w-0">
            <ITText className="truncate text-[12px] text-slate-800">{u.name}</ITText>
            {!u.active && (
              <ITBadget color="danger" size="lg">{i18n.t("common:labels.inactive")}</ITBadget>
            )}
          </ITFlex>
        </ITFlex>
      ),
    },
    {
      key: "role",
      label: tt("table.role"),
      type: "catalog",
      width: 140,
      filter: "catalog",
      sortable: false,
      catalogOptions: {
        data: roleFilterOptions,
        loading: false,
        error: false,
      },
      render: (u) => roleBadge(u.role),
    },
    {
      key: "employeeNumber",
      label: tt("table.employeeNo"),
      type: "string",
      width: 110,
      filter: true,
      sortable: false,
      render: (u) => (
        <ITText className="text-[12px] text-slate-600">{u.employeeNumber ?? "—"}</ITText>
      ),
    },
    {
      key: "departmentId",
      label: tt("table.department"),
      type: "catalog",
      width: 150,
      filter: "search",
      sortable: false,
      catalogOptions: { data: departmentOptions, loading: false, error: false },
      render: (u) => (
        <ITText className="text-[12px] text-slate-500">
          {(u as any).department?.name ?? "—"}
        </ITText>
      ),
    },
    {
      key: "subareaId",
      label: tt("table.subarea"),
      type: "catalog",
      width: 150,
      filter: "search",
      sortable: false,
      catalogOptions: { data: subareaOptions, loading: false, error: false },
      render: (u) => (
        <ITText className="text-[12px] text-slate-500">
          {(u as any).subarea?.name ?? "—"}
        </ITText>
      ),
    },
    {
      key: "actions",
      label: "",
      type: "string",
      width: 200,
      sortable: false,
      render: (u) => (
        <ITFlex align="center" gap={2}>
          <ITButton
            onClick={() => onView(u)}
            size="lg"
            color="secondary"
            title={tt("common:actions.view")}
          >
            <LuEye size={15} />
          </ITButton>
          <ITButton onClick={() => onEdit(u)} size="lg" color="gray" title={tt("common:actions.edit")}>
            <LuPencil size={15} />
          </ITButton>
          <ITButton
            onClick={() => {
              fx.setUserToPassword(u);
              fx.setNewPassword("");
            }}
            size="lg"
            color="success"
            title={tt("list.passwordHeading")}
          >
            <LuKeyRound size={15} />
          </ITButton>
          <ITButton
            onClick={() => fx.setUserToToggle(u)}
            size="lg"
            variant={u.active ? "outlined" : "filled"}
            color={u.active ? "error" : "danger"}
            title={u.active ? tt("list.confirmDeactivateBtn") : tt("list.confirmDeleteBtn")}
          >
            <LuTrash2 size={15} />
          </ITButton>
          {!u.active && (
            <ITButton
              onClick={() => fx.setUserToReactivate(u)}
              size="lg"
              color="success"
              title={tt("list.reactivateBtn")}
            >
              <LuUndo2 size={15} />
            </ITButton>
          )}
        </ITFlex>
      ),
    },
  ];

  return (
    <ITDataTable showViewToggle={false}
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      fetchData={
        fx.fetchTableData as unknown as (
          p: ITDataTableFetchParams
        ) => Promise<ITDataTableResponse<Record<string, unknown>>>
      }
      reloadTrigger={fx.reloadKey}
      onRowClick={(row) => onView(row as unknown as User)}
      defaultItemsPerPage={25}
      itemsPerPageOptions={[25, 50, 100]}
      layout="fixed"
      density="compact"
      rowHeight={50}
      virtualized
      virtualizedMaxHeight={460}
    />
  );
}