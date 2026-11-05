import {
  ITBadget,
  ITDataTable,
  ITFlex,
  ITText,
} from "@axzydev/axzy_ui_system";
import type {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { FaEdit, FaEye, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import type { Department, Subarea } from "@entities/department";
import { RowAction } from "@shared/ui/row-action";

interface Props {
  fetchData: (
    params: ITDataTableFetchParams
  ) => Promise<ITDataTableResponse<Record<string, unknown>>>;
  reloadKey: number;
  canManage: boolean;
  onView: (d: Department) => void;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
}

export default function DepartmentsTable({
  fetchData,
  reloadKey,
  canManage,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const { t: tt } = useTranslation(["departments", "common"]);

  const columns: any[] = [
    {
      type: "string",
      key: "name",
      label: tt("list.colDepartment"),
      width: 240,
      sortable: false,
      filter: true,
      render: (d: Department) => (
        <ITFlex direction="column" gap={0.5}>
          <ITText className="font-semibold text-slate-800 text-[12px]">
            {d.name}
          </ITText>
          {!d.active && (
            <ITText className="text-[12px] font-bold text-rose-500 border border-rose-200 rounded-full px-2 py-0.5 w-fit">
              {tt("list.inactive")}
            </ITText>
          )}
        </ITFlex>
      ),
    },
    {
      type: "string",
      key: "subareas",
      label: tt("list.colAreas"),
      width: 200,
      filter: true,
      render: (d: Department) =>
        d.subareas.length === 0 ? (
          <ITText className="text-[12px] font-bold text-slate-400">
            {tt("list.noAreas")}
          </ITText>
        ) : (
          <ITFlex wrap="wrap" gap={1}>
            {d.subareas.map((s: Subarea) => (
              <ITBadget key={s.id} color="primary" size="lg">
                {s.name.toUpperCase()}
              </ITBadget>
            ))}
          </ITFlex>
        ),
    },
    {
      type: "number",
      key: "count",
      label: tt("list.colUsers"),
      width: 100,
      sortable: false,
      render: (d: Department) => (
        <ITText className="text-[11px] font-black text-slate-600">
          {d._count?.users ?? 0}
        </ITText>
      ),
    },
    {
      type: "actions" as const,
      key: "actions",
      label: "",
      width: 140,
      align: "right" as const,
      render: (d: Department) => (
        <ITFlex gap={1}>
          <RowAction icon={<FaEye size={13} />} label={tt("common:actions.view")} tone="secondary" onClick={() => onView(d)} />
          {canManage && <RowAction icon={<FaEdit size={13} />} label={tt("list.editName")} tone="primary" onClick={() => onEdit(d)} />}
          {canManage && <RowAction icon={<FaTrash size={13} />} label={tt("list.delete")} tone="danger" onClick={() => onDelete(d)} />}
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
      onRowClick={(row) => onView(row as unknown as Department)}
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