import type { PermissionScope } from "./catalog";
import type { UserPermissions } from "./resolver";

/**
 * Registro sobre el que se evalúa un alcance. Reutiliza la semántica de
 * `ticketAccessWhere`/`assertTicketAccess` de `tickets/services/ticket.service.ts`
 * (ver ROLES_Y_PERMISOS.md §2).
 */
export interface ResourceReachable {
  createdById?: string | null;
  assignedToId?: string | null;
  departmentId?: string | null;
  assignments?: Array<{ userId: string }>;
}

/** Lo "propio": lo creó, es su responsable o tiene una tarea en él. */
const isOwn = (user: UserPermissions, resource: ResourceReachable): boolean =>
  resource.createdById === user.id ||
  resource.assignedToId === user.id ||
  !!resource.assignments?.some((a) => a.userId === user.id);

/**
 * ¿El registro cae dentro del alcance? `AREA` incluye lo propio y, sin
 * departamento asignado, se comporta como `PROPIO` (§2).
 */
export const withinScope = (
  user: UserPermissions,
  scope: PermissionScope,
  resource: ResourceReachable
): boolean => {
  switch (scope) {
    case "NONE":
      return false;
    case "ALL":
      return true;
    case "OWN":
      return isOwn(user, resource);
    case "AREA":
      return (
        isOwn(user, resource) ||
        (!!user.departmentId && resource.departmentId === user.departmentId)
      );
  }
};

