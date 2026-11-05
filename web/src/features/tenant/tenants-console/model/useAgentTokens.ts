import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { agentApi, type AgentAdmin } from "@entities/agent";
import type { Tenant } from "@entities/tenant";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Agentes del cliente en la consola de plataforma (F3-12): listar, crear
 * (token visible una sola vez), rotar token y revocar/reactivar.
 */
export const useAgentTokens = (tenant: Tenant | null) => {
  const { t } = useTranslation("home");
  const [agents, setAgents] = useState<AgentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const tenantId = tenant?.id;

  const load = useCallback(async () => {
    if (!tenantId) {
      setAgents(null);
      return;
    }
    setAgents(null);
    setError(null);
    try {
      const response = await agentApi.list(tenantId);
      setAgents(response.agents);
    } catch (e) {
      setError(messageOf(e));
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!tenantId || !name.trim() || busy) return;
    setBusy("create");
    setError(null);
    setToken(null);
    try {
      const result = await agentApi.create(name.trim(), tenantId);
      setAgents((rows) => [result.agent, ...(rows ?? [])]);
      setToken(result.token);
      setName("");
      setToast(t("platform.agents.created"));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (agent: AgentAdmin) => {
    if (!tenantId || busy) return;
    setBusy(agent.id);
    setError(null);
    setToken(null);
    try {
      const result = await agentApi.rotate(agent.id, tenantId);
      setAgents((rows) => (rows ?? []).map((row) => (row.id === agent.id ? result.agent : row)));
      setToken(result.token);
      setToast(t("platform.agents.rotated"));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (agent: AgentAdmin) => {
    if (!tenantId || busy) return;
    setBusy(agent.id);
    setError(null);
    try {
      const updated = await agentApi.setActive(agent.id, !agent.active, tenantId);
      setAgents((rows) => (rows ?? []).map((row) => (row.id === agent.id ? updated : row)));
      setToast(t(updated.active ? "platform.agents.reactivatedToast" : "platform.agents.revokedToast"));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  return {
    t,
    tenant,
    agents,
    error,
    setError,
    toast,
    setToast,
    name,
    setName,
    token,
    setToken,
    busy,
    create,
    rotate,
    toggle,
    reload: load,
  };
};
