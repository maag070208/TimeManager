export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  userName?: string | null;
  deviceId?: string | null;
  deviceCode?: string | null;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface AuditLogListResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}