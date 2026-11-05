import { useCallback, useEffect, useState } from "react";
import { permissionApi, type AccessMember } from "@entities/permission";
import { i18n } from "@shared/i18n";
import type { RoleResult } from "./useRolesAdmin";
import { normalizeText } from "./access-levels";

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { message?: string })?.message ?? fallback;

export interface AccessMembersState {
  members: AccessMember[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  reload: () => Promise<void>;
  /** Personas con el rol (principal o adicional). */
  membersOf: (role: string) => AccessMember[];
  addToRole: (role: string, userId: string) => Promise<RoleResult>;
  removeFromRole: (role: string, userId: string) => Promise<RoleResult>;
}

/** Iniciales para el avatar (dos primeras palabras del nombre). */
export const initialsOfName = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

/** Búsqueda por nombre, usuario, número de empleado o departamento. */
export const matchesMember = (member: AccessMember, needle: string): boolean => {
  if (!needle) return true;
  const n = normalizeText(needle);
  return (
    normalizeText(member.name).includes(n) ||
    member.username.toLowerCase().includes(n) ||
    (member.employeeNumber ?? "").includes(n) ||
    normalizeText(member.department ?? "").includes(n)
  );
};

/** Roles de una persona: el principal primero. */
export const memberRoles = (member: AccessMember): string[] => [member.role, ...member.extraRoles];

/**
 * Personas y sus roles (`GET /permissions/members`), con alta y baja de roles
 * adicionales. Cada cambio actualiza la persona en la lista sin recargar todo.
 */
export const useAccessMembers = (onRolesChanged?: () => void): AccessMembersState => {
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setMembers(await permissionApi.listMembers());
    } catch (err) {
      setError(errorMessage(err, i18n.t("roles:errors.members")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const membersOf = useCallback(
    (role: string) => members.filter((member) => memberRoles(member).includes(role)),
    [members]
  );

  const run = useCallback(
    async (action: () => Promise<AccessMember>, fallback: string): Promise<RoleResult> => {
      setBusy(true);
      try {
        const updated = await action();
        setMembers((previous) => previous.map((member) => (member.id === updated.id ? updated : member)));
        onRolesChanged?.();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err, fallback) };
      } finally {
        setBusy(false);
      }
    },
    [onRolesChanged]
  );

  const addToRole = useCallback(
    (role: string, userId: string) =>
      run(() => permissionApi.addRoleMember(role, userId), i18n.t("roles:errors.addMember")),
    [run]
  );

  const removeFromRole = useCallback(
    (role: string, userId: string) =>
      run(() => permissionApi.removeRoleMember(role, userId), i18n.t("roles:errors.removeMember")),
    [run]
  );

  return { members, loading, error, busy, reload, membersOf, addToRole, removeFromRole };
};
