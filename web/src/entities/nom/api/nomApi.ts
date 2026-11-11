import { api } from "@shared/api/client";
import type {
  MeTelework,
  OvertimeRequestRow,
  LeaveBalance,
  LeaveRequestRow,
  LeaveType,
  RecordAgreement,
  RecordAgreementAdmin,
  RecordAgreementProposal,
  DistributionAgreement,
  MyDistributionAgreement,
  WorkRecordAcknowledgment,
  MyPunch,
  OutOfHoursChannel,
  OutOfHoursContact,
  PunchType,
  RemotePunchResult,
  RemoteWorkMode,
  TeleworkChecklist,
  TeleworkChecklistKind,
  TeleworkMode,
  TeleworkPolicyTexts,
  TeleworkRegistration,
  TeleworkStatus,
} from "../model/types";

const base = "/nom";

export interface NomConfigDto {
  workdayLimitMinutes: number;
  weekStartDay: number;
  weeklyLimitMinutes: number;
  retentionMonths: number | null;
  remotePunchEnabled: boolean;
  remoteCountsForWorkday: boolean;
  blockRemoteWithoutAgreement: boolean;
  requireUnionForCollective: boolean;
  remoteGeolocationEnabled: boolean;
  legal?: {
    year: number;
    weeklyLimitMinutes: number;
    workdayLimitMinutes: number;
    weeklyInfractionLimitMinutes?: number;
  };
  attendanceDefaults: {
    entryToleranceMin: number;
    exitToleranceMin: number;
    mealBreakMin: number;
    minOvertimeMin: number;
  };
}

export const nomApi = {
  getConfig: () => api.get<NomConfigDto>(`${base}/config`),
  updateConfig: (input: {
    weekStartDay?: number;
    defaultEntryToleranceMin?: number;
    defaultExitToleranceMin?: number;
    defaultMealBreakMin?: number;
    defaultMinOvertimeMin?: number;
    workdayLimitMinutes?: number;
    weeklyLimitMinutes?: number;
    retentionMonths?: number | null;
    remotePunchEnabled?: boolean;
    remoteCountsForWorkday?: boolean;
    blockRemoteWithoutAgreement?: boolean;
    requireUnionForCollective?: boolean;
    remoteGeolocationEnabled?: boolean;
  }) =>
    api.put<NomConfigDto>(`${base}/config`, input),
  myPunches: (params: { from?: string; to?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return api.get<MyPunch[]>(`${base}/me/punches${query ? `?${query}` : ""}`);
  },

  distributionAgreements: () => api.get<DistributionAgreement[]>(`${base}/distribution-agreements`),
  createDistributionAgreement: (input: {
    userId: string;
    kind: "INDIVIDUAL" | "COLECTIVO";
    party: "WORKER" | "UNION";
    effectiveFrom: string;
    effectiveTo?: string | null;
    evidenceText: string;
  }) => api.post<DistributionAgreement>(`${base}/distribution-agreements`, input),
  myDistributionAgreements: () => api.get<MyDistributionAgreement[]>(`${base}/me/distribution-agreements`),
  acceptDistributionAgreement: (id: string) =>
    api.post<DistributionAgreement>(`${base}/me/distribution-agreements/${id}/accept`, {}),
  recordAgreements: () => api.get<RecordAgreementAdmin[]>(`${base}/record-agreements`),
  signRecordAgreement: (id: string) => api.post<RecordAgreement>(`${base}/record-agreements/${id}/employer-sign`, {}),
  archiveRetention: (dryRun: boolean) =>
    api.post<{ punches: number; accessEvents: number; remotePunches: number; adjustments: number; dryRun: boolean }>(
      `${base}/retention/archive`,
      { dryRun }
    ),

  /** Vacaciones y permisos del trabajador. */
  leaveBalance: (year: number) => api.get<LeaveBalance>(`${base}/me/leave/balance?year=${year}`),
  leaveTypes: (includeInactive = false) => api.get<LeaveType[]>(`${base}/leave/types${includeInactive ? "?includeInactive=true" : ""}`),
  createType: (input: { key: string; name: string; paid?: boolean }) =>
    api.post<LeaveType>(`${base}/leave/types`, input),
  updateType: (id: string, input: { name?: string; paid?: boolean; active?: boolean }) =>
    api.patch<LeaveType>(`${base}/leave/types/${id}`, input),
  removeType: (id: string) => api.delete<LeaveType>(`${base}/leave/types/${id}`),
  myLeaveRequests: () => api.get<LeaveRequestRow[]>(`${base}/me/leave/requests`),
  createLeaveRequest: (input: { typeId: string; startDate: string; endDate: string; reason?: string }) =>
    api.post<LeaveRequestRow>(`${base}/me/leave/requests`, input),
  cancelLeaveRequest: (id: string) => api.post<LeaveRequestRow>(`${base}/me/leave/requests/${id}/cancel`, {}),
  leaveRequests: (status?: string) =>
    api.get<LeaveRequestRow[]>(`${base}/leave/requests${status ? `?status=${status}` : ""}`),
  decideLeaveRequest: (id: string, input: { approve: boolean; note?: string }) =>
    api.post<LeaveRequestRow>(`${base}/leave/requests/${id}/decide`, input),

  /** Prueba plena (R-01): acuerdo del método de registro del trabajador. */
  myRecordAgreement: () => api.get<RecordAgreement | null>(`${base}/me/record-agreement`),
  recordProposal: () => api.get<RecordAgreementProposal>(`${base}/me/record-agreement/proposal`),
  acceptRecordAgreement: (input: {
    methods: string[];
    roundingPolicy?: string | null;
    correctionRules?: string | null;
  }) => api.post<RecordAgreement>(`${base}/me/record-agreement/accept`, input),
  myRecordAcknowledgments: () =>
    api.get<WorkRecordAcknowledgment[]>(`${base}/me/record-acknowledgments`),
  acknowledgeRecord: (input: {
    periodStart: string;
    periodEnd: string;
    accept: boolean;
    note?: string | null;
  }) => api.post<WorkRecordAcknowledgment>(`${base}/me/record-acknowledgments`, input),

  /** Autorización previa + consentimiento de horas extra (F3/1.5). */
  myOvertimeRequests: () => api.get<OvertimeRequestRow[]>(`${base}/me/overtime-requests`),
  decideOvertimeRequest: (id: string, input: { accept: boolean; note?: string | null }) =>
    api.post<OvertimeRequestRow>(`${base}/me/overtime-requests/${id}/decision`, input),

  /** Marcaje remoto (sin reloj). La geolocalización es opcional y solo de este momento. */
  punch: (input: {
    type: PunchType;
    workMode?: RemoteWorkMode;
    /** Obligatorio: llave de idempotencia del reintento (uuid). */
    clientEventId: string;
    latitude?: number;
    longitude?: number;
    gpsAccuracyMeters?: number;
    note?: string;
  }) => api.post<RemotePunchResult>(`${base}/me/punch`, input),

  reportDiscrepancy: (input: {
    punchId: string;
    reason: string;
    expectedOccurredAt?: string;
  }) => api.post<{ id: string }>(`${base}/me/discrepancies`, input),

  myTelework: () => api.get<MeTelework>(`${base}/me/telework`),

  acceptTeleworkPolicy: (input: { policyVersion: number; privacyNoticeVersion: number }) =>
    api.post<TeleworkRegistration>(`${base}/me/telework/accept`, input),

  submitTeleworkChecklist: (input: {
    kind?: TeleworkChecklistKind;
    answers: Record<string, "YES" | "NO">;
  }) => api.post<TeleworkChecklist>(`${base}/me/telework/checklist`, input),

  teleworkPolicy: () =>
    api.get<TeleworkPolicyTexts & { remotePunchEnabled: boolean }>(`${base}/telework/policy`),

  updateTeleworkPolicy: (input: {
    teleworkPolicy?: string | null;
    disconnectPolicy?: string | null;
    privacyNotice?: string | null;
  }) => api.put<TeleworkPolicyTexts>(`${base}/telework/policy`, input),

  teleworkRegistrations: () =>
    api.get<TeleworkRegistration[]>(`${base}/telework/registrations`),

  registerTelework: (input: {
    userId: string;
    mode?: TeleworkMode;
    homeAddress?: string;
    notes?: string;
  }) => api.post<TeleworkRegistration>(`${base}/telework/registrations`, input),

  updateTeleworkRegistration: (
    id: string,
    input: { mode?: TeleworkMode; status?: TeleworkStatus; homeAddress?: string | null; notes?: string | null }
  ) => api.patch<TeleworkRegistration>(`${base}/telework/registrations/${id}`, input),

  teleworkChecklists: () => api.get<TeleworkChecklist[]>(`${base}/telework/checklists`),

  outOfHoursContacts: () => api.get<OutOfHoursContact[]>(`${base}/telework/out-of-hours-contacts`),

  registerOutOfHoursContact: (input: {
    userId: string;
    channel: OutOfHoursChannel;
    reason: string;
  }) => api.post<OutOfHoursContact>(`${base}/telework/out-of-hours-contacts`, input),
};
