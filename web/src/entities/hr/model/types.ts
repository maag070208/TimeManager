export type DiscountType = "INFONAVIT" | "IMSS" | "CHILD_SUPPORT";

export interface Gender {
  id: string;
  name: string;
  active: boolean;
}

/** Claves de los roles de personal (dinámicos, `staff` en `/roles`). */
export type PersonalRole = string;

export interface PersonalStats {
  total: number;
  active: number;
  inactive: number;
  roles: Record<PersonalRole, number>;
}

export interface BloodType {
  id: string;
  name: string;
  active: boolean;
}

export interface DocumentType {
  id: string;
  name: string;
  active: boolean;
  /** Obligatorio en el expediente (el alta lo exige; el tablero de RH marca a quien le falta). */
  required: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface EmployeeDiscount {
  type: DiscountType;
  note?: string | null;
}

export interface EmployeeDocument {
  id: string;
  documentTypeId: string;
  documentType: { id: string; name: string };
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface PersonalProfile {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  role: string;
  active: boolean;
  jobTitle?: string | null;
  employeeNumber?: string | null;
  /** Cómo marca asistencia: checada web, reloj físico o híbrido. */
  checkinMode?: "WEB" | "CLOCK" | "HYBRID" | null;
  department?: { id: string; name: string } | null;
  subarea?: { id: string; name: string } | null;

  middleName?: string | null;
  paternalSurname?: string | null;
  maternalSurname?: string | null;
  photoUrl?: string | null;

  gender?: Gender | null;
  bloodType?: BloodType | null;
  medicalConditions?: string | null;
  allergies?: string | null;

  birthDate?: string | null;
  hireDate?: string | null;

  rfc?: string | null;
  curp?: string | null;
  nss?: string | null;

  streetAddress?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  addressState?: string | null;
  country?: string | null;

  personalPhone?: string | null;
  workPhone?: string | null;

  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;

  discounts: EmployeeDiscount[];

  createdAt: string;
}

export interface PersonalProfileUpdateInput {
  /** Primer nombre. El expediente es su dueño: el formulario de usuario solo lo captura al dar de alta. */
  name?: string;
  middleName?: string | null;
  /** Datos laborales: también viven en el expediente. */
  employeeNumber?: string | null;
  jobTitle?: string | null;
  checkinMode?: "WEB" | "CLOCK" | "HYBRID";
  departmentId?: string | null;
  subareaId?: string | null;
  paternalSurname?: string | null;
  maternalSurname?: string | null;
  email?: string | null;

  genderId?: string | null;
  bloodTypeId?: string | null;
  medicalConditions?: string | null;
  allergies?: string | null;

  birthDate?: string | null;
  hireDate?: string | null;

  rfc?: string | null;
  curp?: string | null;
  nss?: string | null;

  streetAddress?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  addressState?: string | null;
  country?: string | null;

  personalPhone?: string | null;
  workPhone?: string | null;

  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
}

export type DisciplinaryReason =
  | "ABSENCE"
  | "TARDINESS"
  | "INTOXICATION"
  | "MISCONDUCT"
  | "NONCOMPLIANCE"
  | "OTHER";

export interface DisciplinaryReport {
  id: string;
  reason: DisciplinaryReason;
  incidentDate: string;
  description: string;
  sanction?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    employeeNumber?: string | null;
    jobTitle?: string | null;
    department?: { id: string; name: string } | null;
    subarea?: { id: string; name: string } | null;
  };
  createdBy: { id: string; name: string };
}

export interface DisciplinaryReportCreateInput {
  userId: string;
  reason: DisciplinaryReason;
  incidentDate: string;
  description: string;
  sanction?: string;
}

/** Asignación en lote de departamento y subárea a varios empleados (RH). */
export interface EmployeeAssignmentInput {
  userIds: string[];
  departmentId: string | null;
  subareaId?: string | null;
}

/** Actividad de una persona (`GET /hr/:id/overview`): documentos, checadas, actas y horario. */
export interface EmployeeOverview {
  employee: {
    id: string;
    name: string;
    employeeNumber: string | null;
    jobTitle: string | null;
    department: string | null;
    active: boolean;
  };
  summary: {
    documents: number;
    missingRequiredDocuments: number;
    punchesLast30Days: number;
    disciplinaryReportsLastYear: number;
  };
  schedule: { id: string; name: string; validFrom: string } | null;
  documents: Array<{ id: string; name: string; type: string; uploadedAt: string }>;
  punches: Array<{ id: string; occurredAt: string; method: string; clock: string | null; source?: "WEB" | "APP" | "CLOCK" }>;
}

/** Corrección ligada a una checada (la checada es inmutable; se corrige por ajuste). */
export interface PunchHistoryAdjustment {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reason: string;
  proposedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** Checada con todo su detalle (`GET /hr/:id/punches`). */
export interface PunchHistoryEntry {
  id: string;
  occurredAt: string;
  source: "CLOCK" | "WEB" | "APP";
  type: "ENTRY" | "LUNCH_START" | "LUNCH_END" | "EXIT" | null;
  method: "FACE" | "FINGERPRINT" | "CARD" | "OTHER" | null;
  clock: string | null;
  workMode: "PRESENCIAL" | "HIBRIDO" | "REMOTO" | "CAMPO" | null;
  location: { latitude: number; longitude: number; gpsAccuracyMeters: number | null } | null;
  clientReportedAt: string | null;
  note: string | null;
  receivedAt: string;
  adjustments: PunchHistoryAdjustment[];
}

export interface EmployeePunchHistory {
  range: { from: string; to: string; timezone: string };
  punches: PunchHistoryEntry[];
}
