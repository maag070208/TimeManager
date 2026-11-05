import { api } from "@shared/api/client";
import type { Plan, PlanCreateInput, PlanUpdateInput } from "../model/types";

export const planApi = {
  /** Catálogo activo; `includeInactive` para la consola (incluye las bajas). */
  list: (includeInactive = false) =>
    api.get<Plan[]>(`/plans${includeInactive ? "?includeInactive=true" : ""}`),
  get: (id: string) => api.get<Plan>(`/plans/${id}`),
  create: (input: PlanCreateInput) => api.post<Plan>("/plans", input),
  update: (id: string, input: PlanUpdateInput) => api.patch<Plan>(`/plans/${id}`, input),
  deactivate: (id: string) => api.delete<Plan>(`/plans/${id}`),
};
