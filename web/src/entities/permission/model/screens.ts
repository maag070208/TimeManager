import type { Permission, PermissionScope, UserRole } from "@entities/user";

/**
 * Catálogo de pantallas de la app, en el mismo orden que el menú lateral.
 *
 * Es la **fuente única** de verdad: lo consumen `app/guards/PrivateRoutes.tsx`
 * (para armar el menú) y la pestaña "Qué ve cada rol" de `/roles` (para la
 * matriz de visibilidad). Si agregás una pantalla al menú, agregala aquí y
 * ambos lugares la respetan.
 *
 * Cada entrada requiere uno o más permisos (`requirement`) o una regla fija de
 * negocio (`fixedRole`, p. ej. "Mis Tareas" solo para EMPLEADO). Un grupo
 * (con `children`) es visible si lo es al menos uno de sus hijos. Dentro de un
 * grupo, un hijo con `children` es una **sección**: el menú la muestra como
 * encabezado de subítems (ITSidebar no tiene tercer nivel) y no navega.
 */

/** Requisito de visibilidad: cualquiera (`anyOf`) o todas (`allOf`) las claves. */
export type ScreenRequirement =
  | { readonly anyOf: readonly Permission[] }
  | { readonly allOf: readonly Permission[] };

/** Claves del menú en el namespace `common` (para tipar la i18n). */
export type NavLabelKey =
  | "nav.home"
  | "nav.accessTimeClock"
  | "nav.accessTimeClockReport"
  | "nav.accessTimeClockEmployees"
  | "nav.clockDashboard"
  | "nav.clockAttendance"
  | "nav.timeClock"
  | "nav.schedules"
  | "nav.schedulesAdmin"
  | "nav.schedulesAssign"
  | "nav.overtime"
  | "nav.hr"
  | "nav.employees"
  | "nav.hrReports"
  | "nav.employeeRecords"
  | "nav.settings"
  | "nav.catalogs"
  | "nav.users"
  | "nav.clocks"
  | "nav.payroll"
  | "nav.roles";

export interface AppScreen {
  readonly id: string;
  /** Clave i18n en el namespace `common` (p. ej. `nav.employees`). */
  readonly labelKey: NavLabelKey;
  /** Ruta a la que navega el ítem del menú. */
  readonly path?: string;
  /** Modo de resaltado de la ruta. Por defecto `prefix`. */
  readonly match?: "exact" | "prefix";
  /** Rutas hijas que no deben resaltar este ítem (aunque empiecen igual). */
  readonly excludes?: readonly string[];
  /** Permiso(s) requeridos. Ausente = visible para cualquier sesión. */
  readonly requirement?: ScreenRequirement;
  /** Regla fija: solo este rol la ve, sin importar permisos. */
  readonly fixedRole?: UserRole;
  /**
   * Permisos de las acciones de la pantalla (botones). Si se omite, se derivan
   * del catálogo: los demás permisos del mismo recurso que el requisito
   * (`devices.view` → `devices.create/edit/delete`). Se declaran solo cuando la
   * pantalla usa permisos de otro recurso o no tiene requisito.
   */
  readonly actions?: readonly Permission[];
  readonly children?: readonly AppScreen[];
}

/** Catálogo completo, apagados incluidos (el menú usa `APP_SCREENS`). */
const ALL_SCREENS: readonly AppScreen[] = [
  {
    id: "start",
    labelKey: "nav.home",
    path: "/",
    match: "exact",
  },
  {
    id: "hr",
    labelKey: "nav.hr",
    children: [
      { id: "employees", labelKey: "nav.employees", path: "/employees", excludes: ["/employees/disciplinary-reports", "/employees/records"], requirement: { anyOf: ["hr.records", "users.view"] }, actions: ["users.create", "users.edit", "users.delete"] },
      { id: "employeeRecords", labelKey: "nav.employeeRecords", path: "/employees/records", requirement: { anyOf: ["hr.records"] }, actions: [] },
      { id: "hrReports", labelKey: "nav.hrReports", path: "/employees/disciplinary-reports", requirement: { anyOf: ["hr.records"] }, actions: ["hr.disciplinary_reports"] },
      {
        id: "clockAttendance",
        labelKey: "nav.clockAttendance",
        children: [
          { id: "accessTimeClockReport", labelKey: "nav.accessTimeClockReport", path: "/hr/time-clock/entries-exits", requirement: { anyOf: ["time_clock.view"] }, actions: [] },
        ],
      },
      {
        id: "schedules",
        labelKey: "nav.schedules",
        children: [
          { id: "schedulesAdmin", labelKey: "nav.schedulesAdmin", path: "/schedules", match: "exact", requirement: { anyOf: ["schedules.view"] } },
          { id: "schedulesAssign", labelKey: "nav.schedulesAssign", path: "/schedules/assign", requirement: { anyOf: ["schedules.view"] } },
          { id: "overtime", labelKey: "nav.overtime", path: "/schedules/overtime/approval", requirement: { anyOf: ["overtime.view"] } },
          { id: "payroll", labelKey: "nav.payroll", path: "/schedules/payroll", requirement: { anyOf: ["payroll.view"] } },
        ],
      },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    children: [
      // Todo lo del checador, junto y con su título.
      {
        id: "timeClock",
        labelKey: "nav.timeClock",
        children: [
          { id: "clockDashboard", labelKey: "nav.clockDashboard", path: "/time-clocks/dashboard", match: "exact", requirement: { anyOf: ["time_clocks.manage"] } },
        ],
      },
      { id: "roles", labelKey: "nav.roles", path: "/roles", requirement: { anyOf: ["roles.manage"] } },
    ],
  },
];

/** Menú y resúmenes de pantallas (menú, resumen por rol y consola de roles). */
export const APP_SCREENS: readonly AppScreen[] = ALL_SCREENS;

/** Mapa clave → alcance tal como lo entrega `/auth/me` (solo los ≠ NONE). */
export type PermissionMap = Partial<Record<Permission, PermissionScope>>;

/** ¿La sesión tiene la clave con cualquier alcance distinto de NONE? */
export const screenHasPermission = (
  permissions: PermissionMap | undefined,
  permission: Permission
): boolean => (permissions?.[permission] ?? "NONE") !== "NONE";

/** Alcance efectivo de una clave para la sesión (NONE si no aplica). */
export const screenScopeOf = (
  permissions: PermissionMap | undefined,
  permission: Permission
): PermissionScope => permissions?.[permission] ?? "NONE";

/**
 * ¿La pantalla es visible para un mapa de permisos y un rol? Respeta el
 * requisito (anyOf/allOf), la regla fija (`fixedRole`) y, en grupos, la
 * visibilidad de sus hijos.
 */
export const isScreenVisible = (
  permissions: PermissionMap | undefined,
  screen: AppScreen,
  role?: string
): boolean => {
  if (screen.fixedRole) return role === screen.fixedRole;
  if (screen.requirement) {
    if ("allOf" in screen.requirement) {
      return screen.requirement.allOf.every((key) => screenHasPermission(permissions, key));
    }
    return screen.requirement.anyOf.some((key) => screenHasPermission(permissions, key));
  }
  if (screen.children?.length) {
    return screen.children.some((child) => isScreenVisible(permissions, child, role));
  }
  return true;
};

/**
 * Visibilidad efectiva de una pantalla **dentro** de su grupo: el grupo debe ser
 * visible y la pantalla también (en el menú real, un hijo oculto por su padre no
 * se muestra aunque tenga el permiso).
 */
export const isScreenVisibleInGroup = (
  permissions: PermissionMap | undefined,
  screen: AppScreen,
  parent: AppScreen | undefined,
  role?: string
): boolean => {
  if (parent && !isScreenVisible(permissions, parent, role)) return false;
  return isScreenVisible(permissions, screen, role);
};

/** Una pantalla "hoja" (sin hijos) con su grupo, para resúmenes y chips. */
export interface ScreenLeaf {
  readonly screen: AppScreen;
  readonly parent?: AppScreen;
}

/** Pantallas hoja del catálogo (en orden), con su grupo si lo tienen. */
export const screenLeaves = (): ScreenLeaf[] => {
  const out: ScreenLeaf[] = [];
  const walk = (screens: readonly AppScreen[], parent?: AppScreen): void => {
    for (const screen of screens) {
      // Una sección hereda el grupo de primer nivel: solo agrupa en el menú.
      if (screen.children?.length) walk(screen.children, parent ?? screen);
      else out.push({ screen, parent });
    }
  };
  walk(APP_SCREENS);
  return out;
};

/** Claves de permiso mencionadas por cualquier pantalla (para separar "acciones"). */
export const referencedPermissions = (): Set<Permission> => {
  const keys = new Set<Permission>();
  const walk = (screens: readonly AppScreen[]): void => {
    for (const screen of screens) {
      if (screen.requirement) {
        const list = "allOf" in screen.requirement ? screen.requirement.allOf : screen.requirement.anyOf;
        for (const key of list) keys.add(key);
      }
      if (screen.children) walk(screen.children);
    }
  };
  walk(APP_SCREENS);
  return keys;
};

/**
 * Permisos de las acciones de una pantalla: los declarados en `actions` o, si
 * no hay, los demás permisos del mismo recurso que su requisito, tomados del
 * catálogo (así un permiso nuevo como `devices.export` aparece solo).
 */
export const screenActions = (screen: AppScreen, catalogKeys: readonly Permission[]): Permission[] => {
  if (screen.actions) return [...screen.actions];
  if (!screen.requirement) return [];
  const required = "allOf" in screen.requirement ? screen.requirement.allOf : screen.requirement.anyOf;
  const resources = new Set(required.map((key) => key.slice(0, key.indexOf("."))));
  return catalogKeys.filter(
    (key) => !required.includes(key) && resources.has(key.slice(0, key.indexOf(".")))
  );
};

/** Permisos que exige ver la pantalla (vacío = cualquier sesión). */
export const screenRequirementKeys = (screen: AppScreen): Permission[] => {
  if (!screen.requirement) return [];
  return [...("allOf" in screen.requirement ? screen.requirement.allOf : screen.requirement.anyOf)];
};
