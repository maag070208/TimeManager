import { ITBadget, ITButton, ITCard, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { UseUserImport } from "../model/useUserImport";
import { i18n } from "@shared/i18n";

interface Props {
  fx: UseUserImport;
  onGoToList: () => void;
}

export default function ImportResultCard({ fx, onGoToList }: Props) {
  const { t: tt } = useTranslation("users");
  const result = fx.result;
  if (!result) return null;

  return (
    <ITCard className="p-6">
      <ITFlex align="center" gap={2} className="mb-4">
        <FaCheckCircle size={14} className="text-emerald-600" />
        <ITText className="text-[12px] font-semibold text-slate-500">
          {i18n.t("users:import.resultTitle")}
        </ITText>
      </ITFlex>

      <ITFlex gap={4} wrap="wrap" className="mb-4">
        <ITBadget color="success" size="lg">
          {tt("import.imported", { count: result.created })}
        </ITBadget>
        {result.skipped.length > 0 && (
          <ITBadget color="warning" size="lg">
            {i18n.t("users:import.skippedCount", { count: result.skipped.length })}
          </ITBadget>
        )}
      </ITFlex>

      {result.skipped.length > 0 && (
        <div className="mt-2">
          <ITFlex align="center" gap={2} className="mb-2">
            <FaExclamationTriangle size={12} className="text-amber-500" />
            <ITText className="text-[12px] font-semibold text-slate-500">
              {i18n.t("users:import.skippedRows")}
            </ITText>
          </ITFlex>
          {result.skipped.map((o, i) => (
            <ITText key={i} className="text-[11px] text-slate-500">
              {i18n.t("users:import.skippedRow", { row: o.row, username: o.username, reason: o.reason })}
            </ITText>
          ))}
        </div>
      )}

      <ITFlex justify="end" className="mt-5">
        <ITButton variant="filled" color="primary" onClick={onGoToList}>
          {tt("import.goToList")}
        </ITButton>
      </ITFlex>
    </ITCard>
  );
}