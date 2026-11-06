import {
  ITAlert,
  ITBadget,
  ITButton,
  ITDialog,
  ITFlex,
  ITInput,
  ITText,
} from "@axzydev/axzy_ui_system";
import { useState } from "react";
import { LuCopy, LuKeyRound, LuPlus, LuRefreshCw, LuShieldOff } from "react-icons/lu";
import type { Tenant } from "@entities/tenant";
import { DialogHeader } from "@shared/ui/dialog-header";
import { useAgentTokens } from "../model/useAgentTokens";

interface Props {
  isOpen: boolean;
  tenant: Tenant | null;
  onClose: () => void;
}

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

/**
 * Agente local del cliente (F3-12): emitir el token de dispositivo una sola
 * vez, rotarlo, revocarlo o reactivarlo. El agente lo usa en
 * `CheckLab Agent` para registrarse contra el API.
 */
export default function AgentTokenDialog({ isOpen, tenant, onClose }: Props) {
  const fx = useAgentTokens(isOpen ? tenant : null);
  const [copied, setCopied] = useState(false);

  const copyToken = async () => {
    if (!fx.token) return;
    try {
      await navigator.clipboard.writeText(fx.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ITDialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader
        icon={<LuKeyRound />}
        title={fx.t("platform.agents.title", { name: tenant?.name ?? "" })}
        subtitle={fx.t("platform.agents.subtitle")}
      />

      {fx.error && (
        <div className="mb-3">
          <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
            {fx.error}
          </ITAlert>
        </div>
      )}
      {fx.toast && (
        <div className="mb-3">
          <ITAlert variant="success" dismissible onDismiss={() => fx.setToast(null)}>
            {fx.toast}
          </ITAlert>
        </div>
      )}

      {fx.token && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <ITText className="block text-xs font-bold text-amber-900">
            {fx.t("platform.agents.tokenOnce")}
          </ITText>
          <ITFlex align="center" gap={2} wrap="wrap" className="mt-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2 py-1.5 font-mono text-[11px] text-slate-800">
              {fx.token}
            </code>
            <ITButton variant="outlined" color="secondary" size="sm" onClick={() => void copyToken()}>
              <span className="flex items-center gap-1.5">
                <LuCopy size={12} />
                {fx.t(copied ? "platform.agents.copied" : "platform.agents.copy")}
              </span>
            </ITButton>
          </ITFlex>
          <ITText className="mt-2 block text-[11px] text-amber-800">
            {fx.t("platform.agents.tokenHint")}
          </ITText>
        </div>
      )}

      <ITFlex align="end" gap={2} wrap="wrap" className="mb-4">
        <div className="min-w-[220px] flex-1">
          <ITInput
            name="agentName"
            label={fx.t("platform.agents.nameLabel")}
            placeholder={fx.t("platform.agents.namePlaceholder")}
            value={fx.name}
            onChange={(event) => fx.setName(event.target.value)}
          />
        </div>
        <ITButton
          variant="filled"
          color="primary"
          size="sm"
          disabled={!fx.name.trim() || fx.busy !== null}
          onClick={() => void fx.create()}
        >
          <span className="flex items-center gap-1.5">
            <LuPlus size={12} />
            {fx.t(fx.busy === "create" ? "platform.agents.creating" : "platform.agents.create")}
          </span>
        </ITButton>
      </ITFlex>

      {fx.agents === null ? (
        <ITText className="block py-4 text-center text-sm text-slate-500">
          {fx.t("platform.agents.loading")}
        </ITText>
      ) : fx.agents.length === 0 ? (
        <ITText className="block py-4 text-center text-sm text-slate-500">
          {fx.t("platform.agents.empty")}
        </ITText>
      ) : (
        <div className="flex flex-col gap-2">
          {fx.agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <ITFlex align="center" gap={2}>
                  <ITText className="truncate font-semibold">{agent.name}</ITText>
                  <ITBadget color={agent.active ? "success" : "danger"} size="sm">
                    {fx.t(agent.active ? "platform.agents.active" : "platform.agents.revoked")}
                  </ITBadget>
                </ITFlex>
                <ITText className="block truncate text-xs text-slate-500">
                  {fx.t("platform.agents.version")}: {agent.version ?? "—"} ·{" "}
                  {fx.t("platform.agents.lastSeen")}: {formatDate(agent.lastSeenAt)}
                </ITText>
              </div>
              <ITFlex gap={1.5}>
                <ITButton
                  variant="outlined"
                  color="secondary"
                  size="sm"
                  disabled={fx.busy !== null}
                  onClick={() => void fx.rotate(agent)}
                >
                  <span className="flex items-center gap-1.5">
                    <LuRefreshCw size={11} />
                    {fx.t("platform.agents.rotate")}
                  </span>
                </ITButton>
                <ITButton
                  variant="outlined"
                  color={agent.active ? "danger" : "success"}
                  size="sm"
                  disabled={fx.busy !== null}
                  onClick={() => void fx.toggle(agent)}
                >
                  <span className="flex items-center gap-1.5">
                    <LuShieldOff size={11} />
                    {fx.t(agent.active ? "platform.agents.revoke" : "platform.agents.reactivate")}
                  </span>
                </ITButton>
              </ITFlex>
            </div>
          ))}
        </div>
      )}
    </ITDialog>
  );
}
