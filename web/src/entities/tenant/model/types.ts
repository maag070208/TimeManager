import type { Plan } from "@entities/plan";

export type TenantStatus = "ACTIVE" | "SUSPENDED";

/** Cliente tal como lo resume la sesión (`GET /auth/me`). */
export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  /** Branding (F3-05). `null` = marca TimeManager. */
  brandColor?: string | null;
  /** Logo del cliente como data URL. */
  logoDataUrl?: string | null;
}

/** Ficha del cliente resumida por el plan contratado. */
export type TenantPlan = Pick<
  Plan,
  "id" | "key" | "name" | "employeeLimit" | "clockLimit" | "monthlyPrice" | "active"
>;

/** Cliente de la plataforma (`GET /tenants`, solo ADMIN/SUPPORT). */
export interface Tenant extends TenantInfo {
  status: TenantStatus;
  emailFrom: string | null;
  planId: string | null;
  plan: TenantPlan | null;
  employeeLimit: number | null;
  /** Límites efectivos: plan + override del cliente. */
  limits: { people: number | null; clocks: number | null };
  createdAt: string;
  updatedAt: string;
  usage: { activeUsers: number; clocks: number };
}

export interface TenantCreateInput {
  name: string;
  slug: string;
  timezone?: string;
  planId?: string | null;
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

export type TenantUpdateInput = Partial<
  Pick<Tenant, "name" | "status" | "timezone" | "planId" | "employeeLimit">
>;
