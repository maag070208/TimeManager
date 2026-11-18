import { useEffect, useState } from "react";
import { ITAlert, ITButton, ITDialog } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { WEB_VERSION, fetchApiVersion, type PartVersion } from "../model/versions";
import { versionsMismatch } from "../model/compare";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Versiones de la web y del API que está usando la persona, para soporte. */
export default function AboutDialog({ isOpen, onClose }: Props) {
  const { t } = useTranslation("common");
  const [api, setApi] = useState<PartVersion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchApiVersion()
      .then(setApi)
      .catch(() => setApi({ version: null, commit: null }))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const row = (label: string, part: PartVersion | null, hint?: string) => (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#f4f6fa" }}>
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      <span className="text-right">
        <span className="block text-[14px] font-extrabold text-slate-900">
          {part?.version ? `v${part.version}` : hint ?? t("about.unknown")}
        </span>
        {part?.commit && <span className="block text-[11px] text-slate-500">{t("about.commit", { commit: part.commit })}</span>}
      </span>
    </div>
  );

  return (
    <ITDialog isOpen={isOpen} onClose={onClose} title={t("about.title")}>
      <div className="flex flex-col gap-2.5">
        <p className="text-[13px] text-slate-500">{t("about.lead")}</p>
        {row(t("about.web"), WEB_VERSION)}
        {loading ? <ContentSkeleton /> : row(t("about.api"), api)}
        {row(t("about.app"), null, t("about.appHint"))}
        {!loading && versionsMismatch(WEB_VERSION.version, api?.version ?? null) && (
          <ITAlert variant="warning">{t("about.mismatch")}</ITAlert>
        )}
        <div className="mt-1 flex justify-end">
          <ITButton variant="outlined" color="secondary" onClick={onClose}>{t("about.close")}</ITButton>
        </div>
      </div>
    </ITDialog>
  );
}
