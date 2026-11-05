import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ITAlert,
  ITButton,
  ITCard,
  ITCheckbox,
  ITFlex,
  ITInput,
  ITText,
  ITToast,
} from "@axzydev/axzy_ui_system";
import { FaEnvelope, FaPlus, FaTrashAlt, FaUndo } from "react-icons/fa";
import {
  isValidEmail,
  useGetSysConfig,
  useUpdateSysConfig,
} from "@features/sys-config";
import SystemLanguageCard from "./SystemLanguageCard";
import WeekStartCard from "./WeekStartCard";

const KEY = "EMAIL_NOTIFICATION_RECIPIENTS";
const SEND_EMAIL_KEY = "ENABLE_SEND_EMAIL";

const parseEnabled = (raw: string | null | undefined): boolean =>
  (raw ?? "true").trim().toLowerCase() !== "false";

const splitRecipients = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

interface ToastState {
  message: string;
  type: "success" | "error";
}

export default function SysConfigTab() {
  const { t, i18n } = useTranslation(["catalog", "common"]);
  const { data, loading, error, reload } = useGetSysConfig(KEY);
  const { mutate, loading: saving, error: saveError } = useUpdateSysConfig(KEY);

  const {
    data: sendEmailData,
    loading: sendEmailLoading,
    error: sendEmailLoadError,
    reload: reloadSendEmail,
  } = useGetSysConfig(SEND_EMAIL_KEY);
  const {
    mutate: mutateSendEmail,
    loading: sendEmailSaving,
    error: sendEmailSaveError,
  } = useUpdateSysConfig(SEND_EMAIL_KEY);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [draftEmail, setDraftEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sendEmailEnabled, setSendEmailEnabled] = useState(true);
  const [sendEmailDirty, setSendEmailDirty] = useState(false);

  // Hidratar la lista cuando llega el valor remoto (solo si no está editando).
  useEffect(() => {
    if (data && !dirty) setRecipients(splitRecipients(data.value));
  }, [data, dirty]);

  // Hidratar el interruptor de correo (solo si no está editando).
  useEffect(() => {
    if (sendEmailData && !sendEmailDirty) {
      setSendEmailEnabled(parseEnabled(sendEmailData.value));
    }
  }, [sendEmailData, sendEmailDirty]);

  const addRecipient = () => {
    const email = draftEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      setAddError(t("sysConfig.invalidEmail"));
      return;
    }
    if (recipients.some((r) => r.toLowerCase() === email.toLowerCase())) {
      setAddError(t("sysConfig.duplicateEmail"));
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setDraftEmail("");
    setAddError(null);
    setDirty(true);
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    try {
      await mutate(recipients.join(", "));
      setDirty(false);
      setToast({ message: t("sysConfig.saved"), type: "success" });
      await reload();
    } catch {
      setToast({ message: t("sysConfig.saveError"), type: "error" });
    }
  };

  const handleReset = () => {
    setRecipients(splitRecipients(data?.value ?? ""));
    setDraftEmail("");
    setAddError(null);
    setDirty(false);
  };

  const handleSaveSendEmail = async () => {
    if (!sendEmailDirty || sendEmailSaving) return;
    try {
      await mutateSendEmail(sendEmailEnabled ? "true" : "false");
      setSendEmailDirty(false);
      setToast({ message: t("sysConfig.sendEmailSaved"), type: "success" });
      await reloadSendEmail();
    } catch {
      setToast({ message: t("sysConfig.sendEmailSaveError"), type: "error" });
    }
  };

  const handleResetSendEmail = () => {
    setSendEmailEnabled(parseEnabled(sendEmailData?.value));
    setSendEmailDirty(false);
  };

  return (
    <ITFlex direction="column" gap={4} className="pt-2">
      <ITFlex align="center" gap={2}>
        <FaEnvelope className="text-primary-500" />
        <ITText className="text-sm font-bold text-slate-800">
          {t("sysConfig.title")}
        </ITText>
      </ITFlex>

      <ITText className="-mt-2 text-xs text-slate-500">{t("sysConfig.subtitle")}</ITText>

      {error && (
        <ITAlert variant="error" dismissible onDismiss={() => undefined}>
          {error}
        </ITAlert>
      )}
      {saveError && (
        <ITAlert variant="error" dismissible onDismiss={() => undefined}>
          {saveError}
        </ITAlert>
      )}

      <ITCard
        title={t("sysConfig.recipientsLabel")}
        className="!p-5 border border-slate-200"
        actions={
          <ITFlex justify="end" gap={2}>
            <ITButton
              variant="outlined"
              color="secondary"
              onClick={handleReset}
              disabled={!dirty || saving}
            >
              <ITFlex align="center" gap={1}>
                <FaUndo size={12} />
                <ITText className="font-bold text-[11px]">
                  {t("common:actions.cancel")}
                </ITText>
              </ITFlex>
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              <ITText className="font-bold text-[11px]">
                {saving ? t("sysConfig.saving") : t("sysConfig.save")}
              </ITText>
            </ITButton>
          </ITFlex>
        }
      >
        <ITFlex align="end" gap={2}>
          <ITFlex grow={1} className="min-w-0">
            <ITInput
              name="newRecipient"
              type="email"
              label={t("sysConfig.newRecipientLabel")}
              placeholder={t("sysConfig.newRecipientPlaceholder")}
              value={draftEmail}
              onChange={(e) => {
                setDraftEmail(e.target.value);
                if (addError) setAddError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && addRecipient()}
              error={addError ?? undefined}
            />
          </ITFlex>
          <ITButton
            variant="filled"
            color="primary"
            onClick={addRecipient}
            disabled={!draftEmail.trim()}
            className="mt-1"
          >
            <ITFlex align="center" gap={1}>
              <FaPlus size={11} />
              <ITText className="font-bold text-[11px]">
                {t("sysConfig.addRecipient")}
              </ITText>
            </ITFlex>
          </ITButton>
        </ITFlex>

        <ITText className="mt-2 block text-[11px] text-slate-500">
          {t("sysConfig.recipientsHelp")}
        </ITText>

        <ITFlex direction="column" gap={2} className="mt-4">
          {loading ? (
            <ITText className="text-xs text-slate-400">—</ITText>
          ) : recipients.length === 0 ? (
            <ITText className="text-xs italic text-slate-400">
              {t("sysConfig.empty")}
            </ITText>
          ) : (
            recipients.map((email) => (
              <ITFlex
                key={email}
                align="center"
                justify="between"
                gap={2}
                className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
              >
                <ITFlex align="center" gap={2} className="min-w-0">
                  <FaEnvelope size={11} className="shrink-0 text-slate-400" />
                  <ITText className="truncate text-[12px] font-medium text-slate-700">
                    {email}
                  </ITText>
                </ITFlex>
                <ITButton
                  variant="icon-only"
                  color="error"
                  size="sm"
                  onClick={() => removeRecipient(email)}
                  ariaLabel={t("sysConfig.removeRecipient")}
                  title={t("sysConfig.removeRecipient")}
                >
                  <FaTrashAlt size={11} />
                </ITButton>
              </ITFlex>
            ))
          )}
        </ITFlex>

        {data?.updatedBy && (
          <ITText className="mt-3 block text-[10px] text-slate-400">
            {data.updatedBy.name} ·{" "}
            {new Date(data.updatedAt).toLocaleString(i18n.language)}
          </ITText>
        )}
      </ITCard>

      <ITCard
        title={t("sysConfig.sendEmailLabel")}
        className="!p-5 border border-slate-200"
        actions={
          <ITFlex justify="end" gap={2}>
            <ITButton
              variant="outlined"
              color="secondary"
              onClick={handleResetSendEmail}
              disabled={!sendEmailDirty || sendEmailSaving}
            >
              <ITFlex align="center" gap={1}>
                <FaUndo size={12} />
                <ITText className="font-bold text-[11px]">
                  {t("common:actions.cancel")}
                </ITText>
              </ITFlex>
            </ITButton>
            <ITButton
              variant="filled"
              color="primary"
              onClick={handleSaveSendEmail}
              disabled={!sendEmailDirty || sendEmailSaving}
            >
              <ITText className="font-bold text-[11px]">
                {sendEmailSaving ? t("sysConfig.saving") : t("sysConfig.save")}
              </ITText>
            </ITButton>
          </ITFlex>
        }
      >
        {(sendEmailLoadError || sendEmailSaveError) && (
          <ITAlert variant="error" dismissible onDismiss={() => undefined}>
            {sendEmailLoadError ?? sendEmailSaveError}
          </ITAlert>
        )}

        <ITCheckbox
          name="enableSendEmail"
          checked={sendEmailEnabled}
          disabled={sendEmailLoading || sendEmailSaving}
          onChange={(v) => {
            setSendEmailEnabled(v);
            setSendEmailDirty(true);
          }}
          label={t("sysConfig.sendEmailLabel")}
        />

        <ITText className="mt-1 block text-[11px] font-medium text-slate-600">
          {sendEmailEnabled ? t("sysConfig.sendEmailOn") : t("sysConfig.sendEmailOff")}
        </ITText>

        <ITText className="mt-2 block text-[11px] text-slate-500">
          {t("sysConfig.sendEmailHelp")}
        </ITText>

        {sendEmailData?.updatedBy && (
          <ITText className="mt-3 block text-[10px] text-slate-400">
            {sendEmailData.updatedBy.name} ·{" "}
            {new Date(sendEmailData.updatedAt).toLocaleString(i18n.language)}
          </ITText>
        )}
      </ITCard>

      <SystemLanguageCard onResult={(message, type) => setToast({ message, type })} />

      <WeekStartCard onResult={(message, type) => setToast({ message, type })} />

      {toast && (
        <ITToast
          message={toast.message}
          type={toast.type}
          position="bottom-center"
          duration={2500}
          onClose={() => setToast(null)}
        />
      )}
    </ITFlex>
  );
}
