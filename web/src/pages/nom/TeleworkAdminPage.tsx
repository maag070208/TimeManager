import { useCallback, useEffect, useState } from "react";
import {
  ITBadget,
  ITButton,
  ITCard,
  ITFlex,
  ITInput,
  ITPage,
  ITSelect,
  ITText,
  ITTextarea,
} from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LuBriefcaseBusiness, LuRefreshCw } from "react-icons/lu";
import {
  nomApi,
  type OutOfHoursContact,
  type TeleworkChecklist,
  type TeleworkMode,
  type TeleworkPolicyTexts,
  type TeleworkRegistration,
} from "@entities/nom";
import { usersApi, type User } from "@entities/user";
import { ContentSkeleton } from "@shared/ui/content-skeleton";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

/**
 * Administración NOM-037 (F2-08): política de teletrabajo/desconexión y aviso
 * de privacidad por cliente, alta/baja de teletrabajadores, checklists
 * recibidos y registro de comunicaciones fuera de jornada.
 */
export default function TeleworkAdminPage() {
  const { t } = useTranslation("nom");
  const tr = t as unknown as (key: string, vars?: Record<string, unknown>) => string;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [policy, setPolicy] = useState<TeleworkPolicyTexts | null>(null);
  const [policyForm, setPolicyForm] = useState({
    teleworkPolicy: "",
    disconnectPolicy: "",
    privacyNotice: "",
  });
  const [registrations, setRegistrations] = useState<TeleworkRegistration[]>([]);
  const [checklists, setChecklists] = useState<TeleworkChecklist[]>([]);
  const [contacts, setContacts] = useState<OutOfHoursContact[]>([]);
  const [people, setPeople] = useState<User[]>([]);

  const [newRegistration, setNewRegistration] = useState<{
    userId: string;
    mode: TeleworkMode;
    homeAddress: string;
  }>({ userId: "", mode: "REMOTO", homeAddress: "" });
  const [newContact, setNewContact] = useState<{
    userId: string;
    channel: "CALL" | "MESSAGE" | "EMAIL" | "OTHER";
    reason: string;
  }>({ userId: "", channel: "CALL", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policyData, regs, checklistRows, contactRows, employees] = await Promise.all([
        nomApi.teleworkPolicy(),
        nomApi.teleworkRegistrations(),
        nomApi.teleworkChecklists(),
        nomApi.outOfHoursContacts(),
        usersApi.employees(),
      ]);
      setPolicy(policyData);
      setPolicyForm({
        teleworkPolicy: policyData.teleworkPolicy ?? "",
        disconnectPolicy: policyData.disconnectPolicy ?? "",
        privacyNotice: policyData.privacyNotice ?? "",
      });
      setRegistrations(regs);
      setChecklists(checklistRows);
      setContacts(contactRows);
      setPeople(employees);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const peopleOptions = [
    { value: "", label: "—" },
    ...people.map((person) => ({
      value: person.id,
      label: person.employeeNumber ? `${person.name} (${person.employeeNumber})` : person.name,
    })),
  ];

  return (
    <ITPage
      title={t("admin.title")}
      description={t("admin.description")}
      icon={<LuBriefcaseBusiness size={20} />}
      maxWidth="5xl"
      actions={
        <ITButton variant="outlined" color="secondary" size="lg" onClick={() => void load()}>
          <LuRefreshCw size={14} className="mr-1" />
          {t("refresh")}
        </ITButton>
      }
    >
      <ITFlex direction="column" gap={4} className="pb-12">
        {error && (
          <ITText className="rounded-md border border-red-200 bg-red-50 px-3 py-2 !text-[13px] text-red-700">
            {error}
          </ITText>
        )}

        {loading ? (
          <ContentSkeleton />
        ) : (
          <>
            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={3}>
                <ITText className="font-bold">{t("admin.policyTitle")}</ITText>
                <ITText muted className="!text-[11px]">
                  {t("admin.policyHint", {
                    policy: policy?.policyVersion ?? 1,
                    privacy: policy?.privacyNoticeVersion ?? 1,
                  })}
                </ITText>
                <ITTextarea
                  name="teleworkPolicy"
                  label={t("telework.policyTitle")}
                  value={policyForm.teleworkPolicy}
                  onChange={(value) => setPolicyForm((form) => ({ ...form, teleworkPolicy: value }))}
                  rows={5}
                />
                <ITTextarea
                  name="disconnectPolicy"
                  label={t("telework.disconnectTitle")}
                  value={policyForm.disconnectPolicy}
                  onChange={(value) => setPolicyForm((form) => ({ ...form, disconnectPolicy: value }))}
                  rows={4}
                />
                <ITTextarea
                  name="privacyNotice"
                  label={t("telework.privacyTitle")}
                  value={policyForm.privacyNotice}
                  onChange={(value) => setPolicyForm((form) => ({ ...form, privacyNotice: value }))}
                  rows={5}
                />
                <ITFlex>
                  <ITButton
                    variant="filled"
                    color="primary"
                    onClick={() =>
                      void run(() =>
                        nomApi.updateTeleworkPolicy({
                          teleworkPolicy: policyForm.teleworkPolicy,
                          disconnectPolicy: policyForm.disconnectPolicy,
                          privacyNotice: policyForm.privacyNotice,
                        })
                      )
                    }
                  >
                    {t("admin.savePolicy")}
                  </ITButton>
                </ITFlex>
              </ITFlex>
            </ITCard>

            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={3}>
                <ITText className="font-bold">{t("admin.registrationsTitle")}</ITText>
                <ITFlex gap={2} wrap="wrap" align="end">
                  <ITSelect
                    name="registrationUser"
                    label={t("admin.person")}
                    value={newRegistration.userId}
                    onChange={(event) =>
                      setNewRegistration((form) => ({ ...form, userId: event.target.value }))
                    }
                    options={peopleOptions}
                  />
                  <ITSelect
                    name="registrationMode"
                    label={t("admin.mode")}
                    value={newRegistration.mode}
                    onChange={(event) =>
                      setNewRegistration((form) => ({ ...form, mode: event.target.value as TeleworkMode }))
                    }
                    options={[
                      { value: "REMOTO", label: t("telework.mode.REMOTO") },
                      { value: "HIBRIDO", label: t("telework.mode.HIBRIDO") },
                      { value: "CAMPO", label: t("telework.mode.CAMPO") },
                    ]}
                  />
                  <ITInput
                    name="homeAddress"
                    label={t("admin.homeAddress")}
                    value={newRegistration.homeAddress}
                    onChange={(event) =>
                      setNewRegistration((form) => ({ ...form, homeAddress: event.target.value }))
                    }
                  />
                  <ITButton
                    variant="filled"
                    color="primary"
                    disabled={busy || !newRegistration.userId}
                    onClick={() =>
                      void run(async () => {
                        await nomApi.registerTelework({
                          userId: newRegistration.userId,
                          mode: newRegistration.mode,
                          homeAddress: newRegistration.homeAddress || undefined,
                        });
                        setNewRegistration({ userId: "", mode: "REMOTO", homeAddress: "" });
                      })
                    }
                  >
                    {t("admin.register")}
                  </ITButton>
                </ITFlex>

                {registrations.length === 0 ? (
                  <ITText muted>{t("admin.emptyRegistrations")}</ITText>
                ) : (
                  <ITFlex direction="column" gap={2}>
                    {registrations.map((registration) => (
                      <ITFlex
                        key={registration.id}
                        align="center"
                        justify="between"
                        gap={2}
                        className="rounded-md border border-slate-100 px-3 py-2"
                      >
                        <ITFlex align="center" gap={2} wrap="wrap" className="min-w-0">
                          <ITText className="font-semibold !text-[13px]">
                            {registration.userName ?? registration.userId}
                          </ITText>
                          <ITBadget color={registration.status === "ACTIVE" ? "success" : "gray"} size="sm">
                            {tr(`admin.status.${registration.status}`)}
                          </ITBadget>
                          <ITBadget color="info" size="sm">
                            {tr(`telework.mode.${registration.mode}`)}
                          </ITBadget>
                          {registration.consentAcceptedAt ? (
                            <ITText muted className="!text-[11px]">{t("admin.consentOk")}</ITText>
                          ) : (
                            <ITText muted className="!text-[11px]">{t("admin.consentPending")}</ITText>
                          )}
                        </ITFlex>
                        {registration.status === "ACTIVE" && (
                          <ITButton
                            variant="outlined"
                            color="secondary"
                            size="sm"
                            onClick={() =>
                              void run(() =>
                                nomApi.updateTeleworkRegistration(registration.id, { status: "ENDED" })
                              )
                            }
                          >
                            {t("admin.end")}
                          </ITButton>
                        )}
                      </ITFlex>
                    ))}
                  </ITFlex>
                )}
              </ITFlex>
            </ITCard>

            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={2}>
                <ITText className="font-bold">{t("admin.checklistsTitle")}</ITText>
                {checklists.length === 0 ? (
                  <ITText muted>{t("admin.emptyChecklists")}</ITText>
                ) : (
                  checklists.slice(0, 10).map((checklist) => (
                    <ITFlex key={checklist.id} align="center" gap={2} wrap="wrap">
                      <ITBadget color="info" size="sm">
                        {tr(`checklist.kind.${checklist.kind}`)}
                      </ITBadget>
                      <ITText className="!text-[13px]">{checklist.userName ?? checklist.userId}</ITText>
                      <ITText muted className="!text-[12px]">{dateOf(checklist.completedAt)}</ITText>
                    </ITFlex>
                  ))
                )}
              </ITFlex>
            </ITCard>

            <ITCard contentClassName="!p-5">
              <ITFlex direction="column" gap={3}>
                <ITText className="font-bold">{t("admin.contactsTitle")}</ITText>
                <ITText muted className="!text-[11px]">
                  {t("admin.contactsHint")}
                </ITText>
                <ITFlex gap={2} wrap="wrap" align="end">
                  <ITSelect
                    name="contactUser"
                    label={t("admin.person")}
                    value={newContact.userId}
                    onChange={(event) => setNewContact((form) => ({ ...form, userId: event.target.value }))}
                    options={peopleOptions}
                  />
                  <ITSelect
                    name="contactChannel"
                    label={t("admin.channel")}
                    value={newContact.channel}
                    onChange={(event) =>
                      setNewContact((form) => ({
                        ...form,
                        channel: event.target.value as typeof form.channel,
                      }))
                    }
                    options={[
                      { value: "CALL", label: t("admin.channels.CALL") },
                      { value: "MESSAGE", label: t("admin.channels.MESSAGE") },
                      { value: "EMAIL", label: t("admin.channels.EMAIL") },
                      { value: "OTHER", label: t("admin.channels.OTHER") },
                    ]}
                  />
                  <ITInput
                    name="contactReason"
                    label={t("admin.reason")}
                    value={newContact.reason}
                    onChange={(event) => setNewContact((form) => ({ ...form, reason: event.target.value }))}
                  />
                  <ITButton
                    variant="filled"
                    color="primary"
                    disabled={busy || !newContact.userId || newContact.reason.trim().length < 5}
                    onClick={() =>
                      void run(async () => {
                        await nomApi.registerOutOfHoursContact({
                          userId: newContact.userId,
                          channel: newContact.channel,
                          reason: newContact.reason.trim(),
                        });
                        setNewContact({ userId: "", channel: "CALL", reason: "" });
                      })
                    }
                  >
                    {t("admin.registerContact")}
                  </ITButton>
                </ITFlex>

                {contacts.slice(0, 10).map((contact) => (
                  <ITFlex key={contact.id} align="center" gap={2} wrap="wrap">
                    <ITText className="!text-[13px]">{contact.userName ?? contact.userId}</ITText>
                    <ITBadget color="warning" size="sm">
                      {tr(`admin.channels.${contact.channel}`)}
                    </ITBadget>
                    <ITText muted className="!text-[12px]">
                      {dateOf(contact.contactedAt)} · {contact.reason}
                    </ITText>
                  </ITFlex>
                ))}
              </ITFlex>
            </ITCard>
          </>
        )}
      </ITFlex>
    </ITPage>
  );
}
