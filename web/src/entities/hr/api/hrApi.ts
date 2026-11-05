import { api } from "@shared/api/client";
import { tableRequest, type ITDataTableFetchParamsPost } from "@shared/api/table";
import { API_CONSTANTS } from "@shared/api/constants/API_CONSTANTS";
import type {
  PersonalProfile,
  PersonalProfileUpdateInput,
  EmployeeAssignmentInput,
  PersonalStats,
  EmployeeDiscount,
  EmployeeDocument,
  EmployeeOverview,
  DocumentType,
  Gender,
  BloodType,
  DisciplinaryReport,
  DisciplinaryReportCreateInput,
} from "../model/types";

export const personalApi = {
  table: (params: ITDataTableFetchParamsPost) =>
    tableRequest<PersonalProfile>(`/hr/query`, params),
  stats: () => api.get<PersonalStats>(`/hr/stats`),
  get: (id: string) => api.get<PersonalProfile>(`/hr/${id}`),
  updateProfile: (id: string, data: PersonalProfileUpdateInput) =>
    api.patch<PersonalProfile>(`/hr/${id}/profile`, data),
  assignDepartments: (data: EmployeeAssignmentInput) =>
    api.post<{ updated: number }>(`/hr/assignment`, data),
  setDiscounts: (id: string, discounts: EmployeeDiscount[]) =>
    api.put<PersonalProfile>(`/hr/${id}/discounts`, { discounts }),

  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ photoUrl: string }>(`/hr/${id}/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  photoRawUrl: (id: string) => `${API_CONSTANTS.BASE_URL}/hr/${id}/photo/raw`,

  overview: (id: string) => api.get<EmployeeOverview>(`/hr/${id}/overview`),
  documents: (id: string) => api.get<EmployeeDocument[]>(`/hr/${id}/documents`),
  uploadDocument: (id: string, documentTypeId: string, file: File) => {
    const form = new FormData();
    form.append("documentTypeId", documentTypeId);
    form.append("file", file);
    return api.post<EmployeeDocument>(`/hr/${id}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  removeDocument: (id: string, docId: string) =>
    api.delete<{ id: string }>(`/hr/${id}/documents/${docId}`),

  /** Dispara el correo de "Alta de personal" con los documentos adjuntos. */
  notifyRegistration: (id: string) =>
    api.post<{ sent: boolean; attachments: number }>(`/hr/${id}/notify-registration`, {}),

  documentTypes: (includeInactive?: boolean) =>
    api.get<DocumentType[]>(`/hr/catalogs/document-types${includeInactive ? "?includeInactive=true" : ""}`),
  createDocumentType: (name: string) =>
    api.post<DocumentType>(`/hr/catalogs/document-types`, { name }),
  updateDocumentType: (id: string, data: { name?: string; active?: boolean; required?: boolean }) =>
    api.patch<DocumentType>(`/hr/catalogs/document-types/${id}`, data),
  removeDocumentType: (id: string) =>
    api.delete<{ soft: boolean; data: DocumentType }>(`/hr/catalogs/document-types/${id}`),

  genders: (includeInactive?: boolean) =>
    api.get<Gender[]>(`/hr/catalogs/genders${includeInactive ? "?includeInactive=true" : ""}`),
  createGender: (name: string) =>
    api.post<Gender>(`/hr/catalogs/genders`, { name }),
  updateGender: (id: string, data: { name?: string; active?: boolean }) =>
    api.patch<Gender>(`/hr/catalogs/genders/${id}`, data),
  deleteGender: (id: string) =>
    api.delete<{ soft: boolean; data: Gender }>(`/hr/catalogs/genders/${id}`),

  bloodTypes: (includeInactive?: boolean) =>
    api.get<BloodType[]>(`/hr/catalogs/blood-types${includeInactive ? "?includeInactive=true" : ""}`),
  createBloodType: (name: string) =>
    api.post<BloodType>(`/hr/catalogs/blood-types`, { name }),
  updateBloodType: (id: string, data: { name?: string; active?: boolean }) =>
    api.patch<BloodType>(`/hr/catalogs/blood-types/${id}`, data),
  deleteBloodType: (id: string) =>
    api.delete<{ soft: boolean; data: BloodType }>(`/hr/catalogs/blood-types/${id}`),

  disciplinaryReports: (params: ITDataTableFetchParamsPost) =>
    tableRequest<DisciplinaryReport>(`/hr/disciplinary-reports/query`, params),
  disciplinaryReportsByEmployee: (id: string) => api.get<DisciplinaryReport[]>(`/hr/disciplinary-reports/employee/${id}`),
  disciplinaryReport: (id: string) => api.get<DisciplinaryReport>(`/hr/disciplinary-reports/${id}`),
  createDisciplinaryReport: (data: DisciplinaryReportCreateInput) =>
    api.post<DisciplinaryReport>(`/hr/disciplinary-reports`, data),
  deleteDisciplinaryReport: (id: string) => api.delete<{ id: string }>(`/hr/disciplinary-reports/${id}`),
};
