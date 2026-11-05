import { api } from "@shared/api/client";
import { tableQuery, tableRequest, type ITDataTableFetchParamsPost } from "@shared/api/table";
import type {
  AccessEvent,
  AccessReportTableResponse,
  AccessStats,
  PeopleAttendanceResponse,
  Site,
} from "../model/types";

export const accessApi = {
  /** Tabla server-side (`{ page, limit, filters, sort }` → `{ data, total }`). */
  table: (params: ITDataTableFetchParamsPost) =>
    tableRequest<AccessEvent>(`/access/query`, params),
  /** Conteos (eventos, entradas, salidas, anulados) para los mismos filtros. */
  stats: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AccessStats>(`/access/stats`, params),
  get: (id: string) => api.get<AccessEvent>(`/access/${id}`),
  sites: () => api.get<Site[]>(`/access/sites`),
  void: (id: string, reason: string) =>
    api.post<AccessEvent>(`/access/${id}/void`, { reason }),
  /** Página del reporte por persona + `summary` global (contrato ITDataTable). */
  report: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AccessReportTableResponse>(`/access/report`, params),
  /** Universo completo sin paginar, para el PDF. Mismos filtros y `summary`. */
  reportExport: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AccessReportTableResponse>(`/access/report/export`, params),
  /** Una fila por persona con cada día contra su horario (lo calcula el módulo de horarios). */
  people: (params: ITDataTableFetchParamsPost) =>
    tableQuery<PeopleAttendanceResponse>(`/schedules/attendance/access`, params),
};
