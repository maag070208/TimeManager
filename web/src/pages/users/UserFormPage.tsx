import type { KeyboardEvent } from "react";
import { ITAlert, ITButton, ITPage, ITStack } from "@axzydev/axzy_ui_system";
import { LuBuilding2, LuFileUp, LuIdCard, LuShieldCheck, LuUserPlus } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  UserFormFields,
  useUserForm,
} from "@features/user/user-form";
import { useGoBack } from "@shared/lib/useGoBack";
import { FormSection } from "@shared/ui/form-section";
import { LangostinState } from "@shared/ui/langostin";
import { LiveSummary, LiveSummaryRow } from "@shared/ui/live-summary";
import { StickyActions } from "@shared/ui/sticky-actions";

interface AppStep {
  label: string;
  description?: string;
  complete: boolean;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

/** Clave de la guía de Langostin para cada campo (por el `name` del input). */

export default function UserFormPage() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation(["users", "common"]);

  const userForm = useUserForm();
  const { isEdit } = userForm;

  // Campo del formulario (`name` del input) para cada dato con error.
  const INPUT_NAME: Partial<Record<keyof typeof userForm.form, string>> = {
    name: "u_name",
    username: "u_username",
    password: "u_password",
    email: "u_email",
    employeeNumber: "u_num",
    jobTitle: "u_jobTitle",
  };

  const handleFinish = () => {
    userForm.handleSubmit().then((result) => {
      if (result.ok) {
        goBack("/users");
        return;
      }
      const input = result.field ? INPUT_NAME[result.field] : undefined;
      if (input) document.querySelector<HTMLInputElement>(`[name="${input}"]`)?.focus();
    });
  };

  const title = isEdit ? tt("form.titleEdit") : tt("form.titleNew");
  const description = isEdit
    ? tt("form.descriptionEdit")
    : tt("form.descriptionNew");
  const breadcrumb = isEdit ? tt("form.breadcrumbEdit") : tt("form.breadcrumbNew");

  if (userForm.loading) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={title}
        description={description}
        loading
        backAction={() => goBack("/users")}
        icon={<LuUserPlus size={20} />}
        breadcrumbs={[
          { label: tt("list.breadcrumb"), onClick: () => navigate("/users") },
          { label: breadcrumb },
        ]}
      >
        <LangostinState kind="loading" />
      </ITPage>
    );
  }

  const fieldsProps = {
    isEdit,
    personFields: true,
    form: userForm.form,
    errors: userForm.errors,
    onFieldChange: userForm.handleField,
    onBlur: userForm.handleBlur,
    onDepartmentChange: userForm.handleDepartmentChange,
    departments: userForm.departments,
    selectedDept: userForm.selectedDept,
    roleGuidance: userForm.roleGuidance,
    roleOptions: userForm.ROLE_OPTIONS,
    extraRoleOptions: userForm.EXTRA_ROLE_OPTIONS,
    onToggleExtraRole: userForm.toggleExtraRole,
    requiredDocs: userForm.requiredDocs,
    docsFiles: userForm.docsFiles,
    onPickDoc: userForm.setDocFile,
    docsError: userForm.docsError,
    uniqueness: userForm.uniqueness,
  };

  // Enter pasa al siguiente campo del formulario, como en un formulario normal.
  const handleEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.key !== "Enter" || target.tagName !== "INPUT" || target.getAttribute("role") === "combobox") return;
    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
      (el) => !(el as HTMLInputElement).disabled && (el as HTMLInputElement).type !== "hidden" && el.tabIndex !== -1
    );
    const next = fields[fields.indexOf(target) + 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const f = userForm.form;
  // Error del formulario: apaga la palomita de cada paso.
  const hasErrors = Object.keys(userForm.errors).length > 0 || Boolean(userForm.docsError);
  const steps: AppStep[] = [
    {
      label: tt("form.sectionPersonal"),
      description: tt("form.sectionPersonalHint"),
      icon: <LuIdCard size={15} />,
      complete: !!f.name.trim() && !!f.paternalSurname.trim() && !!f.email.trim() && !!f.employeeNumber.trim() && !hasErrors,
      content: <UserFormFields step="personal" {...fieldsProps} />,
    },
    {
      label: tt("form.sectionAccess"),
      description: tt("form.sectionAccessHint"),
      icon: <LuShieldCheck size={15} />,
      complete: !!f.username.trim() && (isEdit || !!f.password) && !!f.role && !hasErrors,
      content: <UserFormFields step="access" {...fieldsProps} />,
    },
    {
      label: tt("form.sectionOrganization"),
      description: tt("form.sectionOrganizationHint"),
      icon: <LuBuilding2 size={15} />,
      complete: !!f.departmentId,
      content: <UserFormFields step="org" {...fieldsProps} />,
    },
    ...(userForm.requiresDocs
      ? [
          {
            label: tt("form.stepDocs"),
            description: tt("form.docsHint", { docs: userForm.requiredDocs.map((d) => d.label).join(", ") }),
            icon: <LuFileUp size={15} />,
            complete: userForm.requiredDocs.every((d) => userForm.docsFiles[d.key]) && !userForm.docsError,
            content: <UserFormFields step="docs" {...fieldsProps} />,
          },
        ]
      : []),
  ];
  const roleName = userForm.ROLE_OPTIONS.find((option) => option.value === f.role)?.label;
  const departmentName = userForm.departments.find((d) => d.id === f.departmentId)?.name;
  const fullName = [f.name, f.paternalSurname, f.maternalSurname].map((part) => part.trim()).filter(Boolean).join(" ");

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={title}
      description={description}
      backAction={() => goBack("/users")}
      icon={<LuUserPlus size={20} />}
      breadcrumbs={[
        { label: tt("list.breadcrumb"), onClick: () => navigate("/users") },
        { label: breadcrumb },
      ]}
    >
      {userForm.error && (
        <ITAlert
          variant="error"
          dismissible
          onDismiss={() => userForm.setError(null)}
        >
          {userForm.error}
        </ITAlert>
      )}


      <div onKeyDown={handleEnter} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ITStack className="min-w-0" spacing={5}>
          {steps.map((section, index) => (
            <FormSection
              key={section.label}
              number={index + 1}
              title={section.label}
              description={section.description}
              icon={section.icon}
              complete={section.complete}
            >
              {section.content}
            </FormSection>
          ))}
        </ITStack>

        <LiveSummary total={steps.length} done={steps.filter((section) => section.complete).length}>
          <LiveSummaryRow label={tt("form.name")} value={fullName} />
          <LiveSummaryRow label={tt("form.username")} value={f.username.trim() ? `@${f.username.trim()}` : undefined} />
          <LiveSummaryRow label={tt("form.role")} value={roleName} />
          <LiveSummaryRow label={tt("form.department")} value={departmentName} />
          <LiveSummaryRow label={tt("form.email")} value={f.email.trim()} />
        </LiveSummary>
      </div>

      <StickyActions>
        <ITButton variant="outlined" color="gray" className="!rounded-full" onClick={() => goBack("/users")} disabled={userForm.saving}>
          {tt("form.cancel")}
        </ITButton>
        <ITButton variant="rounded" color="primary" onClick={handleFinish} disabled={userForm.saving}>
          {userForm.saving ? tt("form.saving") : isEdit ? tt("form.save") : tt("form.create")}
        </ITButton>
      </StickyActions>

    </ITPage>
    );
}
