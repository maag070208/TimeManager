import { useMemo } from "react";
import { ITBadget, ITButton, ITCard, ITDataTable, ITFlex, ITText } from "@axzydev/axzy_ui_system";
import type { Column } from "@axzydev/axzy_ui_system";
import type { TFunction } from "i18next";
import { LuCheckCheck, LuEye } from "react-icons/lu";
import { workedTime, type PayrollReviewEntry, type WeeklyDepartmentRow } from "@entities/schedule";
import { makeClientTableFetch } from "@shared/api/clientTable";
import { dyn } from "@shared/i18n/dyn";
import { dateLocale } from "@shared/i18n";

interface Props {
  rows: WeeklyDepartmentRow[];
  t: TFunction<any>;
  /** Si el departamento ya se marcó como revisado. */
  isReviewed: (departmentId: string | null) => boolean;
  /** La revisión del departamento (quién, cuándo, una por una o todas). */
  reviewOf: (departmentId: string | null) => PayrollReviewEntry | null;
  /** Abre el detalle por persona filtrado al departamento. */
  onOpenDepartment: (departmentId: string | null) => void;
  /** Pide marcar todos los departamentos como revisados (con confirmación).
      Sin permiso de revisión o con la semana cerrada no se manda y el botón
      no se muestra. */
  onReviewAll?: () => void;
}

const fmtHours = (minutes: number): string =>
  (minutes / 60).toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" });

/**
 * La tabla principal de la pre-nómina: un renglón por departamento con sus
 * personas, horas normales, horas extra, faltas y el estado de la revisión
 * (Revisado / Por revisar; se marca desde el detalle del departamento).
 */
export default function DepartmentSummaryCard({ rows, t: translate, isReviewed, reviewOf, onOpenDepartment, onReviewAll }: Props) {
  const t = dyn(translate);
  const pendingCount = rows.filter((row) => !isReviewed(row.departmentId)).length;

  const fetchData = useMemo(
    () => makeClientTableFetch<WeeklyDepartmentRow>(() => Promise.resolve(rows)),
    [rows]
  );

  const columns: Column<WeeklyDepartmentRow>[] = [
    {
      key: "name",
      label: t("deptTable.department"),
      type: "string",
      width: "30%",
      filter: true,
      sortable: true,
      render: (row) => (
        <ITText className="text-[12.5px] font-black text-slate-800">{row.name}</ITText>
      ),
    },
    {
      key: "people",
      label: t("deptTable.people"),
      type: "number",
      width: 110,
      sortable: true,
      render: (row) => (
        <ITText className="text-[12.5px] font-semibold tabular-nums text-slate-600">{row.people}</ITText>
      ),
    },
    {
      key: "normalMin",
      label: t("deptTable.normalHours"),
      type: "number",
      width: 130,
      sortable: true,
      render: (row) => (
        <ITText className="text-[12.5px] font-semibold tabular-nums text-slate-600">{fmtHours(row.normalMin)}</ITText>
      ),
    },
    {
      key: "extraMin",
      label: t("deptTable.extraHours"),
      type: "number",
      width: 130,
      sortable: true,
      render: (row) => (
        <ITText className="text-[12.5px] font-semibold tabular-nums text-slate-600">{workedTime(row.extraMin)}</ITText>
      ),
    },
    {
      key: "absences",
      label: t("deptTable.absences"),
      type: "number",
      width: 110,
      sortable: true,
      render: (row) => (
        <ITText className="text-[12.5px] font-semibold tabular-nums text-slate-600">{row.absences}</ITText>
      ),
    },
    {
      key: "review",
      label: t("deptTable.review"),
      type: "string",
      width: 160,
      sortable: false,
      render: (row) => {
        const review = reviewOf(row.departmentId);
        const tooltip = review
          ? t("deptTable.reviewedTooltip", {
              name: review.reviewedBy?.name ?? "—",
              date: fmtWhen(review.reviewedAt),
              how: t(review.bulk ? "deptTable.reviewedBulk" : "deptTable.reviewedSingle"),
            })
          : undefined;
        return (
          <span title={tooltip}>
            <ITBadget color={review ? "success" : "warning"} size="sm">
              {t(review ? "deptTable.reviewed" : "deptTable.pending")}
            </ITBadget>
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "",
      type: "actions",
      width: 70,
      actions: (row) => (
        <ITButton
          variant="outlined"
          color="primary"
          className="tm-icon-button"
          aria-label={t("deptTable.detail")}
          title={t("deptTable.detail")}
          onClick={() => onOpenDepartment(row.departmentId)}
        >
          <LuEye size={14} />
        </ITButton>
      ),
    },
  ];

  return (
    <ITCard className="!border-0" contentClassName="!p-0">
      <ITDataTable
        showViewToggle={false}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        fetchData={fetchData as never}
        defaultItemsPerPage={10}
        itemsPerPageOptions={[10, 25, 50]}
        layout="fixed"
        density="compact"
        rowHeight={46}
      />
      <ITFlex align="center" justify="between" gap={3} wrap="wrap" className="px-4 py-2.5">
        <ITText muted className="!text-[11px]">
          {t("deptTable.note")}
        </ITText>
        {pendingCount > 0 && onReviewAll && (
          <ITButton variant="outlined" color="primary" size="sm" className="tm-row-button" onClick={onReviewAll}>
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
              <LuCheckCheck size={13} />
              {t("deptTable.reviewAll")}
            </span>
          </ITButton>
        )}
      </ITFlex>
    </ITCard>
  );
}
