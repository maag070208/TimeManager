import type { AppLanguage } from "@shared/i18n/config";

/** Clave del rol (dinámico, tabla `roles` de la API). Antes era un union fijo. */
export type UserRole = string;

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: UserRole;
  /** Foto del expediente (ruta relativa a la base del API); `null` si no tiene. */
  photoUrl?: string | null;
  /** Roles efectivos: principal + adicionales (`GET /auth/me` y login). */
  roles?: UserRole[];
  departmentId?: string | null;
  /** Contraseña provisional: la app obliga a cambiarla antes de dejar entrar. */
  mustChangePassword?: boolean;
  /**
   * Permisos efectivos del usuario (`GET /auth/me`): clave → alcance, solo los
   * distintos de NONE. Opcional porque las sesiones persistidas antes del
   * rollout de permisos no lo traen y `PrivateRoutes` las rehidrata.
   */
  permissions?: Partial<Record<Permission, PermissionScope>>;
  /** Idioma del sistema (`GET /auth/me`); opcional por la misma razón. */
  language?: AppLanguage;
}

/** Alcance efectivo de un permiso (ver ROLES_Y_PERMISOS.md §2). */
export type PermissionScope = "NONE" | "OWN" | "AREA" | "ALL";

/** Excepción de permiso por empleado (Fase 2), tal como la devuelve el API. */
export interface UserPermissionView {
  permission: string;
  module: string;
  name: string;
  scopes: PermissionScope[];
  sensitive: boolean;
  roleScope: PermissionScope;
  effective: PermissionScope;
  exception: {
    scope: PermissionScope;
    reason: string | null;
    expiresAt: string | null;
    grantedById: string | null;
  } | null;
}

export interface SetPermissionExceptionInput {
  scope: PermissionScope;
  reason?: string;
  expiresAt?: string | null;
}

/**
 * Clave del catálogo dinámico de permisos del API (`GET /permissions/catalog`).
 * Antes era un union hardcodeado; ahora el catálogo vive en la BD y puede
 * crecer sin recompilar la web, así que la clave se tipa como string libre.
 */
export type Permission = string;

/** `GET /auth/me`: el usuario de la sesión con los datos de su credencial. */
export interface AuthMe extends AuthUser {
  employeeNumber: string | null;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  photoUrl: string | null;
  permissions: Partial<Record<Permission, PermissionScope>>;
  /** Idioma del sistema (`sys_config.LANGUAGE`): la interfaz lo adopta. */
  language: AppLanguage;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: AuthUser;
}

export interface User extends AuthUser {
  active: boolean;
  /** Roles adicionales (multi-rol). El principal está en `role`. */
  extraRoles?: Array<{ role: string }>;
  middleName?: string | null;
  paternalSurname?: string | null;
  maternalSurname?: string | null;
  jobTitle?: string;
  area?: string;
  employeeNumber?: string;
  company?: string | null;
  /** Primer nombre crudo; `name` ya viene compuesto con los apellidos. */
  firstName?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  subareaId?: string | null;
  subarea?: { id: string; name: string } | null;
}