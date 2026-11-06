export interface TenantModuleDefinition {
  id: string;
  label: string;
  description: string;
  paths: string[];
}

/** Módulos que la plataforma puede apagar por cliente. */
export const TENANT_MODULES: readonly TenantModuleDefinition[] = [
  { id: "employees", label: "Personal y expedientes", description: "Personal, departamentos, subáreas, expedientes y reportes.", paths: ["/employees", "/departments", "/subareas"] },
  { id: "attendance", label: "Asistencia y relojes", description: "Checadas, reportes, roster, relojes y vinculación.", paths: ["/hr/time-clock", "/time-clocks"] },
  { id: "schedules", label: "Horarios y tiempo extra", description: "Horarios, asignación, tiempo extra e historial de pre-nómina.", paths: ["/schedules"] },
  { id: "payroll", label: "Nómina", description: "Configuración de nómina, perfiles y cálculo.", paths: ["/payroll"] },
  { id: "leave", label: "Vacaciones y permisos", description: "Solicitudes, aprobación y tipos de permiso.", paths: ["/hr/leave"] },
  { id: "agreements", label: "Convenios de jornada", description: "Convenios art. 58 y acuerdos de método de registro.", paths: ["/hr/jornada-acuerdos"] },
  { id: "telework", label: "Teletrabajo NOM-037", description: "Política, teletrabajadores, checklists y desconexión.", paths: ["/teletrabajo"] },
  { id: "settings", label: "Configuración del cliente", description: "Semana, tolerancias, límites y checada web.", paths: ["/settings"] },
  { id: "roles", label: "Roles y permisos", description: "Roles, matriz de permisos y políticas.", paths: ["/roles"] },
  { id: "notifications", label: "Notificaciones", description: "Centro de avisos y alertas.", paths: ["/notifications"] },
];

export const isTenantModuleDisabled = (disabledModules: readonly string[] | undefined, id: string) =>
  (disabledModules ?? []).includes(id);

export const isPathInDisabledModule = (pathname: string, disabledModules: readonly string[] | undefined): boolean =>
  TENANT_MODULES.some(
    (module) =>
      isTenantModuleDisabled(disabledModules, module.id) &&
      module.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
