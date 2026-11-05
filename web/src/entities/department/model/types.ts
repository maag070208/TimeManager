export interface Subarea {
  id: string;
  departmentId: string;
  name: string;
  active: boolean;
  department?: { id: string; name: string };
}

export interface Department {
  id: string;
  name: string;
  active: boolean;
  subareas: Subarea[];
  _count?: { users: number };
}
