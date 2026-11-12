import { useEffect } from "react";
import { ITAlert, ITButton, ITDialog, ITInput, ITText } from "@axzydev/axzy_ui_system";
import { LuKeyRound, LuTrash2, LuUndo2, LuUserX } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import { DialogHeader } from "@shared/ui/dialog-header";
import { ITSearchSelect } from "@shared/ui/it-search-select";
import { useUserForm, UserFormFields } from "..";

interface Props {
  /** Cuenta a editar; `null` cierra el diálogo. */
  userId: string | null;
  onClose: () => void;
  /** Se llama tras guardar (la lista refresca). */
  onSaved?: () => void;
  /** Baja de la cuenta; sin ella no se muestra el estado. */
  onDeactivate?: (person: AccountPerson) => void;
  onReactivate?: (person: AccountPerson) => void;
  /** Borrado (solo cuentas dadas de baja). */
  onDelete?: (person: AccountPerson) => void;
}

interface AccountPerson {
  id: string;
  username: string;
  name: string;
  active: boolean;
}

/**
 * Credenciales de acceso de una cuenta: usuario, nueva contraseña, rol y su
 * estado (baja/reactivar). Los datos de la persona viven en su expediente;
 * solo se capturan aquí si la cuenta no tiene expediente.
 */
export default function UserEditDialog({ userId, onClose, onSaved, onDeactivate, onReactivate, onDelete }: Props) {
  const { t } = useTranslation(["users", "common"]);
  const navigate = useNavigate();
  const canSeeRecords = useCan("hr.records");
  const fx = useUserForm(userId ?? undefined);
  const { form, errors, loadedUser } = fx;

  useEffect(() => {
    fx.setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const save = async () => {
    const result = await fx.handleSubmit();
    if (!result.ok) return;
    onSaved?.();
    onClose();
  };

  const target: AccountPerson | null = loadedUser && { id: loadedUser.id, username: loadedUser.username, name: loadedUser.name, active: loadedUser.active };
  const runAndClose = (action: (person: AccountPerson) => void, person: AccountPerson) => {
    onClose();
    action(person);
  };

  return (
    <ITDialog isOpen={!!userId} onClose={onClose} className="max-w-xl">
      <DialogHeader
        icon={<LuKeyRound size={20} />}
        title={t("access.title", { name: loadedUser?.name ?? "…" })}
        subtitle={t("access.subtitle")}
      />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!fx.saving && !fx.loading) void save();
        }}
      >
        {fx.error && (
          <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
            {fx.error}
          </ITAlert>
        )}

        {fx.editsPerson && (
          <UserFormFields
            step="personal"
            isEdit
            personFields
            form={form}
            errors={errors}
            onFieldChange={fx.handleField}
            onBlur={fx.handleBlur}
            onDepartmentChange={fx.handleDepartmentChange}
            departments={fx.departments}
            selectedDept={fx.selectedDept}
            roleGuidance={fx.roleGuidance}
            roleOptions={fx.ROLE_OPTIONS}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <ITInput
            name="u_username"
            label={t("access.username")}
            value={form.username}
            onChange={(event) => fx.handleField("username", event.target.value)}
            onBlur={() => fx.handleBlur("username")}
            error={errors.username}
            touched={!!errors.username}
            required
          />
          <ITSearchSelect
            name="u_role"
            label={t("access.role")}
            options={fx.ROLE_OPTIONS}
            value={form.role}
            onChange={(event) => fx.handleField("role", event.target.value as never)}
            required
          />
          <div className="sm:col-span-2">
            <ITInput
              name="u_password"
              type="password"
              label={t("access.newPassword")}
              value={form.password}
              onChange={(event) => fx.handleField("password", event.target.value)}
              onBlur={() => fx.handleBlur("password")}
              error={errors.password}
              touched={!!errors.password}
            />
            <ITText className="mt-1 block text-xs text-slate-500">{t("access.newPasswordHint")}</ITText>
          </div>
        </div>

        {fx.hasRecord && (
          <ITText className="block text-xs text-slate-500">
            {t("access.personHint")}{" "}
            {canSeeRecords && userId && (
              <button type="button" className="font-semibold text-slate-700 underline underline-offset-2" onClick={() => navigate(`/employees/${userId}/edit`)}>
                {t("form.openRecord")}
              </button>
            )}
          </ITText>
        )}

        {target && onDeactivate && onReactivate && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <div>
              <ITText className="block text-[13px] font-semibold">{t("access.status")}</ITText>
              <ITText className="block text-xs text-slate-500">{t(target.active ? "access.statusActive" : "access.statusInactive")}</ITText>
            </div>
            <div className="flex gap-2">
              {target.active ? (
                <ITButton type="button" variant="outlined" color="danger" size="sm" onClick={() => runAndClose(onDeactivate, target)}>
                  <span className="inline-flex items-center gap-1.5"><LuUserX size={13} /> {t("access.deactivate")}</span>
                </ITButton>
              ) : (
                <>
                  <ITButton type="button" variant="outlined" color="success" size="sm" onClick={() => runAndClose(onReactivate, target)}>
                    <span className="inline-flex items-center gap-1.5"><LuUndo2 size={13} /> {t("access.reactivate")}</span>
                  </ITButton>
                  {onDelete && (
                    <ITButton type="button" variant="outlined" color="danger" size="sm" onClick={() => runAndClose(onDelete, target)}>
                      <span className="inline-flex items-center gap-1.5"><LuTrash2 size={13} /> {t("access.delete")}</span>
                    </ITButton>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <ITButton type="button" variant="outlined" color="secondary" onClick={onClose} disabled={fx.saving}>
            {t("common:actions.cancel")}
          </ITButton>
          <ITButton type="submit" variant="filled" color="primary" disabled={fx.saving || fx.loading}>
            {fx.saving ? t("form.saving") : t("form.save")}
          </ITButton>
        </div>
      </form>
    </ITDialog>
  );
}
