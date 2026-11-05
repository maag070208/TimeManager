export interface ReportFilters {
  start?: string;
  end?: string;
  department?: string;
  employee?: string;
}

/**
 * Pie de los PDF de instantánea (asignados / dispositivos): sólo.filters
 * aplicados, porque la pestaña no tiene periodo.
 */
export interface SnapshotReportPdfMeta {
  generatedAt: string;
  appliedFilters: Array<{ label: string; value: string }>;
}

/** Payload del PDF de asignados: universo filtrado + KPIs del conjunto completo. */
export interface AssignedDevicesPdfPayload {
  data: AssignedDeviceRow[];
  stats: AssignedDevicesStats;
  truncated: boolean;
  meta: SnapshotReportPdfMeta;
}

/** Payload del PDF de dispositivos: universo filtrado + KPIs del conjunto completo. */
export interface DevicesPdfPayload {
  data: DeviceReportRow[];
  stats: DevicesStats;
  truncated: boolean;
  meta: SnapshotReportPdfMeta;
}

export interface ReportRow {
  id: string;
  date: string;
  document_code: string;
  employee_no: string | null;
  responsible: string;
  department: string;
  subarea: string | null;
  area_boss: string | null;
  delivery_by: string;
  return_date: string | null;
  returned_by: string | null;
  return_condition: string | null;
  asset_code: string;
  description: string;
  quantity: number;
  brand: string | null;
  model: string | null;
  serial: string | null;
  equipment_name: string | null;
  status: string;
}

export interface AssignedDeviceRow {
  /** Dispositivo del catálogo (el detalle `/inventory/devices/:id`). */
  deviceId: string;
  /** Unidad física de la fila. */
  unitId: string;
  assetTag: string;
  description: string;
  brand: string;
  model: string;
  type: string;
  custodian: string;
  employeeNumber: string | null;
  department: string | null;
  date: string | null;
  daysAssigned: number | null;
  source: "CUSTODY_LETTER" | "MOVEMENT" | "UNKNOWN";
  folio: string | null;
}

/** KPIs del conjunto filtrado, calculados en el servidor. */
export interface AssignedDevicesStats {
  assigned: number;
  averageDays: number;
  over30: number;
}

export interface AssignedDevicesTableResponse {
  data: AssignedDeviceRow[];
  total: number;
  stats: AssignedDevicesStats;
}

export interface AssignedDevicesExportResponse extends AssignedDevicesTableResponse {
  truncated: boolean;
}

export type DeviceReportStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "DAMAGED"
  | "IN_MAINTENANCE"
  | "RETIRED";

export interface DeviceReportRow {
  /** Dispositivo del catálogo (el detalle `/inventory/devices/:id`). */
  deviceId: string;
  /** Unidad física de la fila. */
  unitId: string;
  assetTag: string;
  description: string;
  brand: string;
  model: string;
  type: string;
  serialNumber: string | null;
  hostname: string | null;
  ip: string | null;
  macAddress: string | null;
  area: string;
  departmentName: string | null;
  status: DeviceReportStatus;
  batchId: string | null;
  quantity: number;
  custodian: string | null;
  employeeNumber: string | null;
  department: string | null;
  date: string | null;
  daysAssigned: number | null;
  source: "CUSTODY_LETTER" | "MOVEMENT" | "UNKNOWN" | null;
  folio: string | null;
}

export interface DevicesStats {
  total: number;
  available: number;
  assigned: number;
  retired: number;
  over30: number;
  averageDays: number;
}

export interface DevicesTableResponse {
  data: DeviceReportRow[];
  total: number;
  stats: DevicesStats;
}

export interface DevicesExportResponse extends DevicesTableResponse {
  truncated: boolean;
}