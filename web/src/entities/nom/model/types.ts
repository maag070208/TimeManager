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
