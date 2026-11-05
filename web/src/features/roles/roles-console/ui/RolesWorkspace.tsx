import { ITAlert, ITDialog, ITToast, ITText, ITStack } from "@axzydev/axzy_ui_system";
import { FaGavel, FaHistory, FaListUl, FaTable, FaUserShield, FaUsersCog } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { LottieLoader } from "@shared/ui/lottie-loader";
import type { RolesWorkspaceState, WorkspaceTab } from "../model/useRolesWorkspace";
import AccessActivityPanel from "./activity/AccessActivityPanel";
import AccessSimulator from "./access/AccessSimulator";
import UserAccessExplorer from "./access/UserAccessExplorer";
import PermissionMatrixPanel from "./matrix/PermissionMatrixPanel";
import PermissionCatalogPanel from "./PermissionCatalogPanel";
import PoliciesPanel from "./policies/PoliciesPanel";
import RoleDetail from "./roles/RoleDetail";
import RolesSummary from "./roles/RolesSummary";
import RoleList from "./roles/RoleList";
import RoleEditorDialog from "./RoleEditorDialog";
import RolesHelpDialog from "./RolesHelpDialog";
import { ChangesReviewDialog, PendingChangesBar } from "./shared/PendingChanges";
import { TabBar, type TabBarItem } from "@shared/ui/tab-bar";

interface Props {
  workspace: RolesWorkspaceState;
}

/**
 * Consola de control de acceso (`/roles`): pestañas Roles · Comparar roles ·
 * Acceso por persona · Políticas · Catálogo · Actividad, la barra de cambios
 * sin guardar y los diálogos compartidos.
 */
export default function RolesWorkspace({ workspace }: Props) {
  const { t } = useTranslation("roles");
  const { admin, members, policies, tab, setTab } = workspace;
  const { data, rolesMeta, loading, error } = admin;

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <LottieLoader />
      </div>
    );
  }

  if (!data) {
    return (
      <ITAlert variant="error" dismissible={false}>
        {error ?? t("errors.load")}
      </ITAlert>
    );
  }

  const selectedMeta = rolesMeta.find((role) => role.key === workspace.selectedRole);

  const tabs: TabBarItem<WorkspaceTab>[] = [
    { id: "roles", label: t("tabs.roles"), icon: <FaUserShield size={11} />, count: data.roles.length, dot: admin.dirty },
    { id: "matrix", label: t("tabs.matrix"), icon: <FaTable size={11} />, dot: admin.dirty },
    { id: "access", label: t("tabs.access"), icon: <FaUsersCog size={11} /> },
    { id: "policies", label: t("tabs.policies"), icon: <FaGavel size={11} /> },
    { id: "catalog", label: t("tabs.catalog"), icon: <FaListUl size={11} /> },
    { id: "activity", label: t("tabs.activity"), icon: <FaHistory size={11} /> },
  ];

  return (
    <ITStack spacing={3}>
      {/* Resumen del control de acceso en una sola tarjeta */}
      <RolesSummary
        rolesMeta={rolesMeta}
        catalogTotal={data.catalog.length}
        people={members.members.length}
        policiesCount={policies.data?.policies.length ?? 0}
      />

      <TabBar items={tabs} value={tab} onChange={setTab} />

      {admin.roleError && tab === "roles" && !workspace.roleDialog.open && (
        <ITAlert variant="error" dismissible onDismiss={admin.clearRoleError}>
          {admin.roleError}
        </ITAlert>
      )}

      {tab === "roles" && (
        <div className="grid items-start gap-3 lg:!grid-cols-[240px_minmax(0,1fr)]">
          <RoleList admin={admin} selectedRole={workspace.selectedRole} onSelect={workspace.openRole} />
          {workspace.selectedRole && selectedMeta ? (
            <RoleDetail
              key={workspace.selectedRole}
              role={workspace.selectedRole}
              admin={admin}
              members={members}
              policies={policies}
              onEdit={workspace.openEditRole}
              onDuplicate={workspace.openDuplicateRole}
              onViewAccess={(userId) => workspace.openAccess(userId)}
              onTestPolicy={(permission) => workspace.openTester({ permission })}
              notify={workspace.notify}
            />
          ) : (
            <ITText className="py-16 text-center text-[12px] italic text-slate-400">{t("roleList.pick")}</ITText>
          )}
        </div>
      )}

      {tab === "matrix" && <PermissionMatrixPanel admin={admin} onOpenRole={workspace.openRole} />}

      {tab === "access" && (
        <UserAccessExplorer
          admin={admin}
          members={members}
          catalog={data.catalog}
          roles={data.roles}
          policies={policies.data?.policies ?? []}
          userId={workspace.accessUserId}
          onSelectUser={workspace.selectAccessUser}
          onTest={(userId, permission) =>
            workspace.openTester({ userId, permission: permission ?? workspace.accessPermission })
          }
          refreshKey={workspace.accessVersion}
          onOpenRole={workspace.openRole}
          notify={workspace.notify}
        />
      )}

      {tab === "policies" && (
        <PoliciesPanel
          policies={policies}
          onTest={(permission) => workspace.openTester({ permission })}
          notify={workspace.notify}
        />
      )}

      {tab === "catalog" && (
        <PermissionCatalogPanel
          modules={[...new Set(data.catalog.map((permission) => permission.module))]}
          onChanged={() => void admin.reload({ keepDraft: true })}
        />
      )}

      {tab === "activity" && (
        <AccessActivityPanel
          catalog={data.catalog}
          members={members.members}
          policies={policies.data?.policies ?? []}
          quickFilter={workspace.activityFilter}
          onQuickFilterChange={workspace.setActivityFilter}
          onViewAccess={workspace.openAccess}
        />
      )}

      <PendingChangesBar
        changes={admin.changeDetails}
        saving={admin.saving}
        onDiscard={admin.discard}
        onReview={() => workspace.setReviewOpen(true)}
      />

      <ChangesReviewDialog
        isOpen={workspace.reviewOpen}
        changes={admin.changeDetails}
        catalog={data.catalog}
        peopleOf={(role) => rolesMeta.find((item) => item.key === role)?.userCount ?? 0}
        saving={admin.saving}
        error={admin.saveError}
        onClose={() => workspace.setReviewOpen(false)}
        onConfirm={() => void workspace.confirmSave()}
      />

      <RoleEditorDialog
        isOpen={workspace.roleDialog.open}
        role={workspace.roleDialog.role}
        copyFrom={workspace.roleDialog.copyFrom}
        roles={rolesMeta}
        permissionCountOf={(role) => Object.keys(admin.permissionsByRole[role] ?? {}).length}
        saving={admin.roleSaving}
        onClose={workspace.closeRoleDialog}
        onSubmit={workspace.submitRole}
      />

      <RolesHelpDialog isOpen={workspace.helpOpen} onClose={() => workspace.setHelpOpen(false)} />

      <ITDialog
        isOpen={workspace.tester !== null}
        onClose={workspace.closeTester}
        title={t("simulator.title")}
        className="w-full !max-w-3xl"
      >
        <div className="max-h-[75vh] overflow-y-auto pr-1">
          <AccessSimulator
            catalog={data.catalog}
            actions={policies.data?.actions ?? []}
            members={members.members.filter((member) => member.active)}
            initialUserId={workspace.tester?.userId ?? null}
            initialPermission={workspace.tester?.permission ?? null}
          />
        </div>
      </ITDialog>

      {workspace.toast && (
        <ITToast
          message={workspace.toast.message}
          type={workspace.toast.type}
          position="bottom-center"
          duration={3000}
          onClose={workspace.clearToast}
        />
      )}
    </ITStack>
  );
}
