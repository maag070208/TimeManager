import {
  ITButton,
  ITChip,
  ITDataTable,
  ITFlex,
  ITText,
} from "@axzydev/axzy_ui_system";
import type {
  Column,
  ColumnFilters,
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@axzydev/axzy_ui_system";
import { LuEye, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { DisciplinaryReason, DisciplinaryReport } from "@entities/hr";
import { usePeopleOptions } from "@entities/user";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { formatDate } from "@shared/utils/dates";
import { DISCIPLINARY_REASONS } from "../model/useDisciplinaryReports";

/** Chip pastel del motivo: el color dice qué tan grave es el asunto. */
const REASON_CHIP: Record<DisciplinaryReason, "danger" | "warning" | "secondary"> = {
  ABSENCE: "danger",
  TARDINESS: "warning",
  INTOXICATION: "danger",
  MISCONDUCT: "warning",
  NONCOMPLIANCE: "warning",
  OTHER: "secondary",
};

interface Props {
  fetchData: (
    params: ITDataTableFetchParams
  ) => Promise<ITDataTableResponse<Record<string, unknown>>>;
  reloadKey: number;
  /** Filtros de la franja de resumen y del buscador (los mandan sobre la columna). */
  externalFilters?: ColumnFilters;
  /** Remonta la tabla en la página 1 al cambiar un filtro de fuera. */
  tableKey?: string;
  /** Recién creada desde el bot: anima la primera fila al recargar. */
  flashNew?: boolean;
  /** El API exige `hr.disciplinary_reports` para consultar y para eliminar. */
  canDelete?: boolean;
  onView: (disciplinaryReport: DisciplinaryReport) => void;
  onDelete: (disciplinaryReport: DisciplinaryReport) => void;
}

export default function DisciplinaryReportsTable({
  fetchData,
  reloadKey,
  externalFilters,
  tableKey,
  canDelete = true,
  onView,
  onDelete,
  flashNew = false,
}: Props) {
  const { t: tt } = useTranslation("disciplinary-reports");

  // Opciones de Empleado y Registró (incluye a quien ya se dio de baja).
  const peopleOptions = usePeopleOptions();

  const columns: Column<DisciplinaryReport>[] = [
    {
      key: "incidentDate",
      label: tt("table.date"),
      type: "date",
      width: 130,
      filter: "date-range",
      sortable: true,
      dateFilterOptions: { maxDate: new Date() },
      render: (a) => (
        <ITText className="text-[12px] font-semibold text-slate-700">
          {formatDate(a.incidentDate)}
        </ITText>
      ),
    },
    {
      key: "reason",
      label: tt("table.reason"),
      type: "catalog",
      width: 200,
      filter: "catalog",
      sortable: true,
      catalogOptions: {
        data: DISCIPLINARY_REASONS.map((id) => ({ id, name: tt(`reasons.${id}`) })),
        loading: false,
        error: false,
      },
      render: (a) => (
        <ITChip color={REASON_CHIP[a.reason] ?? "secondary"} size="sm" variant="soft" label={tt(`reasons.${a.reason}`)} />
      ),
    },
    {
      key: "userId",
      label: tt("table.employee"),
      type: "catalog",
      width: 230,
      filter: "search",
      catalogOptions: peopleOptions,
      sortable: true,
      render: (a) => (
        <ITFlex align="center" gap={2} className="min-w-0">
          <ProfileAvatar name={a.user.name} size="sm" />
          <ITFlex direction="column" gap={0.5} className="min-w-0">
            <ITText className="truncate text-[13px] font-semibold text-slate-800">
              {a.user.name}
            </ITText>
            <ITText className="truncate text-[11px] text-slate-400">
              {a.user.employeeNumber ? `#${a.user.employeeNumber}` : "—"}
              {a.user.department ? ` · ${a.user.department.name}` : ""}
            </ITText>
          </ITFlex>
        </ITFlex>
      ),
    },
    {
      key: "jobTitle",
      label: tt("table.jobTitle"),
      type: "string",
      width: 170,
      filter: true,
      sortable: true,
      render: (a) => (
        <ITText className="text-[12px] text-slate-600">{a.user.jobTitle ?? "—"}</ITText>
      ),
    },
    {
      key: "description",
      label: tt("table.description"),
      type: "string",
      width: 260,
      filter: true,
      sortable: false,
      render: (a) => (
        <ITText className="line-clamp-2 max-w-[260px] text-[12px] text-slate-500">
          {a.description}
        </ITText>
      ),
    },
    {
      key: "sanction",
      label: tt("table.sanction"),
      type: "string",
      width: 170,
      filter: true,
      sortable: false,
      render: (a) =>
        a.sanction ? (
          <ITText className="line-clamp-2 max-w-[200px] text-[12px] text-slate-500">
            {a.sanction}
          </ITText>
        ) : (
          <ITText className="text-[12px] text-slate-400">{tt("table.noSanction")}</ITText>
        ),
    },
    {
      key: "createdById",
      label: tt("table.createdBy"),
      type: "catalog",
      width: 170,
      filter: "search",
      catalogOptions: peopleOptions,
      sortable: true,
      render: (a) => (
        <ITFlex align="center" gap={2} className="min-w-0">
          <ProfileAvatar name={a.createdBy.name} size="xs" />
          <ITText className="truncate text-[12px] text-slate-500">{a.createdBy.name}</ITText>
        </ITFlex>
      ),
    },
    {
      key: "actions",
      label: "",
      type: "string" as const,
      width: 110,
      sortable: false,
      render: (a: DisciplinaryReport) => (
        <ITFlex align="center" gap={2}>
          <ITButton
            onClick={() => onView(a)}
            size="lg"
            color="secondary"
            title={tt("actions.view")}
          >
            <LuEye size={15} />
          </ITButton>
          {canDelete && (
            <ITButton
              onClick={() => onDelete(a)}
              size="lg"
              color="danger"
              title={tt("actions.delete")}
            >
              <LuTrash2 size={15} />
            </ITButton>
          )}
        </ITFlex>
      ),
    },
  ];

  return (
    <div className={flashNew ? "ticket-row-flash" : undefined}>
    <ITDataTable showViewToggle={false}
      // Otro mosaico del resumen = otra lista: la tabla se remonta.
      key={tableKey ?? JSON.stringify(externalFilters ?? {})}
      externalFilters={externalFilters}
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      fetchData={
        fetchData as unknown as (
          p: ITDataTableFetchParams
        ) => Promise<ITDataTableResponse<Record<string, unknown>>>
      }
      reloadTrigger={reloadKey}
      onRowClick={(row) => onView(row as unknown as DisciplinaryReport)}
      defaultItemsPerPage={25}
      itemsPerPageOptions={[25, 50, 100]}
      layout="fixed"
      density="compact"
      rowHeight={50}
      virtualized
      virtualizedMaxHeight={460}
    />
    </div>
  );
}
