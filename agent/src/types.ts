/** Contrato entre el proceso principal (Electron) y la UI. */

export interface AgentClockState {
  serialNumber: string;
  name: string | null;
  url: string;
  /** `null` = todavía no se ha intentado. */
  ok: boolean | null;
  lastSyncAt: string | null;
  cursor: number;
  pending: number;
  error: string | null;
}

export interface LogLine {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface AgentSnapshot {
  configured: boolean;
  apiUrl: string;
  tokenSet: boolean;
  chunkSeconds: number;
  jobsPollSeconds: number;
  heartbeatSeconds: number;
  autoStart: boolean;
  version: string;
  agentId: string | null;
  tenantName: string | null;
  tokenValid: boolean | null;
  running: boolean;
  busy: boolean;
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingPunches: number;
  pendingJobs: number;
  clocks: AgentClockState[];
  logLines: LogLine[];
}

export interface AgentConfigPatch {
  apiUrl?: string;
  chunkSeconds?: number;
  autoStart?: boolean;
}

export interface AgentBridge {
  getState(): Promise<AgentSnapshot>;
  saveConfig(patch: AgentConfigPatch): Promise<AgentSnapshot>;
  setToken(token: string): Promise<AgentSnapshot>;
  register(): Promise<AgentSnapshot>;
  syncNow(): Promise<AgentSnapshot>;
  testClock(serialNumber: string): Promise<{ ok: boolean; message: string }>;
  rotateToken(): Promise<{ token: string }>;
  exportLogs(): Promise<{ saved: boolean; path?: string }>;
  openLogsFolder(): Promise<void>;
  getVersion(): Promise<string>;
  onState(listener: (state: AgentSnapshot) => void): () => void;
}

declare global {
  interface Window {
    agent: AgentBridge;
  }
}
