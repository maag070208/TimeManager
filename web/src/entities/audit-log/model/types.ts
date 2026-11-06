export interface AuditLog {
  id: string;
  tenantId?: string | null;
  module?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  userName?: string | null;
  permissions?: Record<string, any> | null;
  roles?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
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