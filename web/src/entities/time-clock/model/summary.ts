/** Resumen de estado del reloj (`GET /time-clock/summary`). Solo lectura. */

export type ClockConnection = "ONLINE" | "NO_RESPONSE" | "PAUSED_CREDENTIALS" | "NOT_READ";

export type ClockAlertCode =
  | "NO_RESPONSE"
  | "CREDENTIALS"
  | "SUSPICIOUS_ROSTER"
  | "PENDING_REMOVALS"
  | "REAPPEARED"
  | "UNLINKED"
  | "SYNC_ERROR";

export interface ClockAlert {
  code: ClockAlertCode;
  severity: "critical" | "warning" | "info";
  count?: number;
}

export interface SummaryClock {
  serial: string;
  name: string | null;
  countsAttendance: boolean;
  connection: ClockConnection;
  lastReadAt: string | null;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  device: { deviceName: string | null; model: string | null; firmwareVersion: string | null } | null;
  counts: { people: number; cards: number } | null;
  punchesToday: number;
  hourly: Array<{ hour: number; count: number; people: Array<{ employeeNumber: string; name: string }> }>;
  recentPunches: Array<{ occurredAt: string; employeeNumber: string; name: string; method: string }>;
  alerts: ClockAlert[];
}

export interface TimeClockSummary {
  generatedAt: string;
  timezone: string;
  roster: { suspicious: boolean; pendingRemovals: number; reappeared: number; unlinked: number };
  alerts: ClockAlert[];
  clocks: SummaryClock[];
}
