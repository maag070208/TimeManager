export interface Subarea {
  id: string;
  departmentId: string;
  name: string;
  active: boolean;
  department?: { id: string; name: string };
}

export interface DepartmentPersonRef {
  id: string;
  name: string;
}

export interface DepartmentTicket {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category: string;
  createdAt: string;
  assignedTo?: DepartmentPersonRef | null;
}

export interface DepartmentCustodyLetter {
  id: string;
  consecutive: string;
  date: string;
  returnDate?: string | null;
  custodian?: DepartmentPersonRef | null;
  supervisor?: DepartmentPersonRef | null;
  itemsCount: number;
}

export interface Department {
  id: string;
  name: string;
  active: boolean;
  subareas: Subarea[];
  tickets?: DepartmentTicket[];
  ticketsTotal?: number;
  custodyLetters?: DepartmentCustodyLetter[];
  custodyLettersTotal?: number;
  _count?: { users: number };
}
