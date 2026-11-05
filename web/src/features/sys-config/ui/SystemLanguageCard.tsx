import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { ITAlert, ITButton, ITCard, ITFlex, ITSelect, ITText } from "@axzydev/axzy_ui_system";
import { FaUndo } from "react-icons/fa";
import { APP_LANGUAGES, type AppLanguage } from "@shared/i18n/config";
import type { AppDispatch } from "@app/store";
import { meThunk } from "@entities/user";
import { useGetSysConfig, useUpdateSysConfig } from "@features/sys-config";

const LANGUAGE_KEY = "LANGUAGE";

const toLanguage = (raw: string | null | undefined): AppLanguage =>
  APP_LANGUAGES.find((lng) => lng === raw?.trim()) ?? "es";

interface Props {
  onResult: (message: string, type: "success" | "error") => void;
}

/**
 * Idioma del sistema (`sys_config.LANGUAGE`): lo usan la interfaz y los textos
 * que genera la API. Al guardarlo, la interfaz cambia de inmediato.
 */
export default function SystemLanguageCard({ onResult }: Props) {
  const { t, i18n } = useTranslation(["catalog", "common"]);
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error, reload } = useGetSysConfig(LANGUAGE_KEY);
  const { mutate, loading: saving, error: saveError } = useUpdateSysConfig(LANGUAGE_KEY);

  const [language, setLanguage] = useState<AppLanguage>("es");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setLanguage(toLanguage(data?.value));
  }, [data, dirty]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    try {
      await mutate(language);
      setDirty(false);
      await i18n.changeLanguage(language);
      // La sesión trae el idioma del sistema y la interfaz lo sigue: se refresca
      // para que una respuesta de `/auth/me` anterior al guardado no lo revierta.
      await dispatch(meThunk());
      // `t` quedó ligado al idioma anterior: el aviso ya sale en el nuevo.
      onResult(i18n.t("catalog:sysConfig.languageSaved"), "success");
      await reload();
    } catch {
      onResult(t("sysConfig.languageSaveError"), "error");
    }
  };

  const handleReset = () => {
    setLanguage(toLanguage(data?.value));
    setDirty(false);
  };

  return (
    <ITCard
      title={t("sysConfig.languageLabel")}
      className="!p-5 border border-slate-200"
      actions={
        <ITFlex justify="end" gap={2}>
          <ITButton variant="outlined" color="secondary" onClick={handleReset} disabled={!dirty || saving}>
            <ITFlex align="center" gap={1}>
              <FaUndo size={12} />
              <ITText className="font-bold text-[11px]">{t("common:actions.cancel")}</ITText>
            </ITFlex>
          </ITButton>
          <ITButton variant="filled" color="primary" onClick={handleSave} disabled={!dirty || saving}>
            <ITText className="font-bold text-[11px]">
              {saving ? t("sysConfig.saving") : t("sysConfig.save")}
            </ITText>
          </ITButton>
        </ITFlex>
      }
    >
      {(error || saveError) && (
        <ITAlert variant="error" dismissible onDismiss={() => undefined}>
          {error ?? saveError}
        </ITAlert>
      )}

      <ITSelect
        name="systemLanguage"
        label={t("sysConfig.languageLabel")}
        options={APP_LANGUAGES.map((lng) => ({ value: lng, label: t(`sysConfig.languages.${lng}`) }))}
        value={language}
        disabled={loading || saving}
        onChange={(e) => {
          setLanguage(toLanguage(e.target.value));
          setDirty(true);
        }}
      />

      <ITText className="mt-2 block text-[11px] text-slate-500">{t("sysConfig.languageHelp")}</ITText>

      {data?.updatedBy && (
        <ITText className="mt-3 block text-[10px] text-slate-400">
          {data.updatedBy.name} · {new Date(data.updatedAt).toLocaleString(i18n.language)}
        </ITText>
      )}
    </ITCard>
  );
}
