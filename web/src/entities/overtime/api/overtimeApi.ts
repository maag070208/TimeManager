import { post } from "@shared/api/client";
import { tableQuery, type ITDataTableFetchParamsPost } from "@shared/api/table";
import type {
  OvertimeDecideInput,
  OvertimeDecideResult,
  OvertimeQueryResponse,
} from "../model/types";

export const overtimeApi = {
  /** Tabla server-side de días de tiempo extra + resumen. */
  query: (params: ITDataTableFetchParamsPost) =>
    tableQuery<OvertimeQueryResponse>(`/overtime/query`, params),
  /** Aprueba/rechaza/revierte días (persona + fecha). */
  decide: (input: OvertimeDecideInput) =>
    post<OvertimeDecideResult>(`/overtime/approvals`, input),
};
