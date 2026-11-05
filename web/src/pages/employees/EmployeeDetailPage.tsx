import { useState } from "react";
import {
  ITAlert,
  ITButton,
  ITFlex,
  ITPage,
  ITText,
} from "@axzydev/axzy_ui_system";
import { LuActivity, LuClock, LuFileText, LuIdCard, LuPencil, LuUserCog, LuUserRound, LuUserX } from "react-icons/lu";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useEmployeeDetail,
  EmployeeHero,
  EmployeeDocumentsCard,
  EmployeeActivity,
  EmployeeInfoCards,
  DeactivateDialog,
} from "@features/hr/employee-detail";
import { EmployeeCredentialDialog } from "@widgets/employee-credential";
import { useCan } from "@entities/user";
import { EmployeeClockSection } from "@widgets/employee-clock";
import { useGoBack } from "@shared/lib/useGoBack";
import { LangostinState } from "@shared/ui/langostin";
import { TabBar, type TabBarItem } from "@shared/ui/tab-bar";

type Section = "activity" | "documents" | "clock" | "info";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { t: tt } = useTranslation(["employees", "common"]);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [section, setSection] = useState<Section>("activity");
  /** La cuenta (usuario, contraseña, roles) se edita en Usuarios: solo ADMIN. */
  const canEditUser = useCan("users.edit");
  // El reloj lo ve quien lo administra o quien da de alta/baja personas en él (RH).
  const canManageClockDevices = useCan("time_clocks.manage");
  const canWriteClock = useCan("time_clock.write");
  const canManageClock = canManageClockDevices || canWriteClock;

  const detail = useEmployeeDetail(id);

  if (detail.loading || !detail.profile) {
    return (
      <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
        noPadding
        title={tt("detail.loadingTitle")}
        backAction={() => goBack("/employees")}
        icon={<LuUserRound size={20} />}
        breadcrumbs={[
          { label: tt("breadcrumb"), onClick: () => navigate("/employees") },
          { label: tt("detail.loadingTitle") },
        ]}
      >
        {detail.error ? (
          <ITAlert variant="error" dismissible onDismiss={() => detail.setError(null)}>
            {detail.error}
          </ITAlert>
        ) : (
          <LangostinState kind="loading" />
        )}
      </ITPage>
    );
  }

  const profile = detail.profile;
  // Documentos del expediente: tipos con al menos un archivo, del total de tipos.
  const docTypesDone = detail.documentTypes.filter((type) => detail.documents.some((d) => d.documentTypeId === type.id)).length;
  const sections: TabBarItem<Section>[] = [
    { id: "activity", label: tt("detail.sections.activity"), icon: <LuActivity size={13} /> },
    { id: "documents", label: tt("detail.sections.documents"), icon: <LuFileText size={13} /> },
    ...(canManageClock ? [{ id: "clock" as Section, label: tt("detail.sections.clock"), icon: <LuClock size={13} /> }] : []),
    { id: "info", label: tt("detail.sections.info"), icon: <LuIdCard size={13} /> },
  ];

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("detail.title")}
      description={tt("detail.subtitle")}
      backAction={() => goBack("/employees")}
      icon={<LuUserRound size={20} />}
      breadcrumbs={[
        { label: tt("breadcrumb"), onClick: () => navigate("/employees") },
        { label: profile.name },
      ]}
      actions={
        <ITFlex align="center" gap={2}>
          <ITButton variant="outlined" color="primary" size="lg" onClick={() => setCredentialOpen(true)}>
            <ITFlex align="center" gap={1}>
              <LuIdCard size={13} />
              <ITText className="font-bold text-[12px]">{tt("detail.credential")}</ITText>
            </ITFlex>
          </ITButton>
          {profile.active ? (
            <ITButton variant="outlined" color="error" size="lg" onClick={() => detail.setDeactivateOpen(true)}>
              <ITFlex align="center" gap={1}>
                <LuUserX size={13} />
                <ITText className="font-bold text-[12px]">{tt("detail.deactivate")}</ITText>
              </ITFlex>
            </ITButton>
          ) : (
            <ITButton variant="outlined" color="success" size="lg" onClick={detail.reactivate}>
              <ITText className="font-bold text-[12px]">{tt("detail.reactivate")}</ITText>
            </ITButton>
          )}
          <ITButton variant="filled" color="primary" size="lg" onClick={() => navigate(`/employees/${id}/edit`)}>
            <ITFlex align="center" gap={1}>
              <LuPencil size={13} />
              <ITText className="font-bold text-[12px]">{tt("detail.editInfo")}</ITText>
            </ITFlex>
          </ITButton>
          {/* El expediente edita a la persona; la cuenta (usuario, contraseña,
              roles) se edita en Usuarios. El enlace evita tener que buscarla. */}
          {canEditUser && (
            <ITButton variant="outlined" color="secondary" size="lg" onClick={() => navigate(`/users/${id}/edit`)}>
              <ITFlex align="center" gap={1}>
                <LuUserCog size={13} />
                <ITText className="font-bold text-[12px]">{tt("detail.editAccount")}</ITText>
              </ITFlex>
            </ITButton>
          )}
        </ITFlex>
      }
    >
      {detail.error && (
        <ITAlert variant="error" dismissible onDismiss={() => detail.setError(null)}>
          {detail.error}
        </ITAlert>
      )}
      {detail.clockNotice && (
        <ITAlert variant="info" dismissible onDismiss={detail.dismissClockNotice}>
          {detail.clockNotice}
        </ITAlert>
      )}

      <ITFlex direction="column" gap={5}>
        <EmployeeHero
          profile={profile}
          onPhotoUpload={detail.uploadPhoto}
          documents={{ done: docTypesDone, total: detail.documentTypes.length }}
        />

        <TabBar items={sections} value={section} onChange={setSection} />

        {section === "activity" && <EmployeeActivity userId={profile.id} />}
        {section === "documents" && (
          <EmployeeDocumentsCard
            documentTypes={detail.documentTypes}
            documents={detail.documents}
            onUpload={detail.uploadDocument}
            onRemove={detail.removeDocument}
          />
        )}
        {section === "clock" && canManageClock && <EmployeeClockSection userName={profile.name} userId={profile.id} />}
        {section === "info" && <EmployeeInfoCards profile={profile} />}
      </ITFlex>

      <DeactivateDialog
        isOpen={detail.deactivateOpen}
        onClose={() => detail.setDeactivateOpen(false)}
        onConfirm={detail.confirmDeactivate}
        userName={profile.name}
      />

      <EmployeeCredentialDialog
        isOpen={credentialOpen}
        onClose={() => setCredentialOpen(false)}
        profile={profile}
      />
    </ITPage>
  );
}
