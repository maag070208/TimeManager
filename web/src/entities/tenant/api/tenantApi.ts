import { api } from "@shared/api/client";
import type {
  Tenant,
  TenantCreateInput,
  TenantCreated,
  TenantPayment,
  TenantPaymentStatus,
  TenantPayments,
  TenantUpdateInput,
} from "../model/types";

export const tenantApi = {
  list: () => api.get<Tenant[]>("/tenants"),
  get: (id: string) => api.get<Tenant>(`/tenants/${id}`),
  payments: (id: string) => api.get<TenantPayments>(`/tenants/${id}/payments`),
  createPayment: (id: string, input: { concept: string; period: string; amount: number; dueDate: string; notes?: string }) =>
    api.post<TenantPayment>(`/tenants/${id}/payments`, input),
  updatePayment: (id: string, paymentId: string, input: { status?: TenantPaymentStatus; paidAt?: string | null; notes?: string | null }) =>
    api.patch<TenantPayment>(`/tenants/${id}/payments/${paymentId}`, input),
  create: (input: TenantCreateInput) => api.post<TenantCreated>("/tenants", input),
  update: (id: string, input: TenantUpdateInput) => api.patch<Tenant>(`/tenants/${id}`, input),
  /** "Entrar como cliente" (F3-03): deja el evento de auditoría antes de operar. */
  impersonate: (id: string) => api.post<Tenant>(`/tenants/${id}/impersonate`),
};
