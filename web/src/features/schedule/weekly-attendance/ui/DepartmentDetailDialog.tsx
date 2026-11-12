import { ITButton, ITDialog, ITText } from "@axzydev/axzy_ui_system";
import type { TFunction } from "i18next";
import { LuCheck, LuUsers } from "react-icons/lu";
import { hoursDecimal, workedTime, type WeeklyAttendanceRow } from "@entities/schedule";
import { useHasPunchChannel } from "@entities/user";
import { DialogHeader } from "@shared/ui/dialog-header";
import { dyn } from "@shared/i18n/dyn";

interface Props {
  /** Departamento abierto (null = modal cerrado). */
  department: { id: string | null; name: string } | null;
  rows: WeeklyAttendanceRow[];
  t: TFunction<any>;
  /** Si el departamento ya está marcado como revisado. */
  reviewed: boolean;
  /** Si la sesión puede marcar/desmarcar (permiso `payroll.review` y semana abierta). */
  canReview: boolean;
  /** Marca/desmarca el departamento como revisado y cierra el modal. */
  onToggleReview: () => void;
  onClose: () => void;
}

/* Divs con roles ARIA (no <table>): el tema inyecta reglas globales a
   thead/tbody con !important que ensucian cualquier tabla plana. Las orillas
   van inline: las clases border-slate/border-[color:] no se generan en el CSS
   de la app y la orilla caía al currentColor (gris oscuro). */
const grid = "grid grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] items-center";
const th = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400";
const td = "text-[12.5px]";
const hairline = "1px solid #edf1f5";

/**
 * "Ver detalle" de un departamento: las personas del renglón con sus horas,
 * tiempo extra y faltas de la semana. Es un modal para que la pantalla se
 * quede como la maqueta (solo la tabla por departamento).
 */
export default function DepartmentDetailDialog({ department, rows, t: translate, reviewed, canReview, onToggleReview, onClose }: Props) {
  const t = dyn(translate);
  /** Sin canal CLOCK no se muestra el número con el que la persona está en el reloj. */
  const hasClock = useHasPunchChannel("CLOCK") ?? true;

  return (
    <ITDialog isOpen={department !== null} onClose={onClose}>
      {department && (
        <>
          <DialogHeader
            icon={<LuUsers />}
            tone="primary"
            title={department.name}
            subtitle={t("deptDetail.subtitle", { count: rows.length })}
          />
          <div className="max-h-[55vh] overflow-y-auto">
            <div role="table" aria-label={department.name}>
              <div role="row" className={`${grid} px-3 py-2`} style={{ borderBottom: hairline }}>
                <span role="columnheader" className={th}>{t("columns.employee")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("columns.hours")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("columns.overtime")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("columns.approved")}</span>
                <span role="columnheader" className={`${th} text-center`}>{t("columns.absences")}</span>
              </div>
              {rows.map((row, i) => (
                <div
                  role="row"
                  key={row.userId}
                  className={`${grid} px-3 py-2.5`}
                  style={i < rows.length - 1 ? { borderBottom: hairline } : undefined}
                >
                  <span role="cell" className={`${td} font-bold text-slate-700`}>
                    {row.name}
                    {hasClock && (
                      <ITText as="span" muted className="ml-1.5 !text-[11px] font-semibold">
                        {row.clockNumbers.join(", ") || row.employeeNumber || ""}
                      </ITText>
                    )}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {hoursDecimal(row.totals.workedMin)}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {workedTime(row.totals.extraMin)}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-emerald-700`}>
                    {hoursDecimal(row.totals.approvedExtraMin)}
                  </span>
                  <span role="cell" className={`${td} text-center font-semibold tabular-nums text-slate-600`}>
                    {row.totals.absences}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {canReview && (
            <div className="flex items-center justify-end gap-2 px-3 py-3" style={{ borderTop: hairline }}>
              <ITButton
                variant={reviewed ? "outlined" : "filled"}
                color={reviewed ? "secondary" : "primary"}
                size="sm"
                onClick={onToggleReview}
              >
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
                  <LuCheck size={13} />
                  {t(reviewed ? "review.unmark" : "review.mark")}
                </span>
              </ITButton>
            </div>
          )}
        </>
      )}
    </ITDialog>
  );
}
