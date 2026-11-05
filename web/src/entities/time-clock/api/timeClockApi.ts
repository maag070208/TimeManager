import { api } from "@shared/api/client";
import { tableQuery, tableRequest, type ITDataTableFetchParamsPost } from "@shared/api/table";
import type { AccessReportTableResponse, PeopleAttendanceResponse } from "@entities/access";
import type {
  TimeClockPunch,
  TimeClockEmployee,
  TimeClockEmployeesResponse,
  TimeClockImport,
  TimeClockDevice,
  TimeClockProgress,
  TimeClockConfig,
  TimeClockStatus,
  TimeClockSyncHistory,
} from "../model/types";
import type { RemovalCategoryRow, RosterRemovalInput, RosterRunResult, TimeClockRoster } from "../model/roster";
import type { ClockSyncResult } from "../model/clockSync";
import type {
  EmployeeClockStatus,
  FingerprintCapture,
  FingerprintStationInfo,
  FingerprintStationTest,
  UnifiedPeople,
  FingerprintStatus,
  TimeClockBiometrics,
  TimeClockPeopleList,
  TimeClockPersonInput,
} from "../model/people";
import type { TimeClockCamera } from "../model/camera";
import type { TimeClockSummary } from "../model/summary";
import type { TimeClockPersonDetail } from "../model/person";
import type {
  TimeClockInspectCards,
  TimeClockInspectEvents,
  TimeClockInspectOverview,
  TimeClockInspectUsers,
} from "../model/inspect";

const employeePath = (number: string) => `/time-clock/employees/${encodeURIComponent(number)}`;
const clockPath = (serial: string) => `/time-clock/clocks/${encodeURIComponent(serial)}`;

export const timeClockApi = {
  /** Ficha de una persona (lectura del reloj). */
  personDetail: (serial: string, employeeNumber: string) =>
    api.get<TimeClockPersonDetail>(`${clockPath(serial)}/people/${encodeURIComponent(employeeNumber)}`),
  /** Foto del rostro (bytes), con la sesión del usuario. */
  personPhoto: (serial: string, employeeNumber: string) =>
    api.get<Blob>(`${clockPath(serial)}/people/${encodeURIComponent(employeeNumber)}/photo`, { responseType: "blob" }),
  /** Resumen de estado del dashboard (base + lectura del equipo con caché de 60 s). */
  summary: () => api.get<TimeClockSummary>(`/time-clock/summary`),
  /** Cámara de la terminal (solo lectura). */
  inspectCamera: (serial: string) => api.get<TimeClockCamera>(`${clockPath(serial)}/inspect/camera`),
  /** Personas del reloj con sus tarjetas (lectura). */
  peopleList: (serial: string) => api.get<TimeClockPeopleList>(`${clockPath(serial)}/people`),
  employeeClockStatus: (userId: string) => api.get<EmployeeClockStatus>(`/time-clock/employees/${userId}/clock-status`),
  peopleUnified: () => api.get<UnifiedPeople>("/time-clock/people/unified"),
  fingerprintStationInfo: () => api.get<FingerprintStationInfo>("/time-clock/fingerprint-station"),
  fingerprintStationTest: (fingerNo: number) =>
    api.post<FingerprintStationTest>("/time-clock/fingerprint-station/test", { fingerNo }),
  fingerprintStatus: (userId: string, serial: string) =>
    api.get<FingerprintStatus>(`/time-clock/employees/${userId}/fingerprint/status?serial=${encodeURIComponent(serial)}`),
  fingerprintCapture: (userId: string, serial: string, fingerNo: number) =>
    api.post<FingerprintCapture>(`/time-clock/employees/${userId}/fingerprint/capture`, { serial, fingerNo }),
  fingerprintApply: (userId: string, serial: string, captureId: string) =>
    api.post<{ applied: boolean; fingerNo: number; fingerprints: number }>(`/time-clock/employees/${userId}/fingerprint/apply`, {
      serial,
      captureId,
    }),
  employeeClockBajaAll: (userId: string) =>
    api.post<{ results: ClockSyncResult[] }>(`/time-clock/employees/${userId}/clock-baja-all`, {}),
  employeeClockAltaAll: (userId: string) =>
    api.post<{ results: Array<{ serial: string; name: string; ok: boolean; code?: string }> }>(
      `/time-clock/employees/${userId}/clock-alta-all`,
      {}
    ),
  employeeClockAlta: (userId: string, serial: string) =>
    api.post<{ serial: string; employeeNumber: string; name: string }>(`/time-clock/employees/${userId}/clock-alta`, { serial }),
  peopleBiometrics: (serial: string, refresh = false) =>
    api.get<TimeClockBiometrics>(`${clockPath(serial)}/people/biometrics${refresh ? "?refresh=true" : ""}`),
  /** Da de alta una persona en el reloj (ESCRIBE en el reloj). */
  peopleCreate: (serial: string, input: TimeClockPersonInput) =>
    api.post<{ employeeNumber: string }>(`${clockPath(serial)}/people`, input),
  /** Cambia el nombre de una persona en el reloj (ESCRIBE). */
  peopleRename: (serial: string, employeeNumber: string, name: string) =>
    api.patch<{ employeeNumber: string }>(`${clockPath(serial)}/people/${encodeURIComponent(employeeNumber)}`, { name }),
  /** Da de baja a una persona del reloj, quitando antes sus tarjetas (ESCRIBE). */
  peopleRemove: (serial: string, employeeNumber: string) =>
    api.delete<{ employeeNumber: string }>(`${clockPath(serial)}/people/${encodeURIComponent(employeeNumber)}`),
  /** Registra una tarjeta a una persona (ESCRIBE). */
  peopleAddCard: (serial: string, employeeNumber: string, cardNo: string) =>
    api.post<{ cardNo: string }>(`${clockPath(serial)}/people/${encodeURIComponent(employeeNumber)}/cards`, { cardNo }),
  /** Quita una tarjeta del reloj (ESCRIBE). */
  peopleRemoveCard: (serial: string, cardNo: string) =>
    api.delete<{ cardNo: string }>(`${clockPath(serial)}/cards/${encodeURIComponent(cardNo)}`),
  /** Lo que tiene el reloj: identidad, hora y conteos (solo lectura del equipo). */
  inspectOverview: (serial: string) =>
    api.get<TimeClockInspectOverview>(`${clockPath(serial)}/inspect/overview`),
  inspectUsers: (serial: string) => api.get<TimeClockInspectUsers>(`${clockPath(serial)}/inspect/users`),
  inspectCards: (serial: string) => api.get<TimeClockInspectCards>(`${clockPath(serial)}/inspect/cards`),
  inspectEvents: (serial: string, days = 2) =>
    api.get<TimeClockInspectEvents>(`${clockPath(serial)}/inspect/events?days=${days}`),
  /** Catálogo de motivos de baja (activos). */
  removalCategories: () => api.get<RemovalCategoryRow[]>(`/time-clock/removal-categories`),
  /** Padrón del reloj: nuevos, bajas pendientes y reapariciones (solo lee la base). */
  roster: () => api.get<TimeClockRoster>(`/time-clock/roster`),
  /** Revisa el padrón contra los relojes que cuentan (solo LEE de los relojes). */
  runRoster: () => api.post<RosterRunResult>(`/time-clock/roster/run`),
  /** Aplica la baja pendiente con motivo; da de baja al usuario. */
  applyRemoval: (number: string, input: RosterRemovalInput) =>
    api.post<{ employeeNumber: string }>(`/time-clock/roster/employees/${encodeURIComponent(number)}/removal`, input),
  /** Descarta la baja pendiente sin motivo. */
  dismissRemoval: (number: string) =>
    api.post<{ employeeNumber: string }>(`/time-clock/roster/employees/${encodeURIComponent(number)}/dismiss`),
  /**
   * Timeline de un reloj: sus últimos intentos de sincronización (falló,
   * reintentó, conectó) con su resumen. Es lo que ve soporte al abrir el
   * detalle de un reloj.
   */
  clockEvents: (serial: string, limit = 50) =>
    api.get<TimeClockSyncHistory>(`${clockPath(serial)}/events?limit=${limit}`),

  /** Tabla server-side (`{ page, limit, filters, sort }` → `{ data, total }`). */
  table: (params: ITDataTableFetchParamsPost) =>
    tableRequest<TimeClockPunch>(`/time-clock/query`, params),
  status: () => api.get<TimeClockStatus>(`/time-clock/status`),
  /**
   * Importa del reloj las checadas de un rango de días (solo LEE del reloj).
   * Responde de inmediato; la importación sigue en segundo plano y su avance
   * sale en `status().importacion`. 409 si ya hay una en curso.
   */
  startImport: (input: { from: string; to: string; tz?: string }) =>
    api.post<TimeClockImport>(`/time-clock/import`, input),

  /**
   * Drena del reloj todo lo que falte desde el cursor (el rezago completo; solo
   * LEE del reloj). Responde 202 con el avance inicial; la corrida sigue en
   * segundo plano y su avance sale en `status().enCurso`. 409 si ya hay una
   * sincronización en curso, 503 si el checador no está configurado.
   */
  sync: () => api.post<TimeClockProgress>(`/time-clock/sync`),

  /**
   * Da de alta un reloj (solo ADMIN): la API se conecta, lee su identidad y
   * arranca su sincronización. Nunca le escribe al reloj. `url` acepta la IP o
   * la URL copiada del navegador; sin `nombre` se usa el configurado en el reloj.
   */
  registerClock: (input: { url: string; name?: string; countsAttendance?: boolean }) =>
    api.post<TimeClockDevice>(`/time-clock/clocks`, input),
  /** Cambia cómo lo usa el sistema (nombre, si cuenta para entradas/salidas); no toca el reloj. */
  updateClock: (serial: string, changes: { name?: string; countsAttendance?: boolean; writeEnabled?: boolean }) =>
    api.patch<TimeClockDevice>(clockPath(serial), changes),
  /** Deja de sincronizar el reloj; sus checadas se quedan. */
  retireClock: (serial: string) => api.delete<{ clockSerial: string }>(clockPath(serial)),
  /** Configuración leída en vivo del reloj (solo lectura). */
  clockSettings: (serial: string) =>
    api.get<TimeClockConfig>(`${clockPath(serial)}/settings`),

  /** Entradas/salidas del reloj: mismo contrato que `/access/report`. */
  report: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AccessReportTableResponse>(`/time-clock/report`, params),
  reportExport: (params: ITDataTableFetchParamsPost) =>
    tableQuery<AccessReportTableResponse>(`/time-clock/report/export`, params),
  /** Entradas/salidas por persona con cada día contra su horario (módulo de horarios). */
  people: (params: ITDataTableFetchParamsPost) =>
    tableQuery<PeopleAttendanceResponse>(`/schedules/attendance/time-clock`, params),

  /** Empleados del reloj con su vínculo o sugerencia (filtros: `q`, `estado`). */
  employees: (params: ITDataTableFetchParamsPost) =>
    tableQuery<TimeClockEmployeesResponse>(`/time-clock/employees/query`, params),
  linkEmployee: (employeeNumber: string, userId: string) =>
    api.put<TimeClockEmployee>(employeePath(employeeNumber), { userId }),
  unlinkEmployee: (employeeNumber: string) =>
    api.delete<{ employeeNumber: string }>(employeePath(employeeNumber)),
  /** Vincula de un jalón las sugerencias `ALTA`. */
  linkSuggested: () =>
    api.post<{ linkedCount: number }>(`/time-clock/employees/link-suggested`),
};
