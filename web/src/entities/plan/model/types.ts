/** Plan del catálogo del SaaS (F3-09). Precio mensual de lista; el cobro va aparte. */
export interface Plan {
  id: string;
  key: string;
  name: string;
  employeeLimit: number;
  clockLimit: number;
  /** Precio mensual de lista; `null` = por definir. */
  monthlyPrice: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanCreateInput {
  /** Sin clave se deriva del nombre. */
  key?: string;
  name: string;
  employeeLimit: number;
  clockLimit: number;
  monthlyPrice?: number | null;
  sortOrder?: number;
}

export type PlanUpdateInput = Partial<Omit<PlanCreateInput, "key">> & { active?: boolean };
