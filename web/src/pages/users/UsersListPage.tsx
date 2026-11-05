import {
  ITBentoStatStrip,
  ITButton,
  ITDialog,
  ITFlex,
  ITInput,
  ITPage,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import { LuFileSpreadsheet, LuKeyRound, LuPlus, LuUserCog } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import {
  useUsersList,
  UsersTable,
} from "@features/user/users-list";
import { UserEditDialog } from "@features/user/user-form";
import { DeactivateDialog } from "@features/hr/employee-detail";
import { useGoBack } from "@shared/lib/useGoBack";
import { DialogHeader } from "@shared/ui/dialog-header";
import { LangostinConfirm } from "@shared/ui/langostin-confirm";

export default function UsersListPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  // La edición es un diálogo sobre la lista: `/users/:id/edit` lo abre, así que
  // los enlaces directos (y el botón del expediente) siguen funcionando.
  const { id: editingId } = useParams<{ id: string }>();
  const { t: tt } = useTranslation(["users", "common"]);
  const canManageUsers = useCan("users.view");
  // Alta e importación crean cuentas (`POST /users`, `/users/import`): la API exige `users.create`.
  const canCreateUsers = useCan("users.create");

  const fx = useUsersList();

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      title={tt("list.title")}
      description={tt("list.description", { count: fx.total })}
      backAction={() => goBack("/")}
      noPadding
      breadcrumbs={[
        { label: tt("common:breadcrumbs.home"), onClick: () => navigate("/") },
        { label: tt("list.breadcrumb") },
      ]}
      actions={
        canCreateUsers ? (
          <ITFlex gap={2}>
            <ITButton
              variant="outlined"
              color="secondary"
              onClick={() => navigate("/users/import")}
            >
              <ITFlex align="center" gap={1}>
                <LuFileSpreadsheet size={14} />
                <ITText className="font-bold text-[12px]">{tt("list.importExcel")}</ITText>
              </ITFlex>
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              onClick={() => navigate("/users/new")}
            >
              <ITFlex align="center" gap={1}>
                <LuPlus size={14} />
                <ITText className="font-bold text-[12px]">{tt("list.new")}</ITText>
              </ITFlex>
            </ITButton>
          </ITFlex>
        ) : undefined
      }
      icon={<LuUserCog size={20} />}
    >
      {/* Cifras reales de las cuentas, como en Personal */}
      {fx.counts && (
        <ITBentoStatStrip
          items={[
            { id: "all", label: tt("list.summary.all"), value: fx.counts.total, tone: "sea", color: "var(--color-primary-600)" },
            { id: "active", label: tt("list.summary.active"), value: fx.counts.active, tone: "mint", color: "var(--color-success)" },
            { id: "inactive", label: tt("list.summary.inactive"), value: fx.counts.inactive, tone: "sun", color: "var(--color-warning)" },
          ]}
        />
      )}

      <UsersTable
        fx={fx}
        onView={(u) => navigate(`/employees/${u.id}`)}
        onEdit={(u) => navigate(`/users/${u.id}/edit`)}
      />

      <UserEditDialog
        userId={editingId ?? null}
        onClose={() => goBack("/users")}
        onSaved={fx.reload}
      />

      {/* Para usuarios activos, baja con captura de motivo */}
      <DeactivateDialog
        isOpen={!!fx.userToToggle && fx.userToToggle.active}
        onClose={() => fx.setUserToToggle(null)}
        onConfirm={(reason) => fx.handleDeactivate(reason)}
        userName={fx.userToToggle?.active ? fx.userToToggle.name : undefined}
      />

      {/* Para usuarios ya inactivos, confirmación de borrado físico */}
      <LangostinConfirm
        isOpen={!!fx.userToToggle && !fx.userToToggle.active}
        onClose={() => fx.setUserToToggle(null)}
        onConfirm={() => fx.handleToggleActive(canManageUsers)}
        title={tt("list.deleteQuestion", { username: fx.userToToggle?.username ?? "" })}
        message={tt("list.deleteConsequence")}
        confirmLabel={tt("list.confirmDeleteBtn")}
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
      />

      <LangostinConfirm
        isOpen={!!fx.userToForceDelete}
        onClose={() => fx.setUserToForceDelete(null)}
        onConfirm={fx.handleForceDelete}
        title={tt("list.forceDeleteQuestion", { username: fx.userToForceDelete?.username ?? "" })}
        message={tt("list.forceDeleteMessage", { username: fx.userToForceDelete?.username ?? "" })}
        confirmLabel={tt("list.forceDeleteBtn")}
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
      />

      <LangostinConfirm
        isOpen={!!fx.userToReactivate}
        onClose={() => fx.setUserToReactivate(null)}
        onConfirm={fx.handleReactivate}
        title={tt("list.reactivateQuestion", { username: fx.userToReactivate?.username ?? "" })}
        message={tt("list.reactivateMsgShort")}
        confirmLabel={tt("list.reactivateBtn")}
        cancelLabel={tt("common:actions.cancel")}
        variant="success"
      />

      {/* Contraseña nueva: modal M2 con encabezado y pie fijo. Enter guarda. */}
      <ITDialog
        isOpen={!!fx.userToPassword}
        onClose={() => fx.setUserToPassword(null)}
        className="max-w-md"
      >
        <DialogHeader
          icon={<LuKeyRound size={20} />}
          tone="success"
          title={tt("list.passwordHeading")}
          subtitle={fx.userToPassword ? `@${fx.userToPassword.username}` : undefined}
        />
        <ITFlex direction="column" gap={3}>
          <div
            onKeyDown={(event) => {
              if (event.key === "Enter" && fx.newPassword.trim()) {
                event.preventDefault();
                void fx.handleChangePassword();
              }
            }}
          >
            <ITInput
              name="newPassword"
              type="password"
              label={tt("list.passwordLabel")}
              value={fx.newPassword}
              onChange={(e) => fx.setNewPassword(e.target.value)}
              placeholder={tt("list.passwordPlaceholder")}
              autoFocus
            />
          </div>
          <ITFlex justify="end" gap={2} className="pt-2">
            <ITButton variant="outlined" color="gray" className="!rounded-full" onClick={() => fx.setUserToPassword(null)}>
              {tt("common:actions.cancel")}
            </ITButton>
            <ITButton
              variant="rounded"
              color="primary"
              onClick={fx.handleChangePassword}
              disabled={!fx.newPassword.trim()}
            >
              <ITText className="font-bold text-[12px]">{tt("list.passwordBtn")}</ITText>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>

      {fx.toast && (
        <ITToast
          message={fx.toast.message}
          type={fx.toast.type}
          position="bottom-center"
          duration={2500}
          onClose={() => fx.setToast(null)}
        />
      )}
    </ITPage>
  );
}