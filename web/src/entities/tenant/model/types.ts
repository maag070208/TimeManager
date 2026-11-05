export type TenantStatus = "ACTIVE" | "SUSPENDED";

/** Cliente tal como lo resume la sesión (`GET /auth/me`). */
export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  timezone: string;
}

/** Cliente de la plataforma (`GET /tenants`, solo ADMIN/SUPPORT). */
export interface Tenant extends TenantInfo {
  status: TenantStatus;
  plan: string | null;
  employeeLimit: number | null;
  createdAt: string;
  updatedAt: string;
  usage: { activeUsers: number };
}

export interface TenantCreateInput {
  name: string;
  slug: string;
  timezone?: string;
  plan?: string | null;
  employeeLimit?: number | null;
  admin: { name: string; username: string; email?: string | null; password?: string };
}

export interface TenantCreated {
  tenant: Tenant;
  admin: { id: string; username: string };
  temporaryPassword?: string;
  /** Correo al que se encoló la bienvenida; `null` si el administrador no tiene correo. */
  welcomeEmail: string | null;
  catalogs: { removalCategories: number; documentTypes: number };
}

export type TenantUpdateInput = Partial<Pick<Tenant, "name" | "status" | "timezone" | "plan" | "employeeLimit">>;
