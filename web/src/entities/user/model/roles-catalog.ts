import { useSyncExternalStore } from "react";
import { i18n } from "@shared/i18n";

/**
 * Cache en memoria del catálogo de roles (`GET /permissions/roles`). La llena
 * `PrivateRoutes` al iniciar sesión; `roleLabel` y `roleOptions` la consultan.
 * Si aún no está cargada, `roleLabel` cae a la etiqueta i18n de los roles base
 * o, en última instancia, a la clave del rol.
 */
export interface RoleOption {
  key: string;
  name: string;
  description: string | null;
  module: string | null;
  staff: boolean;
  system: boolean;
  active: boolean;
  sortOrder: number;
  userCount?: number;
}

let catalog: RoleOption[] = [];
const listeners = new Set<() => void>();

export const setRolesCatalog = (roles: RoleOption[]): void => {
  catalog = roles;
  for (const listener of listeners) listener();
};

export const getRolesCatalog = (): RoleOption[] => catalog;

/** Suscripción al catálogo (para `useSyncExternalStore`). Devuelve el unsubscribe. */
export const subscribeRoles = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Catálogo reactivo: los componentes se vuelven a pintar cuando llega/cambia. */
export const useRolesCatalog = (): RoleOption[] =>
  useSyncExternalStore(subscribeRoles, getRolesCatalog, getRolesCatalog);

export const roleOf = (key: string): RoleOption | undefined =>
  catalog.find((role) => role.key === key);

/** Etiqueta visible de un rol: nombre del catálogo, i18n base o la clave. */
export const roleLabel = (role: string): string =>
  roleOf(role)?.name ?? i18n.t(`roles:role.${role}`, { defaultValue: role });

/** ¿El rol lleva expediente de personal? (checador, nómina, horas extra). */
export const isStaffRole = (role: string): boolean => roleOf(role)?.staff ?? false;

/** Opciones para selectores y filtros de tablas. */
export const roleOptions = (
  { activeOnly = true, staffOnly = false }: { activeOnly?: boolean; staffOnly?: boolean } = {}
): Array<{ id: string; name: string }> =>
  catalog
    .filter((role) => (!activeOnly || role.active) && (!staffOnly || role.staff))
    .map((role) => ({ id: role.key, name: role.name }));
