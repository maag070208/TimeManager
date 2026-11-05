import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  permissionApi,
  type CatalogCreateDto,
  type CatalogUpdateDto,
  type MatrixChange,
  type PermissionCatalog,
  type RoleAdmin,
  type RoleCreateDto,
  type RoleUpdateDto,
  type RolesAdminData,
} from "@entities/permission";
import { setRolesCatalog, type PermissionScope } from "@entities/user";
import { i18n } from "@shared/i18n";
import { grantableScopes, permissionVerb } from "./access-levels";

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { message?: string })?.message ?? fallback;

const cellKey = (role: string, permission: string): string => `${permission}|${role}`;

/**
 * Alcance por defecto cuando se marca desde "no" un permiso con alcance de
 * datos. Se eligió el **mínimo útil** para no ampliar accesos sin querer: los
 * tickets/tareas arrancan en Propio y la bitácora/checador/horas extra en Área.
 * El usuario puede cambiarlo desde el modal "cambiar alcance".
 */
export const DEFAULT_SCOPE: Record<string, PermissionScope> = {
  "tickets.view": "OWN",
  "tickets.edit": "OWN",
  "tickets.close": "OWN",
  "tasks.view": "OWN",
  "tasks.assign": "OWN",
  "tasks.complete": "OWN",
  "access.log": "AREA",
  "time_clock.view": "AREA",
  "overtime.view": "AREA",
  "overtime.approve": "AREA",
  "users.permissions": "AREA",
};

/** Celda que no se puede quitar: el ADMIN conserva siempre la administración de roles. */
export const isLockedCell = (role: string, permission: string): boolean =>
  role === "ADMIN" && permission === "roles.manage";

/** Modo de las acciones masivas por módulo. */
export type BulkMode = "all" | "read" | "none";

/** Resultado de una operación sobre roles (el mensaje ya viene traducido por la API). */
export interface RoleResult {
  ok: boolean;
  error?: string;
}

/** Un cambio pendiente con su valor anterior (para la revisión antes de guardar). */
export interface MatrixChangeDetail extends MatrixChange {
  from: PermissionScope;
}

/** Alcance que se aplica al marcar un permiso desde "no". */
export const defaultScopeFor = (
  permission: string,
  catalog: readonly PermissionCatalog[]
): PermissionScope => {
  const definition = catalog.find((item) => item.key === permission);
  const predefined = DEFAULT_SCOPE[permission];
  if (predefined && (!definition || definition.scopes.includes(predefined))) {
    return predefined;
  }
  if (!definition) return predefined ?? "ALL";
  if (definition.scopes.includes("ALL")) return "ALL";
  return definition.scopes[0] ?? "NONE";
};

const toBaseline = (data: RolesAdminData): Record<string, PermissionScope> => {
  const base: Record<string, PermissionScope> = {};
  for (const cell of data.matrix) {
    base[cellKey(cell.role, cell.permission)] = cell.scope;
  }
  return base;
};

export interface RolesAdminState {
  data: RolesAdminData | null;
  /** Metadatos de cada rol (nombre, `staff`, sistema, activo, cuentas). */
  rolesMeta: RoleAdmin[];
  /** Alcance en edición por celda (`permiso|rol`). */
  draft: Record<string, PermissionScope>;
  /** Permisos en edición agrupados por rol (solo los ≠ NONE). */
  permissionsByRole: Record<string, Partial<Record<string, PermissionScope>>>;
  /** Cambios pendientes respecto a lo persistido. */
  changes: MatrixChange[];
  /** Los mismos cambios con su valor anterior. */
  changeDetails: MatrixChangeDetail[];
  /** Alcance en el borrador. */
  scopeOf: (role: string, permission: string) => PermissionScope;
  /** Alcance guardado (antes de los cambios del borrador). */
  savedScopeOf: (role: string, permission: string) => PermissionScope;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  /** Alta/edición/borrado de roles. */
  roleSaving: boolean;
  roleError: string | null;
  clearRoleError: () => void;
  createRole: (dto: RoleCreateDto) => Promise<RoleResult>;
  updateRole: (key: string, dto: RoleUpdateDto) => Promise<RoleResult>;
  deleteRole: (key: string) => Promise<RoleResult>;
  setScope: (role: string, permission: string, scope: PermissionScope) => void;
  /** Marca/desmarca una celda (sí/no). Al marcar aplica el alcance por defecto. */
  toggle: (role: string, permission: string) => void;
  /** Concede todo / solo lectura / nada de un grupo de permisos a un rol. */
  setMany: (role: string, permissions: readonly PermissionCatalog[], mode: BulkMode) => void;
  save: () => Promise<boolean>;
  reload: (options?: { keepDraft?: boolean }) => Promise<void>;
  /** Recarga solo los metadatos de los roles (conteos), sin tocar el borrador. */
  refreshRoles: () => Promise<void>;
  discard: () => void;
}

/**
 * Administración de la matriz rol → permiso → alcance y de los propios roles.
 * Carga `GET /permissions/admin` (matriz) y `GET /permissions/roles`
 * (metadatos), mantiene un borrador local de las celdas y expone el diff
 * contra lo persistido. Los permisos inactivos no se pueden conceder.
 */
export const useRolesAdmin = (): RolesAdminState => {
  const [data, setData] = useState<RolesAdminData | null>(null);
  const [rolesMeta, setRolesMeta] = useState<RoleAdmin[]>([]);
  const [baseline, setBaseline] = useState<Record<string, PermissionScope>>({});
  const [draft, setDraft] = useState<Record<string, PermissionScope>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [roleSaving, setRoleSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Copias para recargar sin cerrar sobre estado viejo.
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const loadedRef = useRef(false);

  /**
   * Recarga matriz y roles. Con `keepDraft` conserva los cambios pendientes
   * (p. ej. al crear o editar un rol con la matriz a medio editar); sin él, el
   * borrador vuelve a lo guardado. El indicador de carga solo se muestra la
   * primera vez.
   */
  const reload = useCallback(async (options?: { keepDraft?: boolean }) => {
    if (!loadedRef.current) setLoading(true);
    setError(null);
    try {
      const [result, roles] = await Promise.all([
        permissionApi.getAdmin(),
        permissionApi.listRoles(),
      ]);
      const base = toBaseline(result);
      const previousBase = baselineRef.current;
      setData(result);
      setBaseline(base);
      setDraft((previous) => {
        if (!options?.keepDraft) return { ...base };
        const next = { ...base };
        for (const [key, scope] of Object.entries(previous)) {
          const role = key.slice(key.indexOf("|") + 1);
          if (scope !== (previousBase[key] ?? "NONE") && result.roles.includes(role)) next[key] = scope;
        }
        return next;
      });
      setRolesMeta(roles);
      setRolesCatalog(roles);
      loadedRef.current = true;
    } catch (err) {
      setError(errorMessage(err, i18n.t("roles:errors.load")));
      if (!loadedRef.current) setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setScope = useCallback(
    (role: string, permission: string, scope: PermissionScope) => {
      setDraft((prev) => ({ ...prev, [cellKey(role, permission)]: scope }));
    },
    []
  );

  const scopeOf = useCallback(
    (role: string, permission: string): PermissionScope => draft[cellKey(role, permission)] ?? "NONE",
    [draft]
  );

  const savedScopeOf = useCallback(
    (role: string, permission: string): PermissionScope => baseline[cellKey(role, permission)] ?? "NONE",
    [baseline]
  );

  const setMany = useCallback(
    (role: string, permissions: readonly PermissionCatalog[], mode: BulkMode) => {
      const catalog = data?.catalog ?? [];
      setDraft((prev) => {
        const next = { ...prev };
        for (const permission of permissions) {
          if (!permission.active || isLockedCell(role, permission.key)) continue;
          const key = cellKey(role, permission.key);
          const current = prev[key] ?? "NONE";
          const wanted = mode === "all" || (mode === "read" && permissionVerb(permission.key) === "view");
          if (!wanted) {
            next[key] = "NONE";
          } else if (current === "NONE" || !grantableScopes(permission).includes(current)) {
            // Lo ya concedido conserva su alcance; lo nuevo entra con el alcance prudente.
            next[key] = defaultScopeFor(permission.key, catalog);
          }
        }
        return next;
      });
    },
    [data]
  );

  const toggle = useCallback(
    (role: string, permission: string) => {
      if (isLockedCell(role, permission)) return;
      setDraft((prev) => {
        const key = cellKey(role, permission);
        const current = prev[key] ?? "NONE";
        const next =
          current === "NONE"
            ? defaultScopeFor(permission, data?.catalog ?? [])
            : "NONE";
        return { ...prev, [key]: next };
      });
    },
    [data]
  );

  /** Mapa rol → { permiso: alcance } con los permisos ≠ NONE del borrador. */
  const permissionsByRole = useMemo<
    Record<string, Partial<Record<string, PermissionScope>>>
  >(() => {
    if (!data) return {};
    const map: Record<string, Partial<Record<string, PermissionScope>>> = {};
    for (const role of data.roles) map[role] = {};
    for (const permission of data.catalog) {
      for (const role of data.roles) {
        const scope = draft[cellKey(role, permission.key)] ?? "NONE";
        if (scope !== "NONE") map[role][permission.key] = scope;
      }
    }
    return map;
  }, [data, draft]);

  const discard = useCallback(() => {
    setDraft({ ...baseline });
    setSaveError(null);
  }, [baseline]);

  const changeDetails = useMemo<MatrixChangeDetail[]>(() => {
    if (!data) return [];
    const out: MatrixChangeDetail[] = [];
    for (const role of data.roles) {
      for (const permission of data.catalog) {
        const key = cellKey(role, permission.key);
        const current = draft[key] ?? "NONE";
        const original = baseline[key] ?? "NONE";
        if (current !== original) {
          out.push({ role, permission: permission.key, scope: current, from: original });
        }
      }
    }
    return out;
  }, [data, draft, baseline]);

  const changes = useMemo<MatrixChange[]>(
    () => changeDetails.map(({ role, permission, scope }) => ({ role, permission, scope })),
    [changeDetails]
  );

  const refreshRoles = useCallback(async () => {
    try {
      const roles = await permissionApi.listRoles();
      setRolesMeta(roles);
      setRolesCatalog(roles);
    } catch {
      // Solo son conteos: si falla, se conservan los anteriores.
    }
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (changes.length === 0) return false;
    setSaving(true);
    setSaveError(null);
    try {
      await permissionApi.saveMatrix(changes);
      // Recarga matriz y roles; el borrador queda igual a lo guardado.
      await reload();
      return true;
    } catch (err) {
      setSaveError(errorMessage(err, i18n.t("roles:errors.saveMatrix")));
      return false;
    } finally {
      setSaving(false);
    }
  }, [changes, reload]);

  const runRole = useCallback(
    async (action: () => Promise<unknown>, fallback: string): Promise<RoleResult> => {
      setRoleSaving(true);
      setRoleError(null);
      try {
        await action();
        await reload({ keepDraft: true });
        return { ok: true };
      } catch (err) {
        const error = errorMessage(err, fallback);
        setRoleError(error);
        return { ok: false, error };
      } finally {
        setRoleSaving(false);
      }
    },
    [reload]
  );

  const createRole = useCallback(
    (dto: RoleCreateDto) =>
      runRole(() => permissionApi.createRole(dto), i18n.t("roles:errors.createRole")),
    [runRole]
  );

  const updateRole = useCallback(
    (key: string, dto: RoleUpdateDto) =>
      runRole(() => permissionApi.updateRole(key, dto), i18n.t("roles:errors.updateRole")),
    [runRole]
  );

  const deleteRole = useCallback(
    (key: string) =>
      runRole(() => permissionApi.deleteRole(key), i18n.t("roles:errors.deleteRole")),
    [runRole]
  );

  const clearRoleError = useCallback(() => setRoleError(null), []);

  return {
    data,
    rolesMeta,
    draft,
    permissionsByRole,
    changes,
    changeDetails,
    scopeOf,
    savedScopeOf,
    dirty: changes.length > 0,
    loading,
    saving,
    error,
    saveError,
    roleSaving,
    roleError,
    clearRoleError,
    createRole,
    updateRole,
    deleteRole,
    setScope,
    toggle,
    setMany,
    save,
    reload,
    refreshRoles,
    discard,
  };
};

export interface CatalogAdminState {
  list: () => Promise<PermissionCatalog[]>;
  reloadKey: number;
  reload: () => void;
  create: (dto: CatalogCreateDto) => Promise<PermissionCatalog>;
  update: (key: string, dto: CatalogUpdateDto) => Promise<PermissionCatalog>;
  toggleActive: (permission: PermissionCatalog) => Promise<PermissionCatalog>;
  saving: boolean;
  error: string | null;
  setError: (message: string | null) => void;
}

/**
 * Alta/edición y activación del catálogo de permisos. El listado se lee vía
 * `GET /permisos/admin` (incluye inactivos) y cada mutación recarga la tabla.
 */
export const usePermissionCatalog = (): CatalogAdminState => {
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const list = useCallback(
    async (): Promise<PermissionCatalog[]> => {
      const result = await permissionApi.getAdmin();
      return result.catalog;
    },
    []
  );

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const run = useCallback(
    async <T>(action: () => Promise<T>, fallback: string): Promise<T> => {
      setSaving(true);
      setError(null);
      try {
        const result = await action();
        reload();
        return result;
      } catch (err) {
        setError(errorMessage(err, fallback));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [reload]
  );

  const create = useCallback(
    (dto: CatalogCreateDto) =>
      run(() => permissionApi.createCatalog(dto), i18n.t("roles:errors.create")),
    [run]
  );

  const update = useCallback(
    (key: string, dto: CatalogUpdateDto) =>
      run(
        () => permissionApi.updateCatalog(key, dto),
        i18n.t("roles:errors.update")
      ),
    [run]
  );

  const toggleActive = useCallback(
    (permission: PermissionCatalog) =>
      run(
        () => permissionApi.updateCatalog(permission.key, { active: !permission.active }),
        i18n.t("roles:errors.toggle")
      ),
    [run]
  );

  return { list, reloadKey, reload, create, update, toggleActive, saving, error, setError };
};
