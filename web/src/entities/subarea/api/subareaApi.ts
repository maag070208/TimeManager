import { api } from "@shared/api/client";
import {
  tableRequest,
  type ITDataTableFetchParamsPost,
} from "@shared/api/table";
import type { Subarea } from "@entities/department";

export const subareaApi = {
  table: (params: ITDataTableFetchParamsPost) =>
    tableRequest<Subarea>(`/subareas/query`, params),
  list: (filters: { departmentId?: string; includeInactive?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.departmentId) params.set("departmentId", filters.departmentId);
    if (filters.includeInactive) params.set("includeInactive", "true");
    const qs = params.toString();
    return api.get<Subarea[]>(`/subareas${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api.get<Subarea>(`/subareas/${id}`),
  create: (data: { departmentId: string; name: string }) =>
    api.post<Subarea>(`/subareas`, data),
  update: (id: string, data: { name?: string; active?: boolean }) =>
    api.put<Subarea>(`/subareas/${id}`, data),
  remove: (id: string) => api.delete<{ soft: boolean; data: Subarea }>(`/subareas/${id}`),
};
