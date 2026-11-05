import { api } from "@shared/api/client";
import {
  tableRequest,
  type ITDataTableFetchParamsPost,
} from "@shared/api/table";
import type { Department } from "../model/types";

export const departmentsApi = {
  table: (params: ITDataTableFetchParamsPost) =>
    tableRequest<Department>(`/departments/query`, params),
  list: (includeInactive = false) =>
    api.get<Department[]>(`/departments${includeInactive ? "?includeInactive=true" : ""}`),
  get: (id: string) => api.get<Department>(`/departments/${id}`),
  create: (data: { name: string }) =>
    api.post<Department>(`/departments`, data),
  update: (id: string, data: { name?: string; active?: boolean }) =>
    api.put<Department>(`/departments/${id}`, data),
  remove: (id: string) => api.delete<{ soft: boolean; data: Department }>(`/departments/${id}`),
};