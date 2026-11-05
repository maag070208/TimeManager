import { api } from "@shared/api/client";
import {
  tableRequest,
  type ITDataTableFetchParamsPost,
} from "@shared/api/table";
import type {
  AuthMe,
  LoginResponse,
  SetPermissionExceptionInput,
  User,
  UserPermissionView,
  UserRole,
} from "../model/types";

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>(`/auth/login`, { username, password }),
  me: () => api.get<AuthMe>(`/auth/me`),
  /** Cambio de la propia contraseña (obligatorio si es provisional). */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>(`/auth/change-password`, { currentPassword, newPassword }),
};

export const usersApi = {
  /** ¿El usuario, correo o número de empleado está libre? (POST para no mandar el dato en la URL). */
  availability: (field: "username" | "email" | "employeeNumber", value: string, exceptId?: string) =>
    api.post<{ available: boolean }>("/users/availability", { field, value, exceptId }),
  table: (params: ITDataTableFetchParamsPost) =>
    tableRequest<User>(`/users/query`, params),
  list: (role?: UserRole) => {
    const qs = role ? `?role=${role}` : "";
    return api.get<User[]>(`/users${qs}`);
  },
  get: (id: string) => api.get<User>(`/users/${id}`),
  employees: (departmentId?: string, q?: string) => {
    const params = new URLSearchParams();
    if (departmentId) params.set("departmentId", departmentId);
    if (q) params.set("q", q);
    const qs = params.toString();
    return api.get<User[]>(`/users/employees${qs ? `?${qs}` : ""}`);
  },
  employeesByRoles: (roles: UserRole[], departmentId?: string, q?: string) => {
    const params = new URLSearchParams();
    if (roles.length) params.set("roles", roles.join(","));
    if (departmentId) params.set("departmentId", departmentId);
    if (q) params.set("q", q);
    const qs = params.toString();
    return api.get<User[]>(`/users/employees${qs ? `?${qs}` : ""}`);
  },
  /** Todas las personas (incluidas las inactivas), para las opciones de filtros de tablas. */
  people: (roles?: UserRole[]) => {
    const params = new URLSearchParams({ includeInactive: "true" });
    if (roles?.length) params.set("roles", roles.join(","));
    return api.get<User[]>(`/users/employees?${params.toString()}`);
  },
  create: (data: {
    username: string;
    email?: string;
    password: string;
    name: string;
    middleName?: string;
    paternalSurname?: string;
    maternalSurname?: string;
    role: UserRole;
    /** Roles adicionales (multi-rol). */
    roles?: UserRole[];
    jobTitle?: string;
    area?: string;
    employeeNumber?: string;
    departmentId?: string;
    subareaId?: string;
  }) => api.post<User>(`/users`, data),
  update: (
    id: string,
    data: {
      username?: string;
      email?: string | null;
      name?: string;
      middleName?: string | null;
      paternalSurname?: string | null;
      maternalSurname?: string | null;
      role?: UserRole;
      /** Roles adicionales (multi-rol). Si viene, reemplaza los actuales. */
      roles?: UserRole[];
      active?: boolean;
      jobTitle?: string;
      area?: string;
      employeeNumber?: string;
      departmentId?: string | null;
      subareaId?: string | null;
    }
  ) => api.put<User>(`/users/${id}`, data),
  changePassword: (id: string, password: string) =>
    api.put<void>(`/users/${id}/password`, { password }),
  import: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{
      created: number;
      skipped: { row: number; username: string; reason: string }[];
    }>(`/users/import`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  delete: (id: string, force?: boolean) =>
    api.delete<{ soft: boolean; forced?: boolean; data: User }>(
      `/users/${id}${force ? "?force=true" : ""}`
    ),
  deactivate: (id: string, body: { reason: string; notifyUser?: boolean }) =>
    api.patch<User>(`/users/${id}/deactivate`, body),
  reactivate: (id: string) => api.patch<User>(`/users/${id}/reactivate`),
  history: (id: string) =>
    api.get<Array<{
      id: string;
      type: string;
      title: string;
      detail: string;
      timestamp: string;
      refId?: string;
    }>>(`/users/${id}/history`),
  /** Excepciones de permiso por empleado (Fase 2). */
  listPermissions: (id: string) =>
    api.get<UserPermissionView[]>(`/users/${id}/permissions`),
  setPermission: (id: string, permission: string, body: SetPermissionExceptionInput) =>
    api.put<UserPermissionView[]>(
      `/users/${id}/permissions/${encodeURIComponent(permission)}`,
      body
    ),
  removePermission: (id: string, permission: string) =>
    api.delete<UserPermissionView[]>(
      `/users/${id}/permissions/${encodeURIComponent(permission)}`
    ),
};