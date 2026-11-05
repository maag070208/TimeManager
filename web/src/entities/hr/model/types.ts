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
  role: "ADMIN" | "MANAGER" | "AREA_HEAD" | "EMPLOYEE" | "HUMAN_RESOURCES" | "CHEF";
  active: boolean;
  jobTitle?: string | null;
  employeeNumber?: string | null;
  company?: string | null;
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

/** Actividad de una persona en el sistema: equipo prestado, kardex, tickets y tareas. */
export interface EmployeeOverview {
  summary: { openTickets: number; pendingTasks: number };
  /** Equipo prestado y kardex: `null` si la sesión no tiene `loans.view` (RH no lo ve). */
  inventory: {
    summary: { activeLoans: number; borrowedUnits: number };
    loans: Array<{
      id: string;
      number: string;
      date: string;
      status: "ACTIVE" | "PARTIAL" | "RETURNED" | "CANCELLED";
      items: Array<{ device: string; quantity: number; returned: number }>;
    }>;
    kardex: Array<{
      type: "LOAN" | "RETURN";
      date: string;
      number: string;
      loanNumber?: string;
      items: Array<{ device: string; quantity: number; condition?: string }>;
    }>;
  } | null;
  tickets: Array<{ id: string; title: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; priority: string; createdAt: string; relation: "CREATED" | "ASSIGNED" }>;
  tasks: Array<{ id: string; title: string; status: "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED"; dueDate: string | null; ticketId: string; ticketTitle: string }>;
}
