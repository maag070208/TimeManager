import { api } from "@shared/api/client";
import type {
  MeTelework,
  OvertimeRequestRow,
  RecordAgreement,
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

export const nomApi = {
  myPunches: (params: { from?: string; to?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return api.get<MyPunch[]>(`${base}/me/punches${query ? `?${query}` : ""}`);
  },

  /** Prueba plena (R-01): acuerdo del método de registro del trabajador. */
  myRecordAgreement: () => api.get<RecordAgreement | null>(`${base}/me/record-agreement`),
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
    clientEventId?: string;
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
