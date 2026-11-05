import { useEffect, useState } from "react";
import { ITAlert, ITButton, ITDialog, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { LuUserCog, LuUserPen } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCan } from "@entities/user";
import { usePrefersReducedMotion } from "@shared/lib/usePrefersReducedMotion";
import { DialogHeader } from "@shared/ui/dialog-header";
import { Langostin, type LangostinAnim } from "@shared/ui/langostin";
import { useUserForm, UserFormFields } from "..";

interface Props {
  /** Usuario a editar; `null` cierra el diálogo. */
  userId: string | null;
  onClose: () => void;
  /** Se llama tras guardar (la lista refresca). */
  onSaved?: () => void;
}

/**
 * Edición de una cuenta en un diálogo, sobre la lista de Usuarios.
 *
 * Edita lo que es de la CUENTA: acceso (usuario, contraseña, roles) y
 * organización (departamento y subárea). Los datos de la persona y los
 * laborales (nombre, correo, nº de empleado, puesto) viven en su expediente
 * (`/employees/:id/edit`) y aquí solo se capturan si la cuenta no tiene
 * expediente, que es su único lugar.
 */
export default function UserEditDialog({ userId, onClose, onSaved }: Props) {
  const { t: tt } = useTranslation(["users", "common"]);
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const canSeeRecords = useCan("hr.records");
  const reduced = usePrefersReducedMotion();
  const userForm = useUserForm(userId ?? undefined);
  const { editsPerson, hasRecord, loading } = userForm;

  // Al cambiar de usuario se limpia el estado de la corrida anterior.
  useEffect(() => {
    setSaved(false);
    userForm.setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSave = async () => {
    const result = await userForm.handleSubmit();
    if (!result.ok) return;
    setSaved(true);
    onSaved?.();
  };

  // Langostín reacciona al estado del guardado (nivel L3).
  const hasErrors = Object.keys(userForm.errors).length > 0;
  const anim: LangostinAnim = userForm.saving ? "work" : userForm.error || hasErrors ? "err" : saved ? "ok" : "help";

  return (
    <ITDialog
      isOpen={!!userId}
      onClose={onClose}
      className="max-w-3xl"
    >
      <DialogHeader icon={<LuUserPen size={20} />} title={tt("form.titleEdit")} subtitle={tt("form.descriptionEdit")} />
      <div
        className="max-h-[60vh] overflow-y-auto pr-1"
        onKeyDown={(event) => {
          // Enter guarda, salvo en listas desplegables y áreas de texto.
          const target = event.target as HTMLElement;
          if (event.key !== "Enter" || target.tagName !== "INPUT" || target.getAttribute("role") === "combobox" || (target as HTMLInputElement).type === "checkbox") return;
          event.preventDefault();
          if (!userForm.saving && !loading) void handleSave();
        }}
      >
      <ITFlex direction="column" gap={5}>
        {userForm.error && (
          <ITAlert variant="error" dismissible onDismiss={() => userForm.setError(null)}>
            {userForm.error}
          </ITAlert>
        )}
        {saved && <ITAlert variant="success">{tt("form.saved")}</ITAlert>}

        {/* Con expediente, los datos de la persona se editan en Personal. */}
        {hasRecord && (
          <ITFlex align="center" justify="between" wrap="wrap" gap={2} className="rounded-xl bg-[var(--color-warning-soft)] px-3 py-2">
            <ITFlex align="center" gap={2}>
              <LuUserCog size={14} className="text-[color:color-mix(in_srgb,var(--color-warning)_70%,black)]" />
              <ITText className="!text-[12.5px] text-slate-600">{tt("form.personElsewhere")}</ITText>
            </ITFlex>
            {canSeeRecords && userId && (
              <ITButton
                variant="outlined"
                color="primary"
                size="sm"
                onClick={() => navigate(`/employees/${userId}/edit`)}
              >
                <ITText className="!text-[12px] font-bold">{tt("form.openRecord")}</ITText>
              </ITButton>
            )}
          </ITFlex>
        )}

        {editsPerson && (
          <section>
          <ITText as="h3" className="m-0 mb-3 !text-[14px] font-bold !text-slate-700">{tt("form.sectionPersonal")}</ITText>
          <UserFormFields
            step="personal"
            isEdit
            personFields
            form={userForm.form}
            errors={userForm.errors}
            onFieldChange={userForm.handleField}
            onBlur={userForm.handleBlur}
            onDepartmentChange={userForm.handleDepartmentChange}
            departments={userForm.departments}
            selectedDept={userForm.selectedDept}
            roleGuidance={userForm.roleGuidance}
            roleOptions={userForm.ROLE_OPTIONS}
          />
          </section>
        )}
        <section>
        <ITText as="h3" className="m-0 mb-3 !text-[14px] font-bold !text-slate-700">{tt("form.sectionAccess")}</ITText>
        <UserFormFields
          step="access"
          isEdit
          form={userForm.form}
          errors={userForm.errors}
          onFieldChange={userForm.handleField}
          onBlur={userForm.handleBlur}
          onDepartmentChange={userForm.handleDepartmentChange}
          departments={userForm.departments}
          selectedDept={userForm.selectedDept}
          roleGuidance={userForm.roleGuidance}
          roleOptions={userForm.ROLE_OPTIONS}
          extraRoleOptions={userForm.EXTRA_ROLE_OPTIONS}
          onToggleExtraRole={userForm.toggleExtraRole}
        />
        </section>
        <section>
        <ITText as="h3" className="m-0 mb-3 !text-[14px] font-bold !text-slate-700">{tt("form.sectionOrganization")}</ITText>
        <UserFormFields
          step="org"
          isEdit
          form={userForm.form}
          errors={userForm.errors}
          onFieldChange={userForm.handleField}
          onBlur={userForm.handleBlur}
          onDepartmentChange={userForm.handleDepartmentChange}
          departments={userForm.departments}
          selectedDept={userForm.selectedDept}
          roleGuidance={userForm.roleGuidance}
          roleOptions={userForm.ROLE_OPTIONS}
        />

        </section>
      </ITFlex>
      </div>

      {/* Pie fijo: no se mueve al hacer scroll en el cuerpo. */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <Langostin anim={anim} size={44} animated={!reduced} label={tt("form.guideLabel")} />
        <ITFlex gap={2}>
          <ITButton variant="outlined" color="gray" className="!rounded-full" onClick={onClose}>
            <ITText className="!text-[12px] font-bold">{tt("common:actions.cancel")}</ITText>
          </ITButton>
          <ITButton
            variant="rounded"
            color="primary"
            onClick={() => void handleSave()}
            disabled={userForm.saving || loading}
          >
            <ITText className="!text-[12px] font-bold">
              {userForm.saving ? tt("form.saving") : tt("form.save")}
            </ITText>
          </ITButton>
        </ITFlex>
      </div>
    </ITDialog>
  );
}
