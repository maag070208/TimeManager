import type { ITDataTableFetchParams, ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { permissionApi, type AccessActivityRow } from "@entities/permission";

/** `fetchData` de la tabla de actividad (server-side). */
export const fetchAccessActivity = (
  params: ITDataTableFetchParams
): Promise<ITDataTableResponse<AccessActivityRow>> =>
  permissionApi.activity({
    page: params.page,
    limit: params.limit,
    filters: params.filters ?? {},
    sort: params.sort,
  });
