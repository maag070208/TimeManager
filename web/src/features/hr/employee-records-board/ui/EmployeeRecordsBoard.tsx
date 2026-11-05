import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ITAlert,
  ITBadget,
  ITCard,
  ITButton,
  ITChip,
  ITFlex,
  ITConfirmDialog,
  ITInput,
  ITSearchSelect,
  ITToast, ITText } from "@axzydev/axzy_ui_system";
import { FaBell, FaChevronRight, FaSearch } from "react-icons/fa";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { RowAction } from "@shared/ui/row-action";
import { Num } from "@shared/ui/bento-bits";
import type { RecordGapsRow } from "@entities/dashboard";
import { recordStatus, type RecordFilter, type RecordStatus, type UseEmployeeRecords } from "../model/useEmployeeRecords";
import { ContentSkeleton } from "@shared/ui/content-skeleton";

const FILTERS: RecordFilter[] = ["ALL", "REQUIRED", "INCOMPLETE", "COMPLETE"];
const OTHER_DOCS_PREVIEW = 4;
const FIELDS_PREVIEW = 4;

const STATUS_COLOR = { REQUIRED: "warning", INCOMPLETE: "gray", COMPLETE: "success" } as const satisfies Record<RecordStatus, string>;

const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = percent(done, total);
  const complete = total > 0 && done === total;
  return (
    <div className="w-[110px]" title={label}>
      <div className="flex items-baseline justify-between gap-2">
        <ITText as="span" className="text-[10px] font-medium text-slate-500">{pct}%</ITText>
        <ITText as="span" className={`text-[11px] font-bold tabular-nums ${complete ? "text-[color:var(--color-success)]" : "text-slate-700"}`}>
          {done}/{total}
        </ITText>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(pct, done > 0 ? 6 : 0)}%`,
            backgroundColor: complete ? "var(--color-success)" : "var(--color-primary)",
          }}
        />
      </div>
    </div>
  );
}


interface Props {
  fx: UseEmployeeRecords;
  /** Oculta la franja de indicadores (el inicio ya la muestra en el mosaico). */
  hideKpis?: boolean;
}

/**
 * Expedientes de empleados (RH): indicadores, lista filtrable con los
 * obligatorios de cada quien, avance del expediente y de los datos personales,
 * y el detalle de la persona elegida para ver o subir documentos y avisarle.
 *
 * Las tarjetas de arriba y la tabla usan el estilo de Pre-nómina: tarjetas
 * blancas sin borde (la primera en tinta), número rojo solo en lo que falta,
 * y la tabla sin fondo de encabezado, con líneas finas inline (las clases
 * border-slate/border-[color:] no se generan en el CSS de la app y el tema
 * mete reglas globales a thead/tbody con !important).
 */
const hairline = "1px solid #edf1f5";
const grid = "grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] items-center";
const th = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400";

/** Tarjeta de indicador blanca, como las de Pre-nómina. */
function RecordKpi({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div
      className="rounded-[14px] px-4 py-3.5"
      style={{ background: "var(--it-card-bg, #ffffff)", boxShadow: "0 1px 2px rgb(15 23 42 / 0.06)" }}
    >
      <ITText muted className="block !text-[12px] font-semibold">
        {label}
      </ITText>
      <ITText
        className="mt-1 block !text-[26px] font-extrabold leading-none tabular-nums"
        style={alert ? { color: value > 0 ? "var(--color-danger)" : "var(--color-text-muted)" } : undefined}
      >
        <Num value={value} />
      </ITText>
    </div>
  );
}

export default function EmployeeRecordsBoard({ fx, hideKpis = false }: Props) {
  const { t } = fx;
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const sel = fx.selected;

  const pickFile = (typeId: string) => {
    setUploadType(typeId);
    fileInput.current?.click();
  };

  // Indicadores estilo Pre-nómina: plantilla en tinta, lo que falta en rojo.

  const done = (items: Array<{ delivered: boolean }>) => items.filter((i) => i.delivered).length;
  const totalOf = (r: RecordGapsRow) => ({
    done: done(r.requiredDocuments) + done(r.otherDocuments) + r.filledFields.length,
    total: r.requiredDocuments.length + r.otherDocuments.length + r.filledFields.length + r.missingFields.length,
  });

  if (fx.loading && fx.visible.length === 0 && !fx.error) {
    return (
      <ContentSkeleton />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Indicadores estilo Pre-nómina (una fila de cuatro tarjetas). */}
      {!hideKpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[14px] px-4 py-3.5" style={{ background: "var(--color-primary-900)" }}>
            <ITText className="block !text-[12px] font-semibold !text-white/75">{t("records.kpis.active")}</ITText>
            <ITText className="mt-1 block !text-[26px] font-extrabold leading-none tabular-nums !text-white">
              <Num value={fx.counts.total} />
            </ITText>
          </div>
          <RecordKpi label={t("records.kpis.complete")} value={fx.counts.COMPLETE} />
          <RecordKpi label={t("records.kpis.missingRequired")} value={fx.counts.REQUIRED} alert />
          <RecordKpi label={t("records.kpis.incomplete")} value={fx.counts.INCOMPLETE} />
        </div>
      )}

      {fx.error && (
        <ITAlert variant="error">{fx.error}</ITAlert>
      )}

      <div className="grid gap-4 xl:!grid-cols-[minmax(0,1fr)_320px]">
        {/* Lista */}
        <ITCard contentClassName="!p-0">
          {/* Filtros: buscar, pastillas de estado y área */}
          <div
            className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] md:items-center"
            style={{ borderBottom: hairline }}
          >
            <ITInput
              name="employee_records_search"
              size="sm"
              value={fx.search}
              onChange={(e) => fx.setSearch(e.target.value)}
              placeholder={t("records.filters.search")}
              iconLeft={<FaSearch size={12} />}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <ITChip
                  key={f}
                  size="sm"
                  label={f === "ALL" ? t("records.filters.all") : t(`records.filters.${f}`)}
                  selected={fx.filter === f}
                  onClick={() => fx.setFilter(f)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </div>
            <ITSearchSelect
              name="employee_records_department"
              size="sm"
              placeholder={t("records.filters.department")}
              options={[
                { value: "", label: t("records.filters.allDepartments") },
                ...fx.departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={fx.departmentId}
              onChange={(value) => fx.setDepartmentId(String(value))}
            />
          </div>

          <div className="max-h-[640px] overflow-auto">
            {/* Divs con roles ARIA (no <table>): el tema inyecta reglas globales
                a thead/tbody con !important y ensucian cualquier tabla plana. */}
            <div role="table" aria-label={t("records.columns.employee")} className="min-w-[760px]">
              <div
                role="row"
                className={`${grid} sticky top-0 z-10 px-4 py-2.5`}
                style={{ borderBottom: hairline, background: "var(--it-card-bg, #ffffff)" }}
              >
                <span role="columnheader" className={th}>{t("records.columns.employee")}</span>
                <span role="columnheader" className={th}>{t("records.columns.required")}</span>
                <span role="columnheader" className={th}>{t("records.columns.record")}</span>
                <span role="columnheader" className={th}>{t("records.columns.personal")}</span>
                <span role="columnheader" className={th}>{t("records.columns.status")}</span>
                <span role="columnheader" className={th} />
              </div>
              {fx.visible.length === 0 && (
                <div role="row" className="px-4 py-10 text-center text-[12px] text-slate-400">
                  {t("records.empty")}
                </div>
              )}
              {fx.visible.map((r, i) => {
                const status = recordStatus(r);
                const active = sel?.userId === r.userId;
                const fieldsTotal = r.filledFields.length + r.missingFields.length;
                return (
                  <div
                    role="row"
                    key={r.userId}
                    onClick={() => fx.select(r.userId)}
                    className={`${grid} cursor-pointer px-4 py-2 ${
                      active ? "bg-slate-50 shadow-[inset_3px_0_0_var(--color-primary)]" : "hover:bg-slate-50/60"
                    }`}
                    style={i < fx.visible.length - 1 ? { borderBottom: hairline } : undefined}
                  >
                    <span role="cell" className="pr-3">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar name={r.name} size="sm" />
                        <div className="min-w-0 max-w-[200px]">
                          <div className="line-clamp-2 text-[12px] font-bold leading-tight text-slate-900">{r.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {[r.employeeNumber ? `#${r.employeeNumber}` : "#—", r.departmentName].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>
                    </span>
                    <span role="cell">
                      {/* Los obligatorios, en puntos: se lee de un vistazo y no
                          repite tres etiquetas rojas en cada fila. El detalle
                          con el nombre de cada documento está a la derecha. */}
                      <div
                        className="flex items-center gap-1.5"
                        title={r.requiredDocuments.map((d) => `${d.delivered ? "✓" : "✗"} ${d.name}`).join("\n")}
                      >
                        {r.requiredDocuments.map((d) => (
                          <span
                            key={d.id}
                            className={`h-2 w-2 rounded-full ${d.delivered ? "bg-emerald-500" : "bg-rose-300"}`}
                          />
                        ))}
                        <ITText as="span" className="ml-1 text-[11px] font-semibold tabular-nums text-slate-600">
                          {done(r.requiredDocuments)}/{r.requiredDocuments.length}
                        </ITText>
                      </div>
                    </span>
                    <span role="cell">
                      <Progress
                        done={done(r.otherDocuments)}
                        total={r.otherDocuments.length}
                        label={t("records.progress", { done: done(r.otherDocuments), total: r.otherDocuments.length })}
                      />
                    </span>
                    <span role="cell">
                      <Progress
                        done={r.filledFields.length}
                        total={fieldsTotal}
                        label={t("records.progress", { done: r.filledFields.length, total: fieldsTotal })}
                      />
                    </span>
                    <span role="cell">
                      <ITBadget size="sm" className="whitespace-nowrap" color={STATUS_COLOR[status]} label={t(`records.status.${status}`)} />
                    </span>
                    <span role="cell">
                      <ITFlex justify="end" gap={1} onClick={(e) => e.stopPropagation()}>
                        {status !== "COMPLETE" && (
                          <RowAction
                            icon={<FaBell size={12} />}
                            label={t("records.notify")}
                            tone="warning"
                            disabled={fx.notifying === r.userId}
                            onClick={() => void fx.notify(r)}
                          />
                        )}
                        <RowAction
                          icon={<FaChevronRight size={12} />}
                          label={t("records.detail.open")}
                          tone="primary"
                          onClick={() => navigate(`/employees/${r.userId}`)}
                        />
                      </ITFlex>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </ITCard>

        {/* Detalle */}
        <ITCard className="xl:sticky xl:top-4" contentClassName="flex max-h-[760px] flex-col !p-4">
          {!sel ? (
            <div className="p-8 text-center text-[12px] text-slate-400">{t("records.detail.select")}</div>
          ) : (
            <>
              <div className="p-1">
                <div className="flex items-center gap-2.5">
                  <ProfileAvatar name={sel.name} size="md" />
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[14px] font-bold leading-tight text-slate-900">{sel.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-slate-500">
                      {[sel.employeeNumber ? `#${sel.employeeNumber}` : "#—", sel.departmentName].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>

                {/* Total del expediente: número grande a la derecha, como el diseño */}
                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <ITText as="span" className="text-[13.5px] font-bold text-slate-900">{t("records.detail.total")}</ITText>
                  <ITText as="span" className="flex items-baseline gap-1">
                    <ITText as="b" className="text-[22px] font-extrabold leading-none tabular-nums text-slate-900">{totalOf(sel).done}</ITText>
                    <ITText as="span" className="text-[12px] text-slate-500">{t("records.detail.ofTotal", { total: totalOf(sel).total })}</ITText>
                  </ITText>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary-500)] transition-[width] duration-700"
                    style={{ width: `${percent(totalOf(sel).done, totalOf(sel).total)}%` }}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto px-1 pt-4">
                <div className="text-[13px] font-bold" style={{ color: "color-mix(in srgb, var(--color-warning) 42%, var(--color-text-default))" }}>
                  {t("records.detail.required", { done: done(sel.requiredDocuments), total: sel.requiredDocuments.length })}
                </div>
                <div className="mt-1 divide-y divide-slate-100">
                  {sel.requiredDocuments.map((d) => {
                    const file = fx.documentOf(d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-2.5 py-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: d.delivered ? "var(--color-success)" : "var(--color-warning)" }}
                        />
                        <ITText as="span" className="flex-1 text-[12.5px] font-medium text-slate-800">{d.name}</ITText>
                        {d.delivered && file ? (
                          <ITButton variant="text" color="primary" size="sm" label={t("records.detail.view")} onClick={() => window.open(file.url, "_blank", "noopener")} />
                        ) : (
                          <ITButton
                            variant="outlined"
                            color="primary"
                            size="sm"
                            disabled={fx.uploading === d.id}
                            onClick={() => pickFile(d.id)}
                            label={fx.uploading === d.id ? t("records.detail.uploading") : t("records.detail.upload")}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 text-[12px] font-bold text-slate-500">
                  {t("records.detail.other", { done: done(sel.otherDocuments), total: sel.otherDocuments.length })}
                </div>
                <div className="mt-2">
                  {(showAllDocs ? sel.otherDocuments : sel.otherDocuments.slice(0, OTHER_DOCS_PREVIEW)).map((d) => {
                    const file = fx.documentOf(d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-2.5 py-1">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${d.delivered ? "bg-emerald-600" : "bg-slate-300"}`} />
                        <ITText as="span" className="flex-1 text-[12px] text-slate-800">{d.name}</ITText>
                        {d.delivered && file ? (
                          <a href={file.url} target="_blank" rel="noreferrer" className="text-[11px] text-slate-500 hover:underline">
                            {t("records.detail.delivered")}
                          </a>
                        ) : showAllDocs ? (
                          <ITButton
                            variant="text"
                            color="primary"
                            size="sm"
                            disabled={fx.uploading === d.id}
                            onClick={() => pickFile(d.id)}
                            label={fx.uploading === d.id ? t("records.detail.uploading") : t("records.detail.upload")}
                          />
                        ) : (
                          <ITText as="span" className="text-[11px] text-slate-500">{d.delivered ? t("records.detail.delivered") : t("records.detail.pending")}</ITText>
                        )}
                      </div>
                    );
                  })}
                </div>
                {sel.otherDocuments.length > OTHER_DOCS_PREVIEW && (
                  <ITButton
                    variant="text"
                    color="primary"
                    size="sm"
                    onClick={() => setShowAllDocs((v) => !v)}
                    label={showAllDocs ? t("records.detail.showLess") : t("records.detail.showAll", { count: sel.otherDocuments.length })}
                  />
                )}

                <div className="mt-4 text-[12px] font-bold text-slate-500">
                  {t("records.detail.personal", {
                    done: sel.filledFields.length,
                    total: sel.filledFields.length + sel.missingFields.length,
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(() => {
                    const all = [
                      ...sel.filledFields.map((f) => ({ key: f, filled: true })),
                      ...sel.missingFields.map((f) => ({ key: f, filled: false })),
                    ];
                    const shown = showAllFields ? all : all.slice(0, FIELDS_PREVIEW);
                    return (
                      <>
                        {shown.map((f) => (
                          <ITChip
                            key={f.key}
                            size="sm"
                            variant={f.filled ? "soft" : "outlined"}
                            color={f.filled ? "success" : "gray"}
                            label={t(`records.profileFields.${f.key}`)}
                          />
                        ))}
                        {all.length > FIELDS_PREVIEW && (
                          <ITButton
                            variant="text"
                            color="primary"
                            size="sm"
                            onClick={() => setShowAllFields((v) => !v)}
                            label={showAllFields ? t("records.detail.showLess") : t("records.detail.moreFields", { count: all.length - FIELDS_PREVIEW })}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="grid !grid-cols-2 gap-2 p-3" style={{ borderTop: hairline }}>
                <ITButton
                  variant="outlined"
                  color="secondary"
                  size="sm"
                  className="w-full"
                  disabled={recordStatus(sel) === "COMPLETE" || fx.notifying === sel.userId}
                  onClick={() => void fx.notify(sel)}
                  label={recordStatus(sel) === "COMPLETE" ? t("records.complete") : t("records.detail.notify")}
                />
                <ITButton
                  variant="filled"
                  color="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/employees/${sel.userId}`)}
                  label={t("records.detail.open")}
                />
              </div>
            </>
          )}
        </ITCard>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadType) void fx.upload(uploadType, file);
          e.target.value = "";
        }}
      />

      <ITConfirmDialog
        isOpen={fx.bulkOpen}
        onClose={() => fx.setBulkOpen(false)}
        onConfirm={() => void fx.notifyPending()}
        title={t("records.notifyPendingConfirmTitle")}
        message={t("records.notifyPendingConfirm", { count: fx.pendingVisible.length })}
        confirmLabel={t("records.notifyPending")}
        cancelLabel={t("common:actions.cancel")}
        loading={fx.bulkSending}
      />

      {fx.toast && (
        <ITToast message={fx.toast.message} type={fx.toast.type} position="bottom-center" duration={3000} onClose={() => fx.setToast(null)} />
      )}
    </div>
  );
}
