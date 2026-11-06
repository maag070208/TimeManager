import { ITBadget, ITButton, ITDataTable, ITText, type Column, type ITDataTableFetchParams, type ITDataTableResponse } from "@axzydev/axzy_ui_system";
import { LuPencil, LuPower, LuPowerOff } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { Plan } from "@entities/plan";

interface Props {
  rows: Plan[];
  canManage: boolean;
  onEdit: (plan: Plan) => void;
  onToggleStatus: (plan: Plan) => void;
}

/** Catálogo de planes: nombre/clave, límites, precio mensual y estado. */
export default function PlansTable({ rows, canManage, onEdit, onToggleStatus }: Props) {
  const { t, i18n } = useTranslation("plans");
  const money = (price: string | null) =>
    price === null
      ? t("table.noPrice")
      : new Intl.NumberFormat(i18n.language === "en" ? "en-US" : "es-MX", {
          style: "currency",
          currency: "MXN",
          maximumFractionDigits: 0,
        }).format(Number(price));

  const columns: Column<Plan>[] = [
    {
      key: "name",
      label: t("table.plan"),
      type: "string",
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <ITText className="block truncate font-semibold text-slate-800">{row.name}</ITText>
          <ITText as="span" className="block font-mono text-[11px] text-slate-500">{row.key}</ITText>
        </div>
      ),
    },
    { key: "employeeLimit", label: t("table.people"), type: "number", className: "text-right", render: (row) => <span className="tabular-nums">{row.employeeLimit.toLocaleString(i18n.language)}</span> },
    { key: "clockLimit", label: t("table.clocks"), type: "number", className: "text-right", render: (row) => <span className="tabular-nums">{row.clockLimit}</span> },
    { key: "monthlyPrice", label: t("table.price"), type: "number", className: "text-right", render: (row) => <span className="tabular-nums">{money(row.monthlyPrice)}</span> },
    { key: "active", label: t("table.status"), type: "string", render: (row) => <ITBadget color={row.active ? "success" : "warning"} size="sm">{t(row.active ? "status.active" : "status.inactive")}</ITBadget> },
    {
      key: "actions",
      label: "",
      type: "actions",
      cellClassName: "min-w-[110px] whitespace-nowrap",
      actions: (row) => (
        <div className="flex justify-end gap-1.5">
          {canManage && (
            <>
              <ITButton variant="outlined" color="primary" className="tm-icon-button" aria-label={t("actions.edit")} title={t("actions.edit")} onClick={() => onEdit(row)}><LuPencil size={14} /></ITButton>
              <ITButton variant="outlined" color={row.active ? "warning" : "success"} className="tm-icon-button" aria-label={t(row.active ? "actions.deactivate" : "actions.activate")} title={t(row.active ? "actions.deactivate" : "actions.activate")} onClick={() => onToggleStatus(row)}>{row.active ? <LuPowerOff size={14} /> : <LuPower size={14} />}</ITButton>
            </>
          )}
        </div>
      ),
    },
  ];

  const fetchData = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<Plan>> => {
    const start = (params.page - 1) * params.limit;
    return { data: rows.slice(start, start + params.limit), total: rows.length };
  };

  return (
    <ITDataTable
      showViewToggle={false}
      defaultItemsPerPage={50}
      itemsPerPageOptions={[25, 50, 100]}
      layout="fixed"
      density="compact"
      virtualized
      virtualizedMaxHeight={400}
      rowHeight={50}
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      fetchData={fetchData as never}
      onRowClick={(row) => onEdit(row as unknown as Plan)}
    />
  );
}
