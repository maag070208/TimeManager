export interface TenantModuleDefinition {
  id: string;
  label: string;
  description: string;
  paths: string[];
  group: "Operación" | "Nómina y cumplimiento" | "Administración";
  requires?: string;
  initials: string;
  tone: "mint" | "sky" | "amber" | "lavender" | "slate";
}

/** Módulos que la plataforma puede apagar por cliente. */
export const TENANT_MODULES: readonly TenantModuleDefinition[] = [
  { id: "employees", label: "Personal y expedientes", description: "Personal, departamentos, subáreas, expedientes y reportes.", paths: ["/employees", "/departments", "/subareas"], group: "Operación", initials: "PE", tone: "mint" },
  { id: "attendance", label: "Asistencia y relojes", description: "Checadas, reportes, roster, relojes y vinculación.", paths: ["/hr/time-clock", "/time-clocks"], group: "Operación", initials: "AR", tone: "sky" },
  { id: "schedules", label: "Horarios y tiempo extra", description: "Horarios, asignación, tiempo extra e historial de pre-nómina.", paths: ["/schedules"], group: "Operación", requires: "Asistencia", initials: "HT", tone: "amber" },
  { id: "payroll", label: "Nómina", description: "Configuración de nómina, perfiles y cálculo.", paths: ["/payroll"], group: "Nómina y cumplimiento", requires: "Asistencia", initials: "NO", tone: "amber" },
  { id: "leave", label: "Vacaciones y permisos", description: "Solicitudes, aprobación y tipos de permiso.", paths: ["/hr/leave"], group: "Operación", initials: "VP", tone: "mint" },
  { id: "agreements", label: "Convenios de jornada", description: "Convenios art. 58 y acuerdos de método de registro.", paths: ["/hr/jornada-acuerdos"], group: "Nómina y cumplimiento", initials: "CJ", tone: "mint" },
  { id: "telework", label: "Teletrabajo NOM-037", description: "Política, teletrabajadores, checklists y desconexión.", paths: ["/teletrabajo"], group: "Operación", initials: "TT", tone: "slate" },
  { id: "settings", label: "Configuración del cliente", description: "Semana, tolerancias, límites y checada web.", paths: ["/settings"], group: "Administración", initials: "CC", tone: "slate" },
  { id: "roles", label: "Roles y permisos", description: "Roles, matriz de permisos y políticas.", paths: ["/roles"], group: "Administración", initials: "RP", tone: "mint" },
  { id: "notifications", label: "Notificaciones", description: "Centro de avisos y alertas.", paths: ["/notifications"], group: "Administración", initials: "NT", tone: "mint" },
];

export const isTenantModuleDisabled = (disabledModules: readonly string[] | undefined, id: string) =>
  (disabledModules ?? []).includes(id);

export const isPathInDisabledModule = (pathname: string, disabledModules: readonly string[] | undefined): boolean =>
  TENANT_MODULES.some(
    (module) =>
      isTenantModuleDisabled(disabledModules, module.id) &&
      module.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
