/** Tipos del módulo NOM (registro de jornada LFT 2027 + NOM-037 teletrabajo). */

export type PunchSource = "CLOCK" | "ACCESS" | "REMOTE";
export type PunchType = "ENTRY" | "EXIT";
export type RemoteWorkMode = "PRESENCIAL" | "HIBRIDO" | "REMOTO" | "CAMPO";

export interface MyPunch {
  id: string;
  source: PunchSource;
  type: PunchType | null;
  occurredAt: string;
  method: string;
  clockSerial: string | null;
}

export interface RemotePunchResult {
  created: boolean;
  punch: {
    id: string;
    type: PunchType;
    workMode: RemoteWorkMode;
    occurredAt: string;
    clientReportedAt: string | null;
    latitude: number | null;
    longitude: number | null;
    note: string | null;
    createdAt: string;
  };
}

export interface TeleworkPolicyTexts {
  teleworkPolicy: string | null;
  disconnectPolicy: string | null;
  privacyNotice: string | null;
  policyVersion: number;
  privacyNoticeVersion: number;
  policiesUpdatedAt: string | null;
}

export type TeleworkMode = "REMOTO" | "HIBRIDO" | "CAMPO";
export type TeleworkStatus = "ACTIVE" | "ENDED";
export type TeleworkChecklistKind = "INITIAL" | "PERIODIC";

export interface TeleworkRegistration {
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

export interface TeleworkChecklist {
  id: string;
  registrationId: string;
  userId: string;
  userName: string | null;
  kind: TeleworkChecklistKind;
  answers: Record<string, "YES" | "NO">;
  completedAt: string;
}

export interface MeTelework {
  registration: TeleworkRegistration | null;
  policy: TeleworkPolicyTexts;
  remotePunchEnabled: boolean;
  checklistTemplate: { version: number; items: string[] };
  lastChecklist: TeleworkChecklist | null;
  nextPeriodicDueAt: string | null;
  consentCurrent: boolean;
  pendingConsent: boolean;
}

export type OutOfHoursChannel = "CALL" | "MESSAGE" | "EMAIL" | "OTHER";

export interface OutOfHoursContact {
  id: string;
  userId: string;
  userName: string | null;
  contactedAt: string;
  channel: OutOfHoursChannel;
  reason: string;
  notifiedEmployee: boolean;
  createdAt: string;
}

/** Acuerdo del método de registro (R-01, prueba plena). */
export interface RecordAgreement {
  id: string;
  methods: string[];
  roundingPolicy: string | null;
  correctionRules: string | null;
  textVersion: number;
  acceptedAt: string | null;
  acceptedHash: string | null;
}

/** Conformidad periódica con el resumen de jornada (R-01). */
export interface WorkRecordAcknowledgment {
  id: string;
  periodStart: string;
  periodEnd: string;
  summaryHash: string;
  status: "PENDING" | "ACCEPTED" | "DISCREPANCY";
  acceptedAt: string | null;
  discrepancyNote: string | null;
}

/** Solicitud previa de horas extra (F3/1.5). */
export interface OvertimeRequestRow {
  id: string;
  reason: string;
  plannedMin: number;
  days: string[];
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  workerNote: string | null;
  workerDecidedAt: string | null;
  createdAt: string;
}

export interface LeaveType {
  id: string;
  key: string;
  name: string;
  kind: "VACATION" | "PAID_LEAVE" | "UNPAID_LEAVE" | "SICK_LEAVE" | "OTHER";
  paid: boolean;
}

export interface LeaveBalance {
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export interface LeaveRequestRow {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  decisionNote: string | null;
  user?: { name: string; employeeNumber: string | null } | null;
}
