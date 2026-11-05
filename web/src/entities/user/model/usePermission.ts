import { useSelector } from "react-redux";
import type { PermissionScope, Permission } from "./types";

/**
 * Forma mínima del estado que necesita el hook. Se declara aquí en vez de
 * importar `RootState` de `@app/store` porque los `entities` no pueden depender
 * de `app` (regla FSD en `eslint.config.js`).
 */
interface AuthStateLike {
  auth: { user: { role?: string; permissions?: Partial<Record<Permission, PermissionScope>> } | null };
}

const NO_PERMISSIONS: Partial<Record<Permission, PermissionScope>> = {};

/** Mapa completo de permisos de la sesión (para decidir sobre varios a la vez). */
export const usePermissions = (): Partial<Record<Permission, PermissionScope>> =>
  useSelector((state: AuthStateLike) => state.auth.user?.permissions ?? NO_PERMISSIONS);

/** Rol de la sesión (solo para elegir el acomodo del tablero; los accesos los deciden los permisos). */
export const useCurrentRole = (): string | null => useSelector((state: AuthStateLike) => state.auth.user?.role ?? null);

/** Alcance efectivo del permiso para la sesión actual (NINGUNO si no aplica). */
export const usePermission = (permission: Permission): PermissionScope =>
  useSelector(
    (state: AuthStateLike) => state.auth.user?.permissions?.[permission] ?? "NONE"
  );

/** ¿La sesión actual tiene el permiso con cualquier alcance? */
export const useCan = (permission: Permission): boolean => usePermission(permission) !== "NONE";

/** Helper puro para decidir sobre un mapa de permisos ya cargado. */
export const can = (
  permissions: Partial<Record<Permission, PermissionScope>> | undefined,
  permission: Permission
): boolean => (permissions?.[permission] ?? "NONE") !== "NONE";
