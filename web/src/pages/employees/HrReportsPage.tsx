import {
  ITAlert,
  ITButton,
  ITFlex,
  ITInput,
  ITPage,
  ITSelect,
  ITText,
} from "@axzydev/axzy_ui_system";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuCalendarDays,
  LuClockAlert,
  LuRotateCcw,
  LuScrollText,
  LuUserX,
} from "react-icons/lu";
import { TicConfirm } from "@shared/ui/tic-confirm";
import { TicState } from "@shared/ui/tic";
import { BentoFilterCards, type BentoFilterItem } from "@shared/ui/bento-filter-cards";
import { onAppEvent } from "@shared/lib/appEvents";
import { PanelCard } from "@shared/ui/panel-card";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DisciplinaryReport } from "@entities/hr";
import { useCan } from "@entities/user";
import {
  DISCIPLINARY_REASONS,
  DisciplinaryReportsTable,
  useDisciplinaryReports,
  type DisciplinaryQuickFilter,
  type DisciplinaryReasonFilter,
} from "@features/hr/disciplinary-reports";
import { useGoBack } from "@shared/lib/useGoBack";

export default function HrReportsPage() {
  const { t: tt, i18n } = useTranslation(["disciplinary-reports", "common"]);
  const navigate = useNavigate();
  const goBack = useGoBack();
  const fx = useDisciplinaryReports();
  const [disciplinaryReportToDelete, setDisciplinaryReportToDelete] = useState<DisciplinaryReport | null>(null);

  // Consultar, levantar y eliminar actas piden el mismo permiso en la API.
  const canManage = useCan("hr.disciplinary_reports");

  // El bot levanta el acta: la tabla y los totales se recargan y la fila nueva
  // entra con el mismo destello verde que un ticket recién creado.
  const [flashNew, setFlashNew] = useState(false);
  const flashTimer = useRef<number | null>(null);
  useEffect(
    () =>
      onAppEvent("disciplinary:created", () => {
        fx.reload();
        setFlashNew(true);
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlashNew(false), 2600);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const summary = fx.summary;
  const percentOf = (value: number) =>
    summary && summary.total > 0 ? Math.round((value / summary.total) * 100) : 0;

  const monthName = useMemo(() => {
    const locale = i18n.language?.startsWith("en") ? "en-US" : "es-MX";
    return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date());
  }, [i18n.language]);

  // Totales reales del endpoint de la lista; cada tarjeta es un filtro rápido.
  const summaryItems: BentoFilterItem[] = summary
    ? [
        {
          id: "all",
          label: tt("summary.total"),
          value: summary.total,
          icon: <LuScrollText size={14} />,
        },
        {
          id: "month",
          label: tt("summary.month"),
          value: summary.month,
          icon: <LuCalendarDays size={14} />,
          caption: monthName,
        },
        {
          id: "ABSENCE",
          label: tt("summary.absences"),
          value: summary.byReason.ABSENCE,
          icon: <LuUserX size={14} />,
          caption: tt("summary.share", { percent: percentOf(summary.byReason.ABSENCE) }),
        },
        {
          id: "TARDINESS",
          label: tt("summary.tardiness"),
          value: summary.byReason.TARDINESS,
          icon: <LuClockAlert size={14} />,
          caption: tt("summary.share", { percent: percentOf(summary.byReason.TARDINESS) }),
        },
      ]
    : [];

  return (
    <ITPage className="m-0! p-0! px-8! min-w-full! pb-12!"
      noPadding
      title={tt("title")}
      description={tt("description")}
      backAction={() => goBack("/")}
      icon={<LuScrollText size={20} />}
      breadcrumbs={[
        { label: tt("common:nav.home"), onClick: () => navigate("/") },
        { label: tt("breadcrumb") },
      ]}
    >
      {fx.error && (
        <ITAlert variant="error" dismissible onDismiss={() => fx.setError(null)}>
          {fx.error}
        </ITAlert>
      )}

      {!canManage ? (
        <PanelCard>
          <TicState kind="forbidden" />
        </PanelCard>
      ) : summary?.total === 0 ? (
        <PanelCard>
          <TicState
            kind="empty"
            title={tt("empty.title")}
            description={tt("empty.description")}
          />
        </PanelCard>
      ) : (
        <ITFlex direction="column" gap={4}>
          {summaryItems.length > 0 && (
            <BentoFilterCards
              items={summaryItems}
              activeId={fx.quick}
              onSelect={(id) => fx.setQuick(id as DisciplinaryQuickFilter)}
            />
          )}

          {summaryItems.length > 0 && (
            <PanelCard
              actions={
                <ITButton
                  variant="text"
                  color="gray"
                  size="sm"
                  disabled={!fx.hasFilters}
                  onClick={fx.clearFilters}
                >
                  <ITFlex align="center" gap={1}>
                    <LuRotateCcw size={12} />
                    <ITText className="font-bold text-[11px]">{tt("filters.clear")}</ITText>
                  </ITFlex>
                </ITButton>
              }
            >
              <ITFlex align="center" wrap="wrap" gap={2}>
                <div className="w-full sm:w-60">
                  <ITSelect
                    name="actasMotivo"
                    size="sm"
                    value={fx.reason}
                    onChange={(event) => fx.setReasonFilter(event.target.value as DisciplinaryReasonFilter)}
                    options={[
                      { value: "all", label: tt("filters.all") },
                      ...DISCIPLINARY_REASONS.map((reason) => ({
                        value: reason,
                        label: tt(`reasons.${reason}`),
                      })),
                    ]}
                  />
                </div>
                <div className="w-full sm:w-72">
                  <ITInput
                    name="actasBuscar"
                    placeholder={tt("filters.searchPlaceholder")}
                    value={fx.search}
                    onChange={(event) => fx.setSearch(event.target.value)}
                    className="w-full min-w-0"
                  />
                </div>
              </ITFlex>
            </PanelCard>
          )}

          <PanelCard title={tt("table.title")} icon={<LuScrollText size={15} />}>
            <DisciplinaryReportsTable
              fetchData={fx.fetchTableData}
              reloadKey={fx.reloadKey}
              externalFilters={fx.externalFilters}
              tableKey={fx.tableKey}
              canDelete={canManage}
              onView={(disciplinaryReport) => navigate(`/employees/disciplinary-reports/${disciplinaryReport.id}`)}
              onDelete={(disciplinaryReport) => setDisciplinaryReportToDelete(disciplinaryReport)}
              flashNew={flashNew}
            />
          </PanelCard>
        </ITFlex>
      )}

      <TicConfirm
        isOpen={!!disciplinaryReportToDelete}
        onClose={() => setDisciplinaryReportToDelete(null)}
        onConfirm={() => {
          if (disciplinaryReportToDelete) void fx.deleteDisciplinaryReport(disciplinaryReportToDelete.id);
          setDisciplinaryReportToDelete(null);
        }}
        title={tt("actions.delete")}
        message={tt("form.deleteConfirm", {
          name: disciplinaryReportToDelete?.user.name ?? "",
        })}
        confirmLabel={tt("actions.delete")}
        cancelLabel={tt("common:actions.cancel")}
        variant="danger"
      />
    </ITPage>
  );
}
