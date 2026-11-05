import { ITBadget, ITButton, ITCard, ITText } from "@axzydev/axzy_ui_system";
import type { TFunction } from "i18next";
import { LuCheckCheck } from "react-icons/lu";
import { workedTime, type PayrollReviewEntry, type WeeklyDepartmentRow } from "@entities/schedule";
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

/* La retícula se hace con divs y roles ARIA (no <table>): el tema inyecta
   reglas globales a thead/tbody (fondo y border-bottom negro con !important)
   pensadas para ITDataTable, que ensucian cualquier tabla plana. Las orillas
   van inline: las clases border-slate/border-[color:] no se generan en el CSS
   de la app y la orilla caía al currentColor (gris oscuro). */
const grid = "grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.9fr))_minmax(0,1fr)_auto] items-center";
const th = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400";
const td = "text-[12.5px]";
const hairline = "1px solid #edf1f5";

/**
 * La tabla principal de la pre-nómina: un renglón por departamento con sus
 * personas, horas normales, horas extra, faltas y el estado de la revisión
 * (Revisado / Por revisar; se marca desde el detalle del departamento).
 */
export default function DepartmentSummaryCard({ rows, t: translate, isReviewed, reviewOf, onOpenDepartment, onReviewAll }: Props) {
  const t = dyn(translate);
  const pendingCount = rows.filter((row) => !isReviewed(row.departmentId)).length;

  return (
    <ITCard className="!border-0" contentClassName="!p-0">
      <div className="overflow-x-auto">
        <div role="table" aria-label={t("deptTable.department")} className="min-w-[720px]">
          <div role="row" className={`${grid} px-4 py-2.5`} style={{ borderBottom: hairline }}>
            <span role="columnheader" className={th}>{t("deptTable.department")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("deptTable.people")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("deptTable.normalHours")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("deptTable.extraHours")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("deptTable.absences")}</span>
            <span role="columnheader" className={`${th} text-center`}>{t("deptTable.review")}</span>
            <span role="columnheader" className={`${th} text-right`} />
          </div>
          {rows.map((row, i) => (
            <div
              role="row"
              key={row.departmentId ?? "none"}
              className={`${grid} px-4 py-3`}
              style={i < rows.length - 1 ? { borderBottom: hairline } : undefined}
            >
              <span role="cell" className={`${td} font-black text-slate-800`}>{row.name}</span>
              <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>{row.people}</span>
              <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                {fmtHours(row.normalMin)}
              </span>
              <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                {workedTime(row.extraMin)}
              </span>
              <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>{row.absences}</span>
              <span role="cell" className={`${td} flex justify-center`}>
                {(() => {
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
                })()}
              </span>
              <span role="cell" className={`${td} text-right`}>
                <button
                  type="button"
                  onClick={() => onOpenDepartment(row.departmentId)}
                  className="cursor-pointer rounded-full !bg-transparent px-3 py-1 !text-[11.5px] font-bold text-slate-600 transition hover:bg-slate-50"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  {t("deptTable.detail")}
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <ITText muted className="!text-[11px]">
          {t("deptTable.note")}
        </ITText>
        {pendingCount > 0 && onReviewAll && (
          <ITButton variant="outlined" color="primary" size="sm" onClick={onReviewAll}>
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
              <LuCheckCheck size={13} />
              {t("deptTable.reviewAll")}
            </span>
          </ITButton>
        )}
      </div>
    </ITCard>
  );
}
