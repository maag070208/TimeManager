import { z } from "zod";

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date");

export const AdjustmentCreateDto = z
  .object({
    reason: z.string().trim().min(5).max(500),
    occurredAt: isoDate.optional(),
    method: z.enum(["FACE", "FINGERPRINT", "CARD", "OTHER"]).optional(),
    minor: z.number().int().min(0).max(999).optional(),
    punchType: z.enum(["ENTRY", "EXIT", "LUNCH_START", "LUNCH_END"]).optional(),
    workMode: z.enum(["PRESENCIAL", "HIBRIDO", "REMOTO", "CAMPO"]).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const AdjustmentDecisionDto = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const NomSettingsUpdateDto = z
  .object({
    weekStartDay: z.number().int().min(0).max(6).nullable().optional(),
    defaultEntryToleranceMin: z.number().int().min(0).max(240).nullable().optional(),
    defaultExitToleranceMin: z.number().int().min(0).max(240).nullable().optional(),
    defaultMealBreakMin: z.number().int().min(0).max(240).nullable().optional(),
    defaultMinOvertimeMin: z.number().int().min(0).max(1440).nullable().optional(),
    workdayLimitMinutes: z.number().int().min(60).max(1440).nullable().optional(),
    weeklyLimitMinutes: z.number().int().min(600).max(10080).nullable().optional(),
    retentionMonths: z.number().int().min(1).max(120).nullable().optional(),
    remotePunchEnabled: z.boolean().optional(),
    remoteCountsForWorkday: z.boolean().optional(),
    blockRemoteWithoutAgreement: z.boolean().optional(),
    requireUnionForCollective: z.boolean().optional(),
    remoteGeolocationEnabled: z.boolean().optional(),
    lunchPunchEnabled: z.boolean().optional(),
  })
  .strict();

export const DistributionAgreementCreateDto = z
  .object({
    userId: z.string().min(1).nullable().optional(),
    scheduleId: z.string().min(1).nullable().optional(),
    kind: z.enum(["INDIVIDUAL", "COLECTIVO"]).optional(),
    party: z.enum(["WORKER", "UNION"]).optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    evidenceText: z.string().trim().min(20).max(5000),
  })
  .strict();

export const AlertScanDto = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    scope: z.enum(["DAY", "WEEK", "ALL"]).optional(),
  })
  .strict();

export const ArchiveDto = z
  .object({
    dryRun: z.boolean().optional(),
    /** Solo plataforma: archiva un cliente concreto (si no, el del contexto). */
    tenantId: z.string().uuid().optional(),
  })
  .strict();

export const DiscrepancyCreateDto = z
  .object({
    punchId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    expectedOccurredAt: isoDate.optional(),
  })
  .strict();

export const PunchQueryDto = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .passthrough();

export const RemotePunchDto = z
  .object({
    type: z.enum(["ENTRY", "EXIT", "LUNCH_START", "LUNCH_END"]),
    workMode: z.enum(["PRESENCIAL", "HIBRIDO", "REMOTO", "CAMPO"]).optional(),
    // Obligatorio: es la llave de idempotencia de la checada remota (F2-07).
    clientEventId: z.string().uuid(),
    clientReportedAt: isoDate.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    gpsAccuracyMeters: z.number().nonnegative().max(100000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const TeleworkPolicyDto = z
  .object({
    teleworkPolicy: z.string().max(20000).nullable().optional(),
    disconnectPolicy: z.string().max(20000).nullable().optional(),
    privacyNotice: z.string().max(20000).nullable().optional(),
  })
  .strict();

export const TeleworkRegistrationDto = z
  .object({
    userId: z.string().uuid(),
    mode: z.enum(["REMOTO", "HIBRIDO", "CAMPO"]).optional(),
    homeAddress: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    startedAt: isoDate.optional(),
  })
  .strict();

export const TeleworkRegistrationUpdateDto = z
  .object({
    mode: z.enum(["REMOTO", "HIBRIDO", "CAMPO"]).optional(),
    status: z.enum(["ACTIVE", "ENDED"]).optional(),
    homeAddress: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    endedAt: isoDate.nullable().optional(),
  })
  .strict();

export const TeleworkAcceptDto = z
  .object({
    policyVersion: z.number().int().min(1),
    privacyNoticeVersion: z.number().int().min(1),
  })
  .strict();

export const TeleworkChecklistDto = z
  .object({
    kind: z.enum(["INITIAL", "PERIODIC"]).optional(),
    answers: z.record(z.enum(["YES", "NO"])),
  })
  .strict();

export const OutOfHoursContactDto = z
  .object({
    userId: z.string().uuid(),
    contactedAt: isoDate.optional(),
    channel: z.enum(["CALL", "MESSAGE", "EMAIL", "OTHER"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
