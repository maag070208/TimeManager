import type { PunchAdjustmentStatus, PunchMethod, WorkdayAlertScope } from "@prisma/client";
import type { AuditLogger } from "@modules/users/services/user.service";

export type NomAuditLogger = AuditLogger;

/** Límites y retención vigentes de un cliente (F2-03 / F2-04). */
export interface NomConfig {
  workdayLimitMinutes: number;
  /** Primer día de la semana del cliente (0=domingo … 6=sábado). */
  weekStartDay: number;
  /** Defaults para horarios nuevos (tolerancias, comida y mínimo de extra). */
  attendanceDefaults: {
    entryToleranceMin: number;
    exitToleranceMin: number;
    mealBreakMin: number;
    minOvertimeMin: number;
  };
  weeklyLimitMinutes: number;
  /** `null` = retención deshabilitada (no se archiva). */
  retentionMonths: number | null;
  /** Origen de cada valor efectivo (para la pantalla de configuración). */
  source: {
    workdayLimit: "tenant" | "sys_config" | "legal_default";
    weeklyLimit: "tenant" | "sys_config" | "legal_default";
    retention: "tenant" | "sys_config" | "disabled";
  };
  /** Contexto legal del año vigente (jornada y topes de horas extra). */
  legal: {
    year: number;
    weeklyLimitMinutes: number;
    workdayLimitMinutes: number;
    weeklyOvertimeLimitMinutes: number;
    weeklyTripleLimitMinutes: number;
    dailyOvertimeLimitMinutes: number;
    maxOvertimeDaysPerWeek: number;
    weeklyInfractionLimitMinutes: number;
  };
  /** ¿Marcaje remoto habilitado para el cliente? (F2-07) */
  remotePunchEnabled: boolean;
  /** RJ-02: el marcaje remoto suma jornada si no hay reloj ese día. */
  remoteCountsForWorkday: boolean;
  blockRemoteWithoutAgreement: boolean;
  requireUnionForCollective: boolean;
  /** Si está apagada, la checada web no pide ni guarda ubicación. */
  remoteGeolocationEnabled: boolean;
  /** Si está apagada, la checada web/app solo registra entrada y salida. */
  lunchPunchEnabled: boolean;
  /** Textos NOM-037 y aviso de privacidad vigentes (F2-08). */
  policy: TeleworkPolicyTexts;
}

export interface NomSettingsUpdateInput {
  weekStartDay?: number | null;
  defaultEntryToleranceMin?: number | null;
  defaultExitToleranceMin?: number | null;
  defaultMealBreakMin?: number | null;
  defaultMinOvertimeMin?: number | null;
  workdayLimitMinutes?: number | null;
  weeklyLimitMinutes?: number | null;
  retentionMonths?: number | null;
  /** Interruptor del marcaje remoto (F2-07). */
  remotePunchEnabled?: boolean;
  remoteCountsForWorkday?: boolean;
  blockRemoteWithoutAgreement?: boolean;
  requireUnionForCollective?: boolean;
  remoteGeolocationEnabled?: boolean;
  lunchPunchEnabled?: boolean;
}

/** Snapshot de la checada al momento de pedir el ajuste (valor anterior). */
export interface PunchSnapshot {
  occurredAt: string;
  method: PunchMethod;
  minor: number;
  clockSerial: string;
  serialNo: number;
  employeeNumber: string;
  name: string;
}

export interface AdjustmentCreateInput {
  reason: string;
  /** Nueva hora de la checada (ISO 8601). */
  occurredAt?: string;
  /** Nuevo método detectado (corrección de captura). */
  method?: PunchMethod;
  /** Nuevo código minor del evento. */
  minor?: number;
  /** Corrección para marcajes remotos: tipo de checada. */
  punchType?: "ENTRY" | "EXIT" | "LUNCH_START" | "LUNCH_END";
  /** Corrección para marcajes remotos: modalidad. */
  workMode?: RemoteWorkMode;
  /** Nota libre del aprobador/revisor. */
  note?: string;
}

export interface AdjustmentDecisionInput {
  decision: "APPROVE" | "REJECT";
  note?: string;
}

export interface AdjustmentDto {
  id: string;
  punchId: string;
  status: PunchAdjustmentStatus;
  reason: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  requestedById: string;
  requestedByName: string | null;
  createdAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface AuditEntryDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userName: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PunchHistory {
  punch: {
    id: string;
    clockSerial: string;
    serialNo: number;
    employeeNumber: string;
    name: string;
    method: PunchMethod;
    minor: number;
    occurredAt: string;
    createdAt: string;
  };
  /** Valor vigente = original + ajustes APROBADOS aplicados en orden. */
  effective: {
    occurredAt: string;
    method: PunchMethod;
    minor: number;
    /** Ajustes aprobados aplicados (ids). */
    appliedAdjustmentIds: string[];
  };
  adjustments: AdjustmentDto[];
  audit: AuditEntryDto[];
}

export interface MyPunch {
  id: string;
  source: "CLOCK" | "ACCESS" | "REMOTE";
  type: RemotePunchDirection | null;
  occurredAt: string;
  method: string;
  clockSerial: string | null;
}

export interface WorkdayAlertDto {
  id: string;
  scope: WorkdayAlertScope;
  date: string;
  userId: string;
  userName: string | null;
  employeeNumber: string | null;
  workedMinutes: number;
  limitMinutes: number;
  notifyCount: number;
  notifiedAt: string;
  createdAt: string;
}

export interface AlertScanInput {
  /** Día local `YYYY-MM-DD` a revisar (default: ayer). */
  date?: string;
  scope?: "DAY" | "WEEK" | "ALL";
}

export interface AlertScanResult {
  date: string;
  scope: "DAY" | "WEEK" | "ALL";
  created: WorkdayAlertDto[];
  evaluatedDays: number;
  evaluatedWeeks: number;
}

export interface RetentionConfigDto {
  retentionMonths: number | null;
  cutoff: string | null;
  pending: { punches: number; accessEvents: number; remotePunches: number };
}

export interface ArchiveResult {
  tenantId: string;
  retentionMonths: number;
  cutoff: string;
  dryRun: boolean;
  punches: number;
  accessEvents: number;
  remotePunches: number;
  adjustments: number;
}

export interface StpsExportParams {
  period: "DAY" | "WEEK" | "FORTNIGHT" | "MONTH";
  date: string;
  format: "json" | "csv";
  actorId?: string;
}

export interface StpsExportRow {
  date: string;
  employeeNumber: string | null;
  name: string;
  department: string | null;
  scheduleName: string | null;
  shift: string | null;
  workedMinutes: number;
  scheduledMinutes: number;
  extraMinutes: number;
  /** Bolsas del motor semanal (F1). */
  extraDoubleMinutes: number;
  extraTripleMinutes: number;
  illegalExtraMinutes: number;
  restDayWorkedMinutes: number;
  holidayWorkedMinutes: number;
  sundayWorked: boolean;
  minor: boolean;
  violations: string[];
  restDay: boolean;
  withoutSchedule: boolean;
  lastExitAt: string | null;
}

export interface StpsRemotePunchRow {
  date: string;
  employeeNumber: string | null;
  name: string;
  type: string;
  workMode: string;
  occurredAt: string;
  hasGeolocation: boolean;
}

export interface StpsExportResult {
  contentType: string;
  filename: string;
  body: string;
  sha256: string;
  rowCount: number;
}

// ── F2-07 marcaje remoto ────────────────────────────────────────────────────

export type RemotePunchDirection = "ENTRY" | "EXIT" | "LUNCH_START" | "LUNCH_END";
export type RemoteWorkMode = "PRESENCIAL" | "HIBRIDO" | "REMOTO" | "CAMPO";

export interface RemotePunchInput {
  type: RemotePunchDirection;
  workMode?: RemoteWorkMode;
  /** Obligatorio (lo exige `RemotePunchDto`): llave de idempotencia del cliente. */
  clientEventId: string;
  clientReportedAt?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracyMeters?: number;
  note?: string;
}

export interface RemotePunchDto {
  id: string;
  type: RemotePunchDirection;
  workMode: RemoteWorkMode;
  occurredAt: string;
  clientReportedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  createdAt: string;
}

// ── F2-08 NOM-037 teletrabajo ───────────────────────────────────────────────

export type TeleworkMode = "REMOTO" | "HIBRIDO" | "CAMPO";
export type TeleworkStatus = "ACTIVE" | "ENDED";
export type TeleworkChecklistKind = "INITIAL" | "PERIODIC";
export type OutOfHoursChannel = "CALL" | "MESSAGE" | "EMAIL" | "OTHER";

export interface TeleworkPolicyTexts {
  teleworkPolicy: string | null;
  disconnectPolicy: string | null;
  privacyNotice: string | null;
  policyVersion: number;
  privacyNoticeVersion: number;
  policiesUpdatedAt: string | null;
}

export interface TeleworkPolicyUpdateInput {
  teleworkPolicy?: string | null;
  disconnectPolicy?: string | null;
  privacyNotice?: string | null;
}

export interface TeleworkRegistrationInput {
  userId: string;
  mode?: TeleworkMode;
  homeAddress?: string;
  notes?: string;
  startedAt?: string;
}

export interface TeleworkRegistrationUpdateInput {
  mode?: TeleworkMode;
  status?: TeleworkStatus;
  homeAddress?: string | null;
  notes?: string | null;
  endedAt?: string | null;
}

export interface TeleworkChecklistDto {
  id: string;
  registrationId: string;
  userId: string;
  userName: string | null;
  kind: TeleworkChecklistKind;
  answers: Record<string, "YES" | "NO">;
  completedAt: string;
}

export interface TeleworkRegistrationDto {
  id: string;
  userId: string;
  userName: string | null;
  email: string | null;
  employeeNumber: string | null;
  mode: TeleworkMode;
  status: TeleworkStatus;
  homeAddress: string | null;
  startedAt: string;
  endedAt: string | null;
  consentAcceptedAt: string | null;
  consentPolicyVersion: number | null;
  consentPrivacyVersion: number | null;
  notes: string | null;
  lastChecklist: { kind: TeleworkChecklistKind; completedAt: string } | null;
  nextPeriodicDueAt: string | null;
}

export interface OutOfHoursContactInput {
  userId: string;
  contactedAt?: string;
  channel: OutOfHoursChannel;
  reason: string;
}

export interface OutOfHoursContactDto {
  id: string;
  userId: string;
  userName: string | null;
  contactedAt: string;
  channel: OutOfHoursChannel;
  reason: string;
  notifiedEmployee: boolean;
  createdAt: string;
}

export interface MyTelework {
  registration: TeleworkRegistrationDto | null;
  policy: TeleworkPolicyTexts;
  remotePunchEnabled: boolean;
  /** ¿Esta persona puede checar por web/app? Falso si el cliente lo apagó o ella checa solo en reloj. */
  canPunchRemote: boolean;
  remoteGeolocationEnabled: boolean;
  lunchPunchEnabled: boolean;
  checklistTemplate: { version: number; items: string[] };
  lastChecklist: TeleworkChecklistDto | null;
  nextPeriodicDueAt: string | null;
  consentCurrent: boolean;
  pendingConsent: boolean;
}
