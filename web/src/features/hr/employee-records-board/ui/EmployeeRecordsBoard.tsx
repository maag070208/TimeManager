import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ITAlert,
  ITBadget,
  ITCard,
  ITButton,
  ITChip,
  ITDataTable,
  ITFlex,
  ITConfirmDialog,
  ITInput,
  ITSearchSelect,
  ITToast, ITText } from "@axzydev/axzy_ui_system";
import type { ITDataTableFetchParams } from "@axzydev/axzy_ui_system";
import { FaBell, FaChevronRight, FaSearch } from "react-icons/fa";
import { LuCircleAlert, LuCircleCheck, LuCirclePause, LuUsersRound } from "react-icons/lu";
import { ProfileAvatar } from "@shared/ui/profile-avatar";
import { RowAction } from "@shared/ui/row-action";
import type { RecordGapsRow } from "@entities/dashboard";
import { recordStatus, type RecordFilter, type RecordStatus, type UseEmployeeRecords } from "../model/useEmployeeRecords";
import { ContentSkeleton } from "@shared/ui/content-skeleton";
import { BentoFilterCards, BentoKpiGrid, type BentoFilterItem } from "@shared/ui/bento-filter-cards";

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

export default function EmployeeRecordsBoard({ fx, hideKpis = false }: Props) {
  const { t } = fx;
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [tableReload, setTableReload] = useState(0);
  const sel = fx.selected;

  const pickFile = (typeId: string) => {
    setUploadType(typeId);
    fileInput.current?.click();
  };

  // Indicadores: totales del expediente para las tarjetas y la lista.

  const done = (items: Array<{ delivered: boolean }>) => items.filter((i) => i.delivered).length;
  const totalOf = (r: RecordGapsRow) => ({
    done: done(r.requiredDocuments) + done(r.otherDocuments) + r.filledFields.length,
    total: r.requiredDocuments.length + r.otherDocuments.length + r.filledFields.length + r.missingFields.length,
  });

  const columns: any[] = [
    {
      type: "string",
      key: "name",
      label: t("records.columns.employee"),
      width: 280,
      sortable: false,
      render: (r: RecordGapsRow) => (
        <div className="flex items-center gap-3">
          <ProfileAvatar name={r.name} size="sm" />
          <div className="min-w-0">
            <div className="line-clamp-1 text-[12px] font-bold text-slate-900">{r.name}</div>
            <div className="text-[10px] text-slate-500">
              {[r.employeeNumber ? `#${r.employeeNumber}` : "#—", r.departmentName].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      ),
    },
    {
      type: "string",
      key: "required",
      label: t("records.columns.required"),
      width: 150,
      sortable: false,
      render: (r: RecordGapsRow) => (
        <div className="flex items-center gap-1.5" title={r.requiredDocuments.map((d) => `${d.delivered ? "✓" : "✗"} ${d.name}`).join("\n")}>
          {r.requiredDocuments.map((d) => (
            <span key={d.id} className={`h-2 w-2 rounded-full ${d.delivered ? "bg-emerald-500" : "bg-rose-300"}`} />
          ))}
          <ITText as="span" className="ml-1 text-[11px] font-semibold tabular-nums text-slate-600">
            {done(r.requiredDocuments)}/{r.requiredDocuments.length}
          </ITText>
        </div>
      ),
    },
    {
      type: "string",
      key: "record",
      label: t("records.columns.record"),
      width: 150,
      sortable: false,
      render: (r: RecordGapsRow) => (
        <Progress done={done(r.otherDocuments)} total={r.otherDocuments.length} label={t("records.progress", { done: done(r.otherDocuments), total: r.otherDocuments.length })} />
      ),
    },
    {
      type: "string",
      key: "personal",
      label: t("records.columns.personal"),
      width: 150,
      sortable: false,
      render: (r: RecordGapsRow) => (
        <Progress
          done={r.filledFields.length}
          total={r.filledFields.length + r.missingFields.length}
          label={t("records.progress", { done: r.filledFields.length, total: r.filledFields.length + r.missingFields.length })}
        />
      ),
    },
    {
      type: "string",
      key: "status",
      label: t("records.columns.status"),
      width: 130,
      sortable: false,
      render: (r: RecordGapsRow) => {
        const status = recordStatus(r);
        return <ITBadget size="sm" className="whitespace-nowrap" color={STATUS_COLOR[status]} label={t(`records.status.${status}`)} />;
      },
    },
    {
      type: "actions" as const,
      key: "actions",
      label: "",
      width: 110,
      align: "right" as const,
      render: (r: RecordGapsRow) => (
        <ITFlex justify="end" gap={1} onClick={(e) => e.stopPropagation()}>
          {recordStatus(r) !== "COMPLETE" && (
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
      ),
    },
  ];

  const fetchData = useCallback(
    async (params: ITDataTableFetchParams) => {
      const start = Math.max(0, (params.page - 1) * params.limit);
      const data = fx.visible.slice(start, start + params.limit) as unknown as Record<string, unknown>[];
      return { data, total: fx.visible.length };
    },
    [fx.visible]
  );

  // La lista la filtra el tablero (búsqueda/área/estado): cada cambio recarga la tabla.
  useEffect(() => {
    setTableReload((value) => value + 1);
  }, [fx.visible]);


  if (fx.loading && fx.visible.length === 0 && !fx.error) {
    return (
      <ContentSkeleton />
    );
  }



  return (
    <div className="flex flex-col gap-4">
      {/* Contexto del expediente en KPIs bento (blancos con waves). */}
      {!hideKpis && (
        <BentoKpiGrid
          items={[
            { id: "all", label: t("records.kpis.active"), value: fx.counts.total, icon: <LuUsersRound size={14} /> },
            { id: "complete", label: t("records.kpis.complete"), value: fx.counts.COMPLETE, tone: "success", icon: <LuCircleCheck size={14} /> },
            { id: "required", label: t("records.kpis.missingRequired"), value: fx.counts.REQUIRED, tone: "warning", icon: <LuCircleAlert size={14} /> },
            { id: "incomplete", label: t("records.kpis.incomplete"), value: fx.counts.INCOMPLETE, icon: <LuCirclePause size={14} /> },
          ]}
        />
      )}

      {fx.error && (
        <ITAlert variant="error">{fx.error}</ITAlert>
      )}

      {(() => {
        const filterCards: BentoFilterItem[] = [
          { id: "ALL", label: t("records.filters.all"), value: fx.counts.total, icon: <LuUsersRound size={14} /> },
          { id: "REQUIRED", label: t("records.filters.REQUIRED"), value: fx.counts.REQUIRED, icon: <LuCircleAlert size={14} /> },
          { id: "INCOMPLETE", label: t("records.filters.INCOMPLETE"), value: fx.counts.INCOMPLETE, icon: <LuCirclePause size={14} /> },
          { id: "COMPLETE", label: t("records.filters.COMPLETE"), value: fx.counts.COMPLETE, icon: <LuCircleCheck size={14} /> },
        ];
        return <BentoFilterCards items={filterCards} activeId={fx.filter} onSelect={(id) => fx.setFilter(id as RecordFilter)} />;
      })()}

      <div className="grid gap-4 xl:!grid-cols-[minmax(0,1fr)_320px]">
        {/* Lista */}
        <ITCard contentClassName="!p-0">
          {/* Filtros: buscar y área */}
          <div
            className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center"
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

          <ITDataTable showViewToggle={false} defaultItemsPerPage={50} itemsPerPageOptions={[25, 50, 100]} layout="fixed" density="compact" virtualized virtualizedMaxHeight={400} rowHeight={50}
            reloadTrigger={tableReload}
            columns={columns as any}
            fetchData={fetchData as any}
            onRowClick={(row) => fx.select((row as unknown as RecordGapsRow).userId)}
            size="lg"
            className="border-0"
          />

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
