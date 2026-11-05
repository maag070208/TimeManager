import type { AgentJobStatus, AgentJobType, PunchMethod } from "@prisma/client";

/** Agente autenticado por token de dispositivo; lo inyecta `authenticateAgent`. */
export interface AgentSession {
  id: string;
  tenantId: string;
  name: string;
}

/** Credenciales efectivas de un reloj tal como las recibe el agente. */
export interface AgentClockConfig {
  serialNumber: string;
  name: string | null;
  url: string;
  countsAttendance: boolean;
  writeEnabled: boolean;
  lastSerialNo: number;
  syncedAt: string | null;
  credentials: { username: string; password: string } | null;
}

export interface AgentConfig {
  agent: { id: string; name: string; version: string | null };
  tenant: { id: string; name: string; timezone: string };
  sync: {
    /** Cada cuánto lee el reloj y sube un chunk (segundos, 15–30). */
    chunkSeconds: number;
    /** Cada cuánto pide trabajos al API. */
    jobsPollSeconds: number;
    /** Cada cuánto manda heartbeat. */
    heartbeatSeconds: number;
  };
  clocks: AgentClockConfig[];
}

/** Una checada tal como la manda el agente, derivada del evento ISAPI. */
export interface AgentPunchInput {
  serialNo: number;
  employeeNumber: string;
  name?: string;
  /** Código `minor` del evento ISAPI (75 rostro, 38 huella, 1 tarjeta). */
  minor: number;
  occurredAt: string;
}

export interface AgentPunchesInput {
  clockSerial: string;
  punches: AgentPunchInput[];
  /** Consecutivo ya confirmado por el agente (para no pisar el cursor con uno menor). */
  lastSerialNo?: number;
}

export interface AgentPunchesResult {
  received: number;
  stored: number;
  duplicates: number;
  cursor: number;
}

export interface AgentJobRecord {
  id: string;
  tenantId: string;
  agentId: string | null;
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
  updatedAt: string;
}

export interface EnqueueAgentJobInput {
  tenantId: string;
  type: AgentJobType;
  payload?: Record<string, unknown>;
  clockSerial?: string | null;
  agentId?: string | null;
  maxAttempts?: number;
}

export interface SubmitAgentJobResultInput {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface AgentHeartbeatInput {
  version?: string;
  lastSyncAt?: string;
  pendingPunches?: number;
  clocks?: Array<{ serialNumber: string; ok: boolean; error?: string }>;
}

export interface AgentRegisterInput {
  name?: string;
  version?: string;
  platform?: string;
}

/** Agente tal como lo ve la consola de plataforma (sin tokenHash). */
export interface AgentAdminView {
  id: string;
  name: string;
  version: string | null;
  active: boolean;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

/** Trabajo que el panel (consola de relojes) encola para el agente local. */
export interface EnqueuePanelJobInput {
  type: "SYNC" | "PERSON_ADD" | "PERSON_REMOVE" | "CARD_ADD";
  clockSerial: string;
  payload: Record<string, unknown>;
}

export type AgentJobStatusName = AgentJobStatus;
export type AgentPunchMethod = PunchMethod;
