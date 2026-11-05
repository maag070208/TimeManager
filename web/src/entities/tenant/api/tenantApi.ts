import { api } from "@shared/api/client";
import type { Tenant, TenantCreateInput, TenantCreated, TenantUpdateInput } from "../model/types";

export const tenantApi = {
  list: () => api.get<Tenant[]>("/tenants"),
  create: (input: TenantCreateInput) => api.post<TenantCreated>("/tenants", input),
  update: (id: string, input: TenantUpdateInput) => api.patch<Tenant>(`/tenants/${id}`, input),
  /** "Entrar como cliente" (F3-03): deja el evento de auditoría antes de operar. */
  impersonate: (id: string) => api.post<Tenant>(`/tenants/${id}/impersonate`),
};
