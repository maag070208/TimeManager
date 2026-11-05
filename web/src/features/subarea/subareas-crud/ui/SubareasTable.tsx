import {
  ITButton,
  ITDataTable,
  ITFlex,
  ITText,
} from "@axzydev/axzy_ui_system";
import type {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { FaEdit, FaTrash, FaTrashRestore } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { Subarea } from "@entities/subarea";

interface Props {
  /** Opciones del filtro Departamento (todos, incluidos inactivos). */
  departments: Array<{ id: string; name: string }>;
  fetchData: (
    params: ITDataTableFetchParams
  ) => Promise<ITDataTableResponse<Record<string, unknown>>>;
  reloadKey: number;
  onEdit: (s: Subarea) => void;
  onReactivate: (s: Subarea) => void;
  onDelete: (s: Subarea) => void;
}

export default function SubareasTable({
  departments,
  fetchData,
  reloadKey,
  onEdit,
  onReactivate,
  onDelete,
}: Props) {
  const { t: tt } = useTranslation(["subareas", "common"]);

  const columns: any[] = [
    {
      type: "string",
      key: "name",
      label: tt("list.colName"),
      width: 240,
      sortable: false,
      filter: true,
      render: (s: Subarea) => (
        <ITFlex direction="column" gap={0.5}>
          <ITText className="font-semibold text-slate-800 text-[12px]">
            {s.name}
          </ITText>
          {!s.active && (
            <ITText className="text-[12px] font-bold text-rose-500 border border-rose-200 rounded-full px-2 py-0.5 w-fit">
              {tt("list.inactive")}
            </ITText>
          )}
        </ITFlex>
      ),
    },
    {
      type: "catalog",
      key: "departmentId",
      label: tt("list.colDepartment"),
      width: 200,
      sortable: false,
      filter: "search",
      catalogOptions: { data: departments.map((d) => ({ id: d.id, name: d.name })) },
      render: (s: Subarea) => (
        <ITText className="text-[12px] font-semibold text-slate-600">
          {s.department?.name ?? "—"}
        </ITText>
      ),
    },
    {
      type: "actions" as const,
      key: "actions",
      label: "",
      width: 120,
      align: "right" as const,
      render: (s: Subarea) => (
        <ITFlex gap={1}>
          {s.active ? (
            <ITButton
              variant="outlined"
              size="lg"
              color="secondary"
              onClick={() => onEdit(s)}
              title={tt("list.editName")}
            >
              <FaEdit size={12} />
            </ITButton>
          ) : (
            <ITButton
              variant="outlined"
              size="lg"
              color="secondary"
              onClick={() => onReactivate(s)}
              title={tt("list.reactivate")}
            >
              <FaTrashRestore size={12} />
            </ITButton>
          )}
          <ITButton
            variant="outlined"
            size="lg"
            color="error"
            onClick={() => onDelete(s)}
            title={s.active ? tt("list.delete") : tt("list.deleteForever")}
          >
            <FaTrash size={12} />
          </ITButton>
        </ITFlex>
      ),
    },
  ];

  return (
    <ITDataTable showViewToggle={false}
      columns={columns as any}
      fetchData={
        fetchData as unknown as (
          p: ITDataTableFetchParams
        ) => Promise<ITDataTableResponse<Record<string, unknown>>>
      }
      reloadTrigger={reloadKey}
      size="lg"
      onRowClick={(row) => onEdit(row as unknown as Subarea)}
      defaultItemsPerPage={25}
      itemsPerPageOptions={[25, 50, 100]}
      layout="fixed"
      density="compact"
      rowHeight={50}
      virtualized
      virtualizedMaxHeight={460}
    />
  );
}
