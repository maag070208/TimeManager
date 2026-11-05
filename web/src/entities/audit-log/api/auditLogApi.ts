import { api } from "@shared/api/client";
import type { AuditLog, AuditLogListResult } from "../model/types";

export const auditApi = {
  list: (params?: {
    action?: string;
    entityType?: string;
    userId?: string;
    deviceId?: string;
    start?: string;
    end?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set("action", params.action);
    if (params?.entityType) searchParams.set("entityType", params.entityType);
    if (params?.userId) searchParams.set("userId", params.userId);
    if (params?.deviceId) searchParams.set("deviceId", params.deviceId);
    if (params?.start) searchParams.set("start", params.start);
    if (params?.end) searchParams.set("end", params.end);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return api.get<AuditLogListResult>(`/audit${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api.get<AuditLog>(`/audit/${id}`),
};