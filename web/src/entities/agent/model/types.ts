/** Agente local (TimeManagerAgent) de un cliente, tal como lo ve la consola. */
export interface AgentAdmin {
  id: string;
  name: string;
  version: string | null;
  active: boolean;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

/** Alta/rotación de token: el token en claro solo viaja en esta respuesta. */
export interface AgentTokenResult {
  agent: AgentAdmin;
  token: string;
}

export type AgentJobType =
  | "SYNC"
  | "PERSON_ADD"
  | "PERSON_REMOVE"
  | "CARD_ADD"
  | "CARD_REMOVE"
  | "FINGERPRINT_APPLY";

export type AgentJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED";

/** Trabajo encolado para que el agente local lo ejecute contra el reloj. */
export interface AgentJob {
  id: string;
  clockSerial: string | null;
  type: AgentJobType;
  payload: Record<string, unknown>;
  status: AgentJobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
  result: unknown;
  error: string | null;
  createdAt: string;
}

/** Techo de tipos que el panel encola hoy (F3-07). */
export type PanelJobType = "SYNC" | "PERSON_ADD" | "PERSON_REMOVE" | "CARD_ADD";

export interface EnqueueAgentJobInput {
  type: PanelJobType;
  clockSerial: string;
  payload?: Record<string, unknown>;
}
