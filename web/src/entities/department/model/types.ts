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
  custodyLetters?: DepartmentCustodyLetter[];
  custodyLettersTotal?: number;
  _count?: { users: number };
}
