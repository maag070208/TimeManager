import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@app/store";
import type { RoleAdmin } from "@entities/permission";
import { meThunk } from "@entities/user";
import { i18n } from "@shared/i18n";
import { useAccessMembers, type AccessMembersState } from "./useAccessMembers";
import { usePolicies, type PoliciesState } from "./usePolicies";
import { useRolesAdmin, type RoleResult, type RolesAdminState } from "./useRolesAdmin";

export type WorkspaceTab = "roles" | "matrix" | "access" | "policies" | "catalog" | "activity";
export type ActivityQuickFilter = "all" | "denied";

export interface WorkspaceToast {
  message: string;
  type: "success" | "error";
}

export interface TesterState {
  permission?: string | null;
  userId?: string | null;
}

export interface RoleDialogState {
  open: boolean;
  /** Rol en edición; `null` = alta. */
  role: RoleAdmin | null;
  /** Duplicar: alta que copia la matriz de este rol. */
  copyFrom: RoleAdmin | null;
}

export interface RolesWorkspaceState {
  admin: RolesAdminState;
  members: AccessMembersState;
  policies: PoliciesState;
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  selectedRole: string | null;
  openRole: (role: string) => void;
  accessUserId: string | null;
  accessPermission: string | null;
  /** Cambia cuando cambian permisos o roles guardados (el visor vuelve a pedir el acceso). */
  accessVersion: number;
  openAccess: (userId: string, permission?: string) => void;
  selectAccessUser: (userId: string) => void;
  activityFilter: ActivityQuickFilter;
  openActivity: (filter: ActivityQuickFilter) => void;
  setActivityFilter: (filter: ActivityQuickFilter) => void;
  roleDialog: RoleDialogState;
  openCreateRole: () => void;
  openEditRole: (role: RoleAdmin) => void;
  openDuplicateRole: (role: RoleAdmin) => void;
  closeRoleDialog: () => void;
  submitRole: (
    payload:
      | { mode: "create"; dto: Parameters<RolesAdminState["createRole"]>[0] }
      | { mode: "update"; key: string; dto: Parameters<RolesAdminState["updateRole"]>[1] }
  ) => Promise<boolean>;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  confirmSave: () => Promise<void>;
  /** Probador abierto en diálogo: con permiso y/o persona precargados. */
  tester: TesterState | null;
  openTester: (preset: TesterState) => void;
  closeTester: () => void;
  toast: WorkspaceToast | null;
  notify: (message: string, type: WorkspaceToast["type"]) => void;
  clearToast: () => void;
}

/**
 * Estado de la consola `/roles`: el borrador de la matriz (compartido entre
 * Roles y Matriz), personas, políticas, pestaña activa, navegación entre
 * pestañas (p. ej. de un acceso denegado al visor de esa persona) y diálogos.
 */
export const useRolesWorkspace = (): RolesWorkspaceState => {
  const dispatch = useDispatch<AppDispatch>();
  const admin = useRolesAdmin();
  const { refreshRoles } = admin;
  const [accessVersion, setAccessVersion] = useState(0);
  const bumpAccess = useCallback(() => setAccessVersion((version) => version + 1), []);
  const onMembersChanged = useCallback(() => {
    void refreshRoles();
    bumpAccess();
  }, [refreshRoles, bumpAccess]);
  const members = useAccessMembers(onMembersChanged);
  const policies = usePolicies();

  const [tab, setTab] = useState<WorkspaceTab>("roles");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  const [accessPermission, setAccessPermission] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityQuickFilter>("all");
  const [roleDialog, setRoleDialog] = useState<RoleDialogState>({ open: false, role: null, copyFrom: null });
  const [helpOpen, setHelpOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tester, setTester] = useState<TesterState | null>(null);
  const [toast, setToast] = useState<WorkspaceToast | null>(null);

  const roles = admin.data?.roles;
  useEffect(() => {
    // Primer rol seleccionado al cargar, y otro si el seleccionado se eliminó.
    if (!roles?.length) return;
    if (!selectedRole || !roles.includes(selectedRole)) setSelectedRole(roles[0]);
  }, [roles, selectedRole]);

  const notify = useCallback((message: string, type: WorkspaceToast["type"]) => setToast({ message, type }), []);

  const openRole = useCallback((role: string) => {
    setSelectedRole(role);
    setTab("roles");
  }, []);

  const openAccess = useCallback((userId: string, permission?: string) => {
    setAccessUserId(userId);
    setAccessPermission(permission ?? null);
    setTab("access");
  }, []);

  const selectAccessUser = useCallback((userId: string) => {
    setAccessUserId(userId);
    setAccessPermission(null);
  }, []);

  const openActivity = useCallback((filter: ActivityQuickFilter) => {
    setActivityFilter(filter);
    setTab("activity");
  }, []);

  const submitRole: RolesWorkspaceState["submitRole"] = async (payload) => {
    const result: RoleResult =
      payload.mode === "create"
        ? await admin.createRole(payload.dto)
        : await admin.updateRole(payload.key, payload.dto);
    if (!result.ok) {
      notify(result.error ?? i18n.t("roles:errors.updateRole"), "error");
      return false;
    }
    if (payload.mode === "create") {
      notify(
        payload.dto.copyFrom ? i18n.t("roles:roleDialog.duplicated") : i18n.t("roles:roleDialog.createdNext"),
        "success"
      );
      openRole(payload.dto.key);
      if (payload.dto.copyFrom) bumpAccess();
    } else {
      notify(i18n.t("roles:roleDialog.updated"), "success");
      bumpAccess();
    }
    return true;
  };

  const confirmSave = async () => {
    const ok = await admin.save();
    if (!ok) return;
    setReviewOpen(false);
    // Refresca la propia sesión: si quien edita tiene alguno de esos roles, su menú cambia ya.
    void dispatch(meThunk());
    bumpAccess();
    notify(i18n.t("roles:matrix.saved"), "success");
  };

  return {
    admin,
    members,
    policies,
    tab,
    setTab,
    selectedRole,
    openRole,
    accessUserId,
    accessPermission,
    accessVersion,
    openAccess,
    selectAccessUser,
    activityFilter,
    openActivity,
    setActivityFilter,
    roleDialog,
    openCreateRole: () => setRoleDialog({ open: true, role: null, copyFrom: null }),
    openEditRole: (role) => setRoleDialog({ open: true, role, copyFrom: null }),
    openDuplicateRole: (role) => setRoleDialog({ open: true, role: null, copyFrom: role }),
    closeRoleDialog: () => setRoleDialog((previous) => ({ ...previous, open: false })),
    submitRole,
    helpOpen,
    setHelpOpen,
    reviewOpen,
    setReviewOpen,
    confirmSave,
    tester,
    openTester: setTester,
    closeTester: () => setTester(null),
    toast,
    notify,
    clearToast: () => setToast(null),
  };
};
