import { useEffect, useRef, type ReactNode } from "react";
import { ITButton, ITDialog, ITText, ITFlex } from "@axzydev/axzy_ui_system";
import { useTranslation } from "react-i18next";
import { Langostin, type LangostinAnim } from "@shared/ui/langostin";
import { usePrefersReducedMotion } from "@shared/lib/usePrefersReducedMotion";

export type LangostinConfirmVariant = "danger" | "primary" | "success" | "warning";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Conviene redactarlo como pregunta: "¿Eliminar este equipo?". */
  title?: string;
  /** Una o dos líneas que digan qué pasa (qué se pierde, qué se envía). */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: LangostinConfirmVariant;
  /** Animación de Langostín; por defecto depende de `variant`. */
  anim?: LangostinAnim;
  loading?: boolean;
  /** Contenido extra entre el mensaje y los botones (p. ej. un campo de motivo). */
  children?: ReactNode;
  /** Deshabilita Confirmar (p. ej. mientras falte un dato en `children`). */
  confirmDisabled?: boolean;
}

const ANIM_BY_VARIANT: Record<LangostinConfirmVariant, LangostinAnim> = {
  danger: "think",
  warning: "help",
  success: "ok",
  primary: "info",
};

/**
 * Confirmación M1: Langostín chico a la izquierda, título en pregunta, mensaje y
 * botones píldora. En acciones destructivas el foco inicial queda en Cancelar.
 * Esc y clic fuera cierran (los resuelve `ITDialog`).
 */
export default function LangostinConfirm({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  anim,
  loading = false,
  children,
  confirmDisabled = false,
}: Props) {
  const { t } = useTranslation("langostin");
  const reduced = usePrefersReducedMotion();
  const actionsRef = useRef<HTMLDivElement>(null);

  // El diálogo se monta en un portal: se enfoca el botón en el siguiente cuadro.
  useEffect(() => {
    if (!isOpen) return;
    const id = window.requestAnimationFrame(() => {
      const buttons = actionsRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      // Cancelar es el primero; Confirmar, el último.
      (variant === "danger" ? buttons[0] : buttons[buttons.length - 1]).focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, variant]);

  return (
    <ITDialog isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="flex items-start gap-4" role="alertdialog" aria-label={title ?? t("confirm.title")}>
        <ITFlex className="shrink-0">
          <Langostin anim={anim ?? ANIM_BY_VARIANT[variant]} size={64} animated={!reduced} label={t("guide.label")} />
        </ITFlex>
        <ITFlex className="min-w-0 flex-1">
          <ITText as="h3" className="m-0 text-lg font-bold text-slate-800 dark:text-white">{title ?? t("confirm.title")}</ITText>
          {message ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</div> : null}
        </ITFlex>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      <div ref={actionsRef} className="mt-6 flex justify-end gap-3">
        <ITButton
          label={cancelLabel ?? t("confirm.cancel")}
          variant="outlined"
          color="gray"
          size="sm"
          className="!rounded-full"
          onClick={onClose}
          disabled={loading}
        />
        <ITButton
          label={confirmLabel ?? t("confirm.confirm")}
          variant="rounded"
          color={variant}
          size="sm"
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
        />
      </div>
    </ITDialog>
  );
}
