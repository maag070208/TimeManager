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
import { LuPencil, LuUserRound } from "react-icons/lu";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Department } from "@entities/department";
import { resolvePhotoUrl, type PersonalProfile } from "@entities/hr";
import { roleLabel, useRolesCatalog } from "@entities/user";
import { ProfileAvatar } from "@shared/ui/profile-avatar";

const ROLE_BADGE: Record<string, "warning" | "info" | "success" | "gray"> = {
  CLIENT_ADMIN: "warning",
  HUMAN_RESOURCES: "info",
  CLIENT_STAFF: "success",
};

const roleBadge = (role: string, label: string) => (
  <ITBadget
    color={ROLE_BADGE[role] ?? "gray"}
    size="lg"
  >
    {label}
  </ITBadget>
);

interface Props {
  departments: Department[];
  canEdit: boolean;
  fetchData: (
    params: ITDataTableFetchParams
  ) => Promise<ITDataTableResponse<Record<string, unknown>>>;
  reloadKey: number;
  /** Filtros que vienen de fuera de la tabla (mosaicos del resumen). */
  externalFilters?: Record<string, string>;
  onView: (u: PersonalProfile) => void;
  onEdit: (u: PersonalProfile) => void;
  /** Tras una asignación en lote: la lista vuelve a pedir sus datos. */
  onChanged: () => void;
  /** Acciones de cuenta de la fila (contraseña, baja, reactivar…). */
  rowActions?: (u: PersonalProfile) => ReactNode;
}

export default function EmployeesTable({
  departments,
  canEdit,
  fetchData,
  reloadKey,
  externalFilters,
  onView,
  onEdit,
  rowActions,
}: Props) {
  const { t: tt } = useTranslation(["users"]);
  // Todos los departamentos y subáreas: también hay personal en los inactivos.
  const departmentOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  const subareaOptions = departments.flatMap((d) =>
    d.subareas.map((s) => ({ id: s.id, name: `${d.name} · ${s.name}` }))
  );

  // Roles que admite el API para el personal (los marcados `staff` en /roles).
  const staffRoleOptions = useRolesCatalog()
    .filter((role) => role.active && role.staff)
    .map((role) => ({ id: role.key, name: role.name }));

  const columns: Column<PersonalProfile>[] = [
    {
      key: "employeeNumber",
      label: tt("table.employeeNoFull"),
      type: "string",
      width: 110,
      filter: true,
      sortable: false,
      render: (u) => (
        <ITText className="text-[12px] font-semibold text-slate-600">
          {u.employeeNumber ?? "—"}
        </ITText>
      ),
    },
    {
      key: "name",
      label: tt("table.name"),
      type: "string",
      width: 280,
      filter: true,
      sortable: false,
      render: (u) => (
        <ITFlex align="center" gap={2} className="cursor-pointer">
          <ProfileAvatar photoUrl={resolvePhotoUrl(u.photoUrl)} name={u.name} size="sm" />
          <ITFlex direction="column" gap={0.5} className="min-w-0">
            <ITText className="truncate text-[13px] font-semibold text-slate-800">{u.name}</ITText>
            <ITText className="text-[12px] text-slate-400">
              @{u.username}
            </ITText>
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
      catalogOptions: { data: staffRoleOptions, loading: false, error: false },
      render: (u) => roleBadge(u.role, roleLabel(u.role)),
    },
    {
      key: "active",
      label: tt("table.status"),
      type: "catalog" as const,
      sortable: false,
      width: 140,
      filter: "catalog",
      catalogOptions: {
        data: [
          { id: "true", name: tt("table.statusActive") },
          { id: "false", name: tt("table.statusInactive") },
        ],
        loading: false,
        error: false,
      },
      render: (u) => (
        <ITBadget color={u.active ? "success" : "danger"} size="lg">
          {u.active ? tt("table.statusActive") : tt("table.statusInactive")}
        </ITBadget>
      ),
    },
    {
      key: "jobTitle",
      label: tt("table.position"),
      type: "string",
      width: 180,
      filter: true,
      sortable: false,
      render: (u) => (
        <ITText className="text-[12px] text-slate-600">{u.jobTitle ?? "—"}</ITText>
      ),
    },
    {
      key: "departmentId",
      label: tt("table.departmentFull"),
      type: "catalog",
      width: 150,
      filter: "search",
      sortable: false,
      catalogOptions: { data: departmentOptions, loading: false, error: false },
      render: (u) => (
        <ITText className="text-[12px] text-slate-600">
          {u.department?.name ?? "—"}
        </ITText>
      ),
    },
    {
      key: "subareaId",
      label: tt("table.subarea"),
      type: "catalog",
      width: 130,
      filter: "search",
      sortable: false,
      catalogOptions: { data: subareaOptions, loading: false, error: false },
      render: (u) => (
        <ITText className="text-[12px] text-slate-500">
          {u.subarea?.name ?? "—"}
        </ITText>
      ),
    },
    {
      key: "actions",
      label: "",
      type: "string" as const,
      width: rowActions ? 160 : 120,
      sortable: false,
      render: (u: PersonalProfile) => (
        <ITFlex align="center" gap={2}>
          <ITButton
            onClick={() => onView(u)}
            variant="outlined"
            color="primary"
            className="tm-icon-button"
            aria-label={tt("table.viewProfile")}
            title={tt("table.viewProfile")}
          >
            <LuUserRound size={15} />
          </ITButton>
          {canEdit && (
            <ITButton
              onClick={() => onEdit(u)}
              variant="outlined"
              color="warning"
              className="tm-icon-button"
              aria-label={tt("table.editEmployee")}
              title={tt("table.editEmployee")}
            >
              <LuPencil size={15} />
            </ITButton>
          )}
          {rowActions?.(u)}
        </ITFlex>
      ),
    },
  ];

  return (
    <>
      <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
        // Otro mosaico del resumen = otra lista: la tabla se remonta.
        key={JSON.stringify(externalFilters ?? {})}
        externalFilters={externalFilters}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
      fetchData={
        fetchData as unknown as (
          p: ITDataTableFetchParams
        ) => Promise<ITDataTableResponse<Record<string, unknown>>>
      }
      reloadTrigger={reloadKey}
      onRowClick={(row) => onView(row as unknown as PersonalProfile)}
      />
    </>
  );
}