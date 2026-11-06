import { ITSearchSelect } from "@shared/ui/it-search-select";
import { useCallback, useEffect, useState } from "react";
import {
  ITBadget,
  ITButton,
  ITCard,
  ITInput,
  ITText,
  ITTextarea,
  ITDialog,
} from "@axzydev/axzy_ui_system";
import { ITPage } from "@shared/ui/page";
import { useTranslation } from "react-i18next";
import { LuBriefcaseBusiness, LuClipboardCheck, LuMessageSquare, LuPencil, LuPlus, LuRefreshCw, LuUsersRound } from "react-icons/lu";
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
import { HelpTip } from "@shared/ui/help-tip";
import { BentoKpiGrid } from "@shared/ui/bento-filter-cards";
import { TicState } from "@shared/ui/tic";

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
  const [policyOpen, setPolicyOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
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
      className="min-w-full! max-w-none!"
      actions={
        <ITButton variant="outlined" color="secondary" size="lg" onClick={() => void load()}>
          <LuRefreshCw size={14} className="mr-1" />
          {t("refresh")}
        </ITButton>
      }
    >
      <div className="grid items-start gap-4 pb-12 lg:grid-cols-12">
        {error && (
          <ITText className="rounded-md border border-red-200 bg-red-50 px-3 py-2 !text-[13px] text-red-700">
            {error}
          </ITText>
        )}

        {loading ? (
          <ContentSkeleton />
        ) : (
          <>
            <div className="lg:col-span-12">
              <BentoKpiGrid
                items={[
                  { id: "people", label: "Teletrabajadores", value: registrations.filter((row) => row.status === "ACTIVE").length, caption: "activos", icon: <LuUsersRound size={14} />, tone: "success" },
                  { id: "checklists", label: "Checklists", value: checklists.length, caption: "recibidos", icon: <LuClipboardCheck size={14} />, tone: "info" },
                  { id: "contacts", label: "Comunicaciones", value: contacts.length, caption: "fuera de jornada", icon: <LuMessageSquare size={14} />, tone: "warning" },
                  { id: "version", label: "Política", value: `v${policy?.policyVersion ?? 1}`, caption: `aviso v${policy?.privacyNoticeVersion ?? 1}`, icon: <LuBriefcaseBusiness size={14} /> },
                ]}
              />
            </div>

            <ITCard className="lg:col-span-8" contentClassName="!p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ITText className="font-bold">{t("admin.policyTitle")}</ITText>
                  <HelpTip text="Textos que el trabajador acepta con versión. Al guardar sube la versión y debe aceptarlos de nuevo." />
                </div>
                <ITButton variant="outlined" color="primary" size="sm" className="tm-row-button" onClick={() => setPolicyOpen(true)}>
                  <LuPencil size={13} className="mr-1" /> Editar política
                </ITButton>
              </div>
              <ITText muted className="mt-1 block !text-[11.5px]">
                {t("admin.policyHint", { policy: policy?.policyVersion ?? 1, privacy: policy?.privacyNoticeVersion ?? 1 })}
              </ITText>
              <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {[
                  { label: t("telework.policyTitle"), text: policyForm.teleworkPolicy },
                  { label: t("telework.disconnectTitle"), text: policyForm.disconnectPolicy },
                  { label: t("telework.privacyTitle"), text: policyForm.privacyNotice },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <ITText className="block !text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</ITText>
                    <ITText className="mt-1 line-clamp-5 block !text-[12.5px] text-slate-700">{item.text || "Sin definir. Usa Editar política para capturarlo."}</ITText>
                  </div>
                ))}
              </div>
            </ITCard>

            <ITCard className="lg:col-span-4" contentClassName="!p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ITText className="font-bold">{t("admin.registrationsTitle")}</ITText>
                  <HelpTip text="Alta del teletrabajador con modo y domicilio. La baja conserva historial." />
                </div>
                <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" onClick={() => setRegisterOpen(true)}>
                  <LuPlus size={13} className="mr-1" /> Nuevo
                </ITButton>
              </div>
              {registrations.length === 0 ? (
                <div className="mt-3">
                  <TicState kind="empty" size="sm" title="Sin teletrabajadores" description="Registra al primero con su modalidad y domicilio." />
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {registrations.map((registration) => (
                    <div key={registration.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <ITText className="block truncate font-semibold !text-[13px]">{registration.userName ?? registration.userId}</ITText>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <ITBadget color={registration.status === "ACTIVE" ? "success" : "gray"} size="sm">{tr(`admin.status.${registration.status}`)}</ITBadget>
                          <ITBadget color="info" size="sm">{tr(`telework.mode.${registration.mode}`)}</ITBadget>
                          <ITBadget color={registration.consentAcceptedAt ? "success" : "warning"} size="sm">{registration.consentAcceptedAt ? t("admin.consentOk") : t("admin.consentPending")}</ITBadget>
                        </div>
                      </div>
                      {registration.status === "ACTIVE" && (
                        <ITButton variant="text" color="secondary" className="tm-row-button" onClick={() => void run(() => nomApi.updateTeleworkRegistration(registration.id, { status: "ENDED" }))}>{t("admin.end")}</ITButton>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ITCard>

            <ITCard className="lg:col-span-7" contentClassName="!p-5">
              <div className="flex items-center gap-2">
                <ITText className="font-bold">{t("admin.checklistsTitle")}</ITText>
                <HelpTip text="Checklist del lugar de trabajo; el inicial se levanta al registrar y el periódico se repite." />
              </div>
              {checklists.length === 0 ? (
                <div className="mt-2"><TicState kind="empty" size="sm" title="Sin checklists" description="Se reciben cuando el trabajador contesta el checklist inicial o periódico." /></div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {checklists.slice(0, 10).map((checklist) => (
                    <div key={checklist.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-[12.5px]">
                      <ITBadget color="info" size="sm">{tr(`checklist.kind.${checklist.kind}`)}</ITBadget>
                      <ITText className="!text-[12.5px]">{checklist.userName ?? checklist.userId}</ITText>
                      <ITText muted className="ml-auto !text-[11.5px]">{dateOf(checklist.completedAt)}</ITText>
                    </div>
                  ))}
                </div>
              )}
            </ITCard>

            <ITCard className="lg:col-span-5" contentClassName="!p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ITText className="font-bold">{t("admin.contactsTitle")}</ITText>
                  <HelpTip text="Derecho a la desconexión: registra cada contacto con motivo y canal; queda auditado." />
                </div>
                <ITButton variant="outlined" color="primary" size="sm" className="tm-row-button" onClick={() => setContactOpen(true)}>
                  <LuPlus size={13} className="mr-1" /> Registrar
                </ITButton>
              </div>
              <ITText muted className="mt-1 block !text-[11.5px]">{t("admin.contactsHint")}</ITText>
              {contacts.length === 0 ? (
                <div className="mt-2"><TicState kind="empty" size="sm" title="Sin comunicaciones" description="No hay contactos fuera de jornada registrados." /></div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {contacts.slice(0, 10).map((contact) => (
                    <div key={contact.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
                      <ITText className="!text-[12.5px] font-semibold">{contact.userName ?? contact.userId}</ITText>
                      <ITBadget color="warning" size="sm">{tr(`admin.channels.${contact.channel}`)}</ITBadget>
                      <ITText muted className="w-full !text-[11.5px]">{dateOf(contact.contactedAt)} · {contact.reason}</ITText>
                    </div>
                  ))}
                </div>
              )}
            </ITCard>

            <ITDialog isOpen={policyOpen} onClose={() => setPolicyOpen(false)} title={t("admin.policyTitle")} className="max-w-4xl">
              <div className="flex flex-col gap-3">
                <ITTextarea name="teleworkPolicy" label={t("telework.policyTitle")} value={policyForm.teleworkPolicy} onChange={(value) => setPolicyForm((form) => ({ ...form, teleworkPolicy: value }))} rows={6} />
                <ITTextarea name="disconnectPolicy" label={t("telework.disconnectTitle")} value={policyForm.disconnectPolicy} onChange={(value) => setPolicyForm((form) => ({ ...form, disconnectPolicy: value }))} rows={5} />
                <ITTextarea name="privacyNotice" label={t("telework.privacyTitle")} value={policyForm.privacyNotice} onChange={(value) => setPolicyForm((form) => ({ ...form, privacyNotice: value }))} rows={6} />
                <div className="flex justify-end gap-2">
                  <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setPolicyOpen(false)}>Cancelar</ITButton>
                  <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" disabled={busy} onClick={() => void run(async () => { await nomApi.updateTeleworkPolicy(policyForm); setPolicyOpen(false); })}>{t("admin.savePolicy")}</ITButton>
                </div>
              </div>
            </ITDialog>

            <ITDialog isOpen={registerOpen} onClose={() => setRegisterOpen(false)} title={t("admin.registrationsTitle")}>
              <div className="flex flex-col gap-3">
                <ITSearchSelect name="registrationUser" label={t("admin.person")} value={newRegistration.userId} onChange={(event) => setNewRegistration((form) => ({ ...form, userId: event.target.value }))} options={peopleOptions} />
                <ITSearchSelect name="registrationMode" label={t("admin.mode")} value={newRegistration.mode} onChange={(event) => setNewRegistration((form) => ({ ...form, mode: event.target.value as TeleworkMode }))} options={[{ value: "REMOTO", label: t("telework.mode.REMOTO") }, { value: "HIBRIDO", label: t("telework.mode.HIBRIDO") }, { value: "CAMPO", label: t("telework.mode.CAMPO") }]} />
                <ITInput name="homeAddress" label={t("admin.homeAddress")} value={newRegistration.homeAddress} onChange={(event) => setNewRegistration((form) => ({ ...form, homeAddress: event.target.value }))} />
                <div className="flex justify-end gap-2">
                  <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setRegisterOpen(false)}>Cancelar</ITButton>
                  <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" disabled={busy || !newRegistration.userId} onClick={() => void run(async () => { await nomApi.registerTelework({ userId: newRegistration.userId, mode: newRegistration.mode, homeAddress: newRegistration.homeAddress || undefined }); setNewRegistration({ userId: "", mode: "REMOTO", homeAddress: "" }); setRegisterOpen(false); })}>{t("admin.register")}</ITButton>
                </div>
              </div>
            </ITDialog>

            <ITDialog isOpen={contactOpen} onClose={() => setContactOpen(false)} title={t("admin.contactsTitle")}>
              <div className="flex flex-col gap-3">
                <ITSearchSelect name="contactUser" label={t("admin.person")} value={newContact.userId} onChange={(event) => setNewContact((form) => ({ ...form, userId: event.target.value }))} options={peopleOptions} />
                <ITSearchSelect name="contactChannel" label={t("admin.channel")} value={newContact.channel} onChange={(event) => setNewContact((form) => ({ ...form, channel: event.target.value as typeof form.channel }))} options={[{ value: "CALL", label: t("admin.channels.CALL") }, { value: "MESSAGE", label: t("admin.channels.MESSAGE") }, { value: "EMAIL", label: t("admin.channels.EMAIL") }, { value: "OTHER", label: t("admin.channels.OTHER") }]} />
                <ITInput name="contactReason" label={t("admin.reason")} value={newContact.reason} onChange={(event) => setNewContact((form) => ({ ...form, reason: event.target.value }))} />
                <div className="flex justify-end gap-2">
                  <ITButton variant="outlined" color="secondary" size="sm" className="tm-row-button" onClick={() => setContactOpen(false)}>Cancelar</ITButton>
                  <ITButton variant="filled" color="primary" size="sm" className="tm-row-button" disabled={busy || !newContact.userId || newContact.reason.trim().length < 5} onClick={() => void run(async () => { await nomApi.registerOutOfHoursContact({ userId: newContact.userId, channel: newContact.channel, reason: newContact.reason.trim() }); setNewContact({ userId: "", channel: "CALL", reason: "" }); setContactOpen(false); })}>{t("admin.registerContact")}</ITButton>
                </div>
              </div>
            </ITDialog>
          </>
        )}
      </div>
    </ITPage>
  );
}
