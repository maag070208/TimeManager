import { useEffect, useState } from "react";
import { ITTextarea } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { LangostinConfirm } from "@shared/ui/langostin-confirm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  userName?: string;
}

/**
 * Confirmación M1 de baja con motivo: `LangostinConfirm` (variante `danger`, foco
 * en Cancelar) con el campo del motivo como contenido y Confirmar bloqueado hasta
 * tener 3 caracteres. Envía `onConfirm(reason)` con el motivo en texto plano.
 */
export default function DeactivateDialog({ isOpen, onClose, onConfirm, userName }: Props) {
  const { t: tt } = useTranslation(["employees", "users", "common", "langostin"]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const trimmed = reason.trim();
  const isValid = trimmed.length >= 3;
  const errorMsg = !isValid && reason.length > 0 ? tt("employees:deactivate.reasonMin", { min: 3 }) : null;

  const handleConfirm = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LangostinConfirm
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      onConfirm={handleConfirm}
      title={tt("employees:deactivate.title", { name: userName ?? "" })}
      message={tt("employees:deactivate.consequence")}
      confirmLabel={submitting ? tt("common:labels.processing") : tt("employees:detail.deactivate")}
      cancelLabel={tt("common:actions.cancel")}
      variant="danger"
      anim="help"
      loading={submitting}
      confirmDisabled={!isValid}
    >
      <ITTextarea
        name="deactivate_reason"
        label={tt("employees:deactivate.reasonLabel")}
        value={reason}
        onChange={setReason}
        placeholder={tt("employees:deactivate.reasonPlaceholder")}
        rows={3}
        error={errorMsg ?? undefined}
        disabled={submitting}
      />
    </LangostinConfirm>
  );
}
