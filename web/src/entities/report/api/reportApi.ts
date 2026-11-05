import { tableQuery, type ITDataTableFetchParamsPost } from "@shared/api/table";
import type {
  AssignedDevicesExportResponse,
  AssignedDevicesTableResponse,
  DevicesExportResponse,
  DevicesTableResponse,
} from "../model/types";

export const reportsApi = {
  /** Instantáneas server-side: paginación, filtros y orden se resuelven en el API. */
  assigned: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AssignedDevicesTableResponse>(`/reports/assigned-devices`, params),
  devices: (params: ITDataTableFetchParamsPost) =>
    tableQuery<DevicesTableResponse>(`/reports/devices`, params),
  /** Universo filtrado para el PDF, con tope explícito y aviso de truncamiento. */
  assignedExport: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AssignedDevicesExportResponse>(`/reports/assigned-devices/export`, params),
  devicesExport: (params: ITDataTableFetchParamsPost) =>
    tableQuery<DevicesExportResponse>(`/reports/devices/export`, params),
};
