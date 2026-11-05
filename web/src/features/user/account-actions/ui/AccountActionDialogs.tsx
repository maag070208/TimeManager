import { ITButton, ITDialog, ITFlex, ITInput, ITText, ITToast } from "@axzydev/axzy_ui_system";
import { LuKeyRound } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import DeactivateDialog from "./DeactivateDialog";
import { DialogHeader } from "@shared/ui/dialog-header";
import { TicConfirm } from "@shared/ui/tic-confirm";
import type { AccountActions } from "../model/useAccountActions";

/** Diálogos y aviso de las acciones de cuenta (se montan una vez por pantalla). */
export default function AccountActionDialogs({ fx }: { fx: AccountActions }) {
  const { t } = useTranslation(["users", "common"]);
  return (
    <>
      <DeactivateDialog
        isOpen={!!fx.toDeactivate}
        onClose={() => fx.setToDeactivate(null)}
        onConfirm={(reason) => void fx.deactivate(reason)}
        userName={fx.toDeactivate?.name}
      />
      <TicConfirm
        isOpen={!!fx.toDelete}
        onClose={() => fx.setToDelete(null)}
        onConfirm={() => void fx.remove(false)}
        title={t("list.deleteQuestion", { username: fx.toDelete?.username ?? "" })}
        message={t("list.deleteConsequence")}
        confirmLabel={t("list.confirmDeleteBtn")}
        cancelLabel={t("common:actions.cancel")}
        variant="danger"
      />
      <TicConfirm
        isOpen={!!fx.toForceDelete}
        onClose={() => fx.setToForceDelete(null)}
        onConfirm={() => void fx.remove(true)}
        title={t("list.forceDeleteQuestion", { username: fx.toForceDelete?.username ?? "" })}
        message={t("list.forceDeleteMessage", { username: fx.toForceDelete?.username ?? "" })}
        confirmLabel={t("list.forceDeleteBtn")}
        cancelLabel={t("common:actions.cancel")}
        variant="danger"
      />
      <TicConfirm
        isOpen={!!fx.toReactivate}
        onClose={() => fx.setToReactivate(null)}
        onConfirm={() => void fx.reactivate()}
        title={t("list.reactivateQuestion", { username: fx.toReactivate?.username ?? "" })}
        message={t("list.reactivateMsgShort")}
        confirmLabel={t("list.reactivateBtn")}
        cancelLabel={t("common:actions.cancel")}
        variant="success"
      />
      <ITDialog isOpen={!!fx.toPassword} onClose={fx.closePassword} className="max-w-md">
        <DialogHeader
          icon={<LuKeyRound size={20} />}
          tone="success"
          title={t("list.passwordHeading")}
          subtitle={fx.toPassword ? `@${fx.toPassword.username}` : undefined}
        />
        <ITFlex direction="column" gap={3}>
          <div
            onKeyDown={(event) => {
              if (event.key === "Enter" && fx.newPassword.trim()) {
                event.preventDefault();
                void fx.changePassword();
              }
            }}
          >
            <ITInput
              name="newPassword"
              type="password"
              label={t("list.passwordLabel")}
              value={fx.newPassword}
              onChange={(e) => fx.setNewPassword(e.target.value)}
              placeholder={t("list.passwordPlaceholder")}
              autoFocus
            />
          </div>
          <ITFlex justify="end" gap={2} className="pt-2">
            <ITButton variant="outlined" color="gray" className="!rounded-full" onClick={fx.closePassword}>
              {t("common:actions.cancel")}
            </ITButton>
            <ITButton variant="rounded" color="primary" onClick={() => void fx.changePassword()} disabled={!fx.newPassword.trim()}>
              <ITText className="font-bold text-[12px]">{t("list.passwordBtn")}</ITText>
            </ITButton>
          </ITFlex>
        </ITFlex>
      </ITDialog>
      {fx.toast && (
        <ITToast message={fx.toast.message} type={fx.toast.type} position="bottom-center" duration={2500} onClose={() => fx.setToast(null)} />
      )}
    </>
  );
}
