import { useState } from "react";
import {
  FileTypeEnum,
  ITAlert,
  ITButton,
  ITCheckbox,
  ITDialog,
  ITDropfile,
  ITFlex,
  ITGrid,
  ITInput,
  ITSearchSelect,
  ITSelect,
  ITText,
} from "@axzydev/axzy_ui_system";
import { LuCircleCheck, LuCircleHelp, LuLock } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Department } from "@entities/department";
import { roleLabel } from "@entities/user";
import { DialogHeader } from "@shared/ui/dialog-header";
import type { UserFormValues } from "../model/useUserForm";
import type { UniqueState, UniqueField } from "../model/useUserForm";

/** Aviso debajo de un dato único: "Disponible" cuando está libre. Mientras verifica, Langostin flota abajo a la derecha. */
function UniqueHint({ state }: { state?: UniqueState }) {
  const { t: tt } = useTranslation("users");
  if (state === "available") {
    return (
      <ITText as="span" className="mt-1 flex items-center gap-1 text-[12px]" style={{ color: "var(--color-success)" }}>
        <LuCircleCheck size={13} />
        {tt("form.available")}
      </ITText>
    );
  }
  return null;
}

/**
 * Campos de un paso del formulario de usuario. No dibujan tarjeta ni título:
 * la página los envuelve en `FormSection` y el diálogo en un bloque simple.
 */
interface Props {
  step: "personal" | "access" | "org" | "docs";
  uniqueness?: Record<UniqueField, UniqueState>;
  isEdit: boolean;
  /**
   * ¿Se editan aquí los datos de la persona (nombre, apellidos, correo, nº de
   * empleado y puesto)? `false` cuando la cuenta tiene expediente: esos campos
   * viven en `/employees/:id/edit` y este paso no se muestra.
   */
  personFields?: boolean;
  form: UserFormValues;
  errors?: Record<string, string>;
  onFieldChange: (field: keyof UserFormValues, value: string) => void;
  onBlur?: (field: keyof UserFormValues) => void;
  onDepartmentChange: (value: string) => void;
  departments: Department[];
  selectedDept: Department | undefined;
  roleGuidance: { title: string; summary: string; actions: string[] };
  roleOptions: Array<Record<string, string>>;
  /** Roles adicionales disponibles (multi-rol), sin el principal. */
  extraRoleOptions?: Array<{ value: string; label: string }>;
  onToggleExtraRole?: (role: string, checked: boolean) => void;
  // Documentación del alta
  requiredDocs?: Array<{ key: string; label: string; typeId: string | null }>;
  docsFiles?: Record<string, File | null>;
  onPickDoc?: (key: string, file: File) => void;
  docsError?: string | null;
}

export default function UserFormFields({
  step,
  uniqueness,
  isEdit,
  personFields = true,
  form,
  errors,
  onFieldChange,
  onBlur,
  onDepartmentChange,
  departments,
  selectedDept,
  roleGuidance,
  roleOptions,
  extraRoleOptions,
  onToggleExtraRole,
  requiredDocs,
  onPickDoc,
  docsError,
}: Props) {
  const { t: tt } = useTranslation(["users", "common"]);
  const activeDepartments = departments.filter((d) => d.active);
  const fieldError = (key: string) => errors?.[key];
  const blob = (field: keyof UserFormValues) => () => onBlur?.(field);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      {step === "personal" && personFields && (
        <>
          <ITGrid container columns={12} spacing={4}>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_name" label={tt("form.name")} value={form.name} onChange={(e) => onFieldChange("name", e.target.value)} onBlur={blob("name")} required error={fieldError("name")} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_second" label={tt("form.secondName")} value={form.middleName} onChange={(e) => onFieldChange("middleName", e.target.value)} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_apa" label={tt("form.paternalSurname")} value={form.paternalSurname} onChange={(e) => onFieldChange("paternalSurname", e.target.value)} onBlur={blob("paternalSurname")} required={!isEdit} error={fieldError("paternalSurname")} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_ama" label={tt("form.maternalSurname")} value={form.maternalSurname} onChange={(e) => onFieldChange("maternalSurname", e.target.value)} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_email" type="email" label={tt("form.email")} value={form.email} onChange={(e) => onFieldChange("email", e.target.value)} onBlur={blob("email")} placeholder={tt("form.emailPlaceholder")} required={!isEdit} error={fieldError("email")} />
              <UniqueHint state={uniqueness?.email} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_num" label={tt("form.employeeNo")} value={form.employeeNumber} onChange={(e) => onFieldChange("employeeNumber", e.target.value)} onBlur={blob("employeeNumber")} required={!isEdit} error={fieldError("employeeNumber")} />
              <UniqueHint state={uniqueness?.employeeNumber} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_jobTitle" label={tt("form.position")} value={form.jobTitle} onChange={(e) => onFieldChange("jobTitle", e.target.value)} onBlur={blob("jobTitle")} error={fieldError("jobTitle")} />
            </ITGrid>
          </ITGrid>
        </>
      )}

      {step === "access" && (
        <>
          <ITGrid container columns={12} spacing={4}>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_username" label={tt("form.username")} value={form.username} onChange={(e) => onFieldChange("username", e.target.value)} onBlur={blob("username")} required error={fieldError("username")} />
              <UniqueHint state={uniqueness?.username} />
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITFlex align="end" gap={2}>
                <ITFlex className="flex-1">
                  <ITSelect name="u_role" label={tt("form.role")} options={roleOptions} value={form.role} onChange={(e) => onFieldChange("role", e.target.value as any)} required />
                </ITFlex>
                <ITButton variant="icon-only" size="sm" color="gray" onClick={() => setHelpOpen(true)} ariaLabel={tt("form.roleGuide")} title={tt("form.roleGuide")}>
                  <LuCircleHelp size={14} />
                </ITButton>
              </ITFlex>
            </ITGrid>
            <ITGrid item xs={12} md={4}>
              <ITInput name="u_password" type="password" label={`${tt("form.password")} ${!isEdit ? "*" : ""}`} value={form.password} onChange={(e) => onFieldChange("password", e.target.value)} onBlur={blob("password")} required={!isEdit} placeholder={isEdit ? tt("form.passwordPlaceholder") : ""} error={fieldError("password")} />
              {isEdit && (
                <ITFlex align="center" gap={2} className="mt-1">
                  <LuLock size={11} className="text-slate-400" />
                  <ITText className="text-[12px] text-slate-500">{tt("form.passwordEditHint")}</ITText>
                </ITFlex>
              )}
            </ITGrid>
            <ITGrid item xs={12}>
              <ITFlex direction="column" gap={2}>
                <ITText className="text-[13px] font-semibold text-slate-600">
                  {tt("form.extraRoles")}
                </ITText>
                <ITText className="text-[12px] text-slate-500">
                  {tt("form.extraRolesHint")}
                </ITText>
                <ITFlex align="center" gap={4} wrap="wrap">
                  {(extraRoleOptions ?? []).map((opt) => (
                    <ITCheckbox
                      key={opt.value}
                      name={`extra_role_${opt.value}`}
                      checked={form.roles.includes(opt.value)}
                      onChange={(checked) => onToggleExtraRole?.(opt.value, checked)}
                      label={opt.label}
                    />
                  ))}
                </ITFlex>
              </ITFlex>
            </ITGrid>
          </ITGrid>
        </>
      )}

      {step === "org" && (
        <>
          <ITGrid container columns={12} spacing={4}>
            <ITGrid item xs={12} md={6}>
              <ITSearchSelect name="u_dept" label={tt("form.department")} options={activeDepartments.map((d) => ({ value: d.id, label: d.name }))} value={form.departmentId} onChange={(value) => onDepartmentChange(String(value))} />
            </ITGrid>
            <ITGrid item xs={12} md={6}>
              <ITSearchSelect name="u_sub" label={tt("form.subarea")} options={(selectedDept?.subareas ?? []).map((s) => ({ value: s.id, label: s.name }))} value={form.subareaId} onChange={(value) => onFieldChange("subareaId", String(value))} />
            </ITGrid>
          </ITGrid>
        </>
      )}

      {step === "docs" && (
        <>
          {docsError && (
            <ITFlex className="mb-3">
              <ITAlert variant="error" dismissible={false}>
                {docsError}
              </ITAlert>
            </ITFlex>
          )}
          <ITGrid container columns={12} spacing={4}>
            {(requiredDocs ?? []).map((doc) => (
              <ITGrid item xs={12} md={6} key={doc.key}>
                <ITFlex direction="column" gap={1}>
                  <ITText className="text-[13px] font-semibold text-slate-600">{doc.label}</ITText>
                  <ITDropfile
                    autoUpload
                    onFileSelect={() => undefined}
                    onSubmit={(file) => onPickDoc?.(doc.key, file)}
                    acceptedFileTypes={[
                      FileTypeEnum.PNG,
                      FileTypeEnum.JPG,
                      FileTypeEnum.JPEG,
                      FileTypeEnum.PDF,
                    ]}
                    showStatusBadge
                  />
                </ITFlex>
              </ITGrid>
            ))}
          </ITGrid>
        </>
      )}

      <ITDialog isOpen={helpOpen} onClose={() => setHelpOpen(false)} className="max-w-md">
        <DialogHeader icon={<LuCircleHelp size={20} />} title={tt("form.roleGuide")} subtitle={roleLabel(form.role)} tone="info" />
        <div className="space-y-3">
          <ITText className="m-0 text-[14px] font-bold text-slate-800">{roleGuidance.title}</ITText>
          <ITText className="m-0 text-[13px] leading-5 text-slate-600">{roleGuidance.summary}</ITText>
          <ul className="m-0 list-none space-y-2 p-0 text-[13px] text-slate-600">
            {roleGuidance.actions.map((action) => (
              <li key={action} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-primary)" }} />
                {action}
              </li>
            ))}
          </ul>
          <ITText className="m-0 rounded-xl px-3 py-2 text-[12.5px] text-slate-500" style={{ background: "var(--color-secondary-100)" }}>
            {tt("form.roleVsPermissions")}
          </ITText>
        </div>
      </ITDialog>
    </>
  );
}

